import * as React from "react";
const { useRef, useState, useEffect, useCallback, useMemo } = React;

import type { ChatMessage } from "../types/chat";
import type { SessionState } from "../types/session";
import type { AcpClient } from "../acp/acp-client";
import type HarnessPlugin from "../plugin";
import type { IChatViewHost } from "./view-host";
import { setIcon } from "obsidian";
import { MessageBubble } from "./MessageBubble";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
	deriveTurnNavigation,
	getActiveTurnMessageId,
	isCurrentTurnNavigationTarget,
	type TurnNavigationItem,
} from "../services/turn-navigation";
import { TurnNavigator } from "./TurnNavigator";
import {
	createMessageScrollCoordinator,
	getVirtualMessageAnchorIndex,
	scheduleCoalescedAnimationFrame,
	type MessageScrollCoordinator,
} from "./message-scroll-coordinator";

// How long (ms) after a tab is re-shown we refuse to shrink measured item
// sizes. Right after re-show the items briefly re-measure small while their
// markdown re-lays-out; recording those shrinks collapses the virtualizer's
// total size, which clamps scrollTop to 0 and loses the position. Riding out
// this window keeps total stable so the scroll position is preserved. (#321)
const SHOW_SETTLE_MS = 500;
const SCROLL_KEYS = new Set([
	"ArrowDown",
	"ArrowUp",
	"End",
	"Home",
	"PageDown",
	"PageUp",
	" ",
]);

/**
 * Props for MessageList component
 */
export interface MessageListProps {
	/** All messages in the current chat session */
	messages: ChatMessage[];
	/** Whether a message is currently being sent */
	isSending: boolean;
	/** Current session lifecycle state */
	sessionState: SessionState;
	/** Whether a session is being restored (load/resume/fork) */
	isRestoringSession: boolean;
	/** Display name of the active agent */
	agentLabel: string;
	/** Plugin instance */
	plugin: HarnessPlugin;
	/** View instance for event registration */
	view: IChatViewHost;
	/** Terminal client for output polling */
	terminalClient?: AcpClient;
	/** Callback to approve a permission request */
	onApprovePermission?: (
		requestId: string,
		optionId: string,
	) => Promise<void>;
	/** Whether a permission request is currently pending */
	hasActivePermission: boolean;
	/** Render per-user-message navigation for a .session FileView */
	showTurnNavigator?: boolean;
}

/**
 * Messages container component with virtualized rendering.
 *
 * Uses @tanstack/react-virtual to only render messages visible in the viewport,
 * dramatically improving performance for long conversations.
 *
 * Handles:
 * - Virtualized message list rendering
 * - Auto-scroll behavior (follows new content when at bottom)
 * - Empty state display
 * - Loading indicator
 */
export function MessageList({
	messages,
	isSending,
	sessionState,
	isRestoringSession,
	agentLabel,
	plugin,
	view,
	terminalClient,
	onApprovePermission,
	hasActivePermission,
	showTurnNavigator = false,
}: MessageListProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [isAtBottom, setIsAtBottom] = useState(true);
	const isAtBottomRef = useRef(true);
	const prevIsSendingRef = useRef(false);
	const hasMessages = messages.length > 0;
	// Last measured height per message id. Used to keep the virtualizer's total
	// size stable while the tab is hidden (display:none) so scrollTop isn't
	// clamped to 0 and the position survives a tab switch. (#321)
	const sizeCacheRef = useRef<Map<string, number>>(new Map());
	// Whether the view was last seen hidden (display:none), and the end of the
	// post-show "settle" window during which we refuse to shrink the size cache
	// (see SHOW_SETTLE_MS). Together these suppress the transient total-size
	// collapse that would otherwise clamp scrollTop to 0 on re-show. (#321)
	const wasHiddenRef = useRef(false);
	const settleUntilRef = useRef(0);
	const activeTurnFrameRef = useRef<number | null>(null);
	const messageScrollCoordinatorRef = useRef<MessageScrollCoordinator | null>(
		null,
	);
	const turnItems = useMemo(
		() => (showTurnNavigator ? deriveTurnNavigation(messages) : []),
		[messages, showTurnNavigator],
	);
	const [activeTurnMessageId, setActiveTurnMessageId] = useState<
		string | null
	>(null);
	const turnItemsRef = useRef(turnItems);
	const messageCountRef = useRef(messages.length);
	const messagesRef = useRef(messages);
	turnItemsRef.current = turnItems;
	messageCountRef.current = messages.length;
	messagesRef.current = messages;
	if (!messageScrollCoordinatorRef.current) {
		messageScrollCoordinatorRef.current = createMessageScrollCoordinator({
			getContainer: () => containerRef.current,
			setTimer: (callback, delay) =>
				window.setTimeout(callback, delay),
			clearTimer: (timer) => window.clearTimeout(timer),
		});
	}

	// ============================================================
	// Virtualizer
	// ============================================================
	const virtualizer = useVirtualizer({
		count: messages.length,
		getScrollElement: () => containerRef.current,
		estimateSize: () => 80,
		overscan: 5,
		getItemKey: (index) => messages[index]?.id ?? String(index),
		measureElement: (element) => {
			const el = element as HTMLElement;
			const id = el.getAttribute("data-msg-id");
			const cached = id ? sizeCacheRef.current.get(id) : undefined;
			// Hidden (display:none): the item is detached from layout
			// (offsetParent === null) and would measure 0. Remember we were
			// hidden and return the last known size so the total size doesn't
			// collapse on the hidden side. (#321)
			if (el.offsetParent === null) {
				wasHiddenRef.current = true;
				return cached || 80;
			}
			// First measure after re-show: open the settle window. Opening it
			// here (rather than from a separate observer) makes this very call
			// guarded too, regardless of observer firing order. (#321)
			if (wasHiddenRef.current) {
				wasHiddenRef.current = false;
				settleUntilRef.current = performance.now() + SHOW_SETTLE_MS;
			}
			const measured = el.getBoundingClientRect().height;
			// Inside the settle window, never shrink: return the larger of the
			// fresh and cached heights and don't record it, so getTotalSize()
			// stays stable and scrollTop isn't clamped to 0 on re-show. Genuine
			// shrinks are accepted again once the window expires. (#321)
			if (
				cached !== undefined &&
				performance.now() < settleUntilRef.current
			) {
				return Math.max(measured, cached);
			}
			if (id && measured > 0) sizeCacheRef.current.set(id, measured);
			return measured || cached || 80;
		},
	});

	// Suppress scroll position correction when user has scrolled up.
	// By default, the virtualizer adjusts scrollTop when an item before
	// the scroll offset changes size (to keep visible content stable).
	// During streaming, this causes the viewport to creep down as the
	// last message grows. Our auto-scroll effect handles following new
	// content when isAtBottom, so corrections are only needed there.
	virtualizer.shouldAdjustScrollPositionOnItemSizeChange = () =>
		isAtBottomRef.current;

	// ============================================================
	// Scroll management
	// ============================================================

	/**
	 * Check if the scroll position is near the bottom.
	 */
	const checkIfAtBottom = useCallback(() => {
		const container = containerRef.current;
		if (!container) return true;

		const threshold = 35;
		const isNearBottom =
			container.scrollTop + container.clientHeight >=
			container.scrollHeight - threshold;
		isAtBottomRef.current = isNearBottom;
		setIsAtBottom(isNearBottom);
		return isNearBottom;
	}, []);

	const updateActiveTurn = useCallback(() => {
		const currentTurnItems = turnItemsRef.current;
		if (currentTurnItems.length === 0) {
			setActiveTurnMessageId(null);
			return;
		}
		const container = containerRef.current;
		const isAtEnd =
			container &&
			container.scrollTop + container.clientHeight >=
				container.scrollHeight - 35;
		const anchor = isAtEnd
			? messageCountRef.current - 1
			: getVirtualMessageAnchorIndex(
					container ? virtualizer : null,
					container?.scrollTop ?? 0,
					messageCountRef.current,
				);
		setActiveTurnMessageId(
			getActiveTurnMessageId(currentTurnItems, anchor),
		);
	}, [virtualizer]);

	const scheduleActiveTurnUpdate = useCallback(() => {
		scheduleCoalescedAnimationFrame(
			activeTurnFrameRef,
			(callback) => window.requestAnimationFrame(callback),
			updateActiveTurn,
		);
	}, [updateActiveTurn]);

	useEffect(() => {
		setActiveTurnMessageId((current) =>
			turnItems.some((item) => item.messageId === current)
				? current
				: (turnItems[0]?.messageId ?? null),
		);
		scheduleActiveTurnUpdate();
	}, [scheduleActiveTurnUpdate, turnItems]);

	useEffect(
		() => () => {
			if (activeTurnFrameRef.current !== null) {
				window.cancelAnimationFrame(activeTurnFrameRef.current);
				activeTurnFrameRef.current = null;
			}
			messageScrollCoordinatorRef.current?.cancel();
		},
		[],
	);

	useEffect(() => {
		messageScrollCoordinatorRef.current?.cancelIfTargetChanged();
	}, [messages]);

	const navigateToTurn = useCallback(
		(item: TurnNavigationItem) => {
			if (!isCurrentTurnNavigationTarget(messagesRef.current, item)) {
				return;
			}
			const reducedMotion = window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches;
			messageScrollCoordinatorRef.current?.coordinateSmoothMessageScroll(
				{
					resolveOffset: () =>
						virtualizer.getOffsetForIndex(
							item.messageIndex,
							"start",
						)?.[0],
					commitExact: () =>
						virtualizer.scrollToIndex(item.messageIndex, {
							align: "start",
						}),
					isCurrent: () =>
						isCurrentTurnNavigationTarget(
							messagesRef.current,
							item,
						),
					reducedMotion,
				},
			);
			isAtBottomRef.current = false;
			setIsAtBottom(false);
			setActiveTurnMessageId(item.messageId);
		},
		[virtualizer],
	);

	const scrollToBottom = useCallback(() => {
		const targetMessageId =
			messagesRef.current[messagesRef.current.length - 1]?.id;
		if (!targetMessageId) return;
		const getBottomOffset = () => {
			const container = containerRef.current;
			return container
				? Math.max(0, container.scrollHeight - container.clientHeight)
				: undefined;
		};
		messageScrollCoordinatorRef.current?.coordinateSmoothMessageScroll({
			resolveOffset: getBottomOffset,
			commitExact: () => {
				const container = containerRef.current;
				const bottomOffset = getBottomOffset();
				if (container && bottomOffset !== undefined) {
					container.scrollTo({
						top: bottomOffset,
						behavior: "auto",
					});
				}
			},
			isCurrent: () =>
				messagesRef.current[messagesRef.current.length - 1]?.id ===
				targetMessageId,
			reducedMotion: window.matchMedia(
				"(prefers-reduced-motion: reduce)",
			).matches,
		});
	}, []);

	// Reset scroll state and drop the per-message size cache when messages are
	// cleared (new chat / restore / fork / restart all funnel through an empty
	// array first). Prevents stale msgId→height entries from accumulating
	// across sessions in this long-lived view. (#321)
	useEffect(() => {
		if (messages.length === 0) {
			setIsAtBottom(true);
			isAtBottomRef.current = true;
			sizeCacheRef.current.clear();
		}
	}, [messages.length]);

	// Track when user just sent a message (for smooth scroll)
	const scrollSmoothRef = useRef(false);
	useEffect(() => {
		if (isSending && !prevIsSendingRef.current) {
			// User just sent a message — next scroll should be smooth
			scrollSmoothRef.current = true;
		}
		prevIsSendingRef.current = isSending;
	}, [isSending]);

	// Auto-scroll to bottom when new messages arrive or content changes
	useEffect(() => {
		if (messages.length === 0) return;

		if (scrollSmoothRef.current) {
			// User sent a message — smooth scroll regardless of isAtBottom
			scrollSmoothRef.current = false;
			window.requestAnimationFrame(() => {
				virtualizer.scrollToIndex(messages.length - 1, {
					align: "end",
					behavior: "smooth",
				});
			});
			return;
		}

		if (isAtBottomRef.current) {
			// Use requestAnimationFrame to ensure virtualizer has measured
			window.requestAnimationFrame(() => {
				virtualizer.scrollToIndex(messages.length - 1, {
					align: "end",
				});
			});
		}
	}, [messages, virtualizer]);

	// Set up scroll event listener for isAtBottom detection
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const ownerDocument = container.ownerDocument;

		const handleScroll = () => {
			checkIfAtBottom();
			if (!messageScrollCoordinatorRef.current?.isActive()) {
				scheduleActiveTurnUpdate();
			}
		};
		const cancelPendingScroll = () => {
			messageScrollCoordinatorRef.current?.cancel();
		};
		const handleScrollKey = (event: KeyboardEvent) => {
			if (!SCROLL_KEYS.has(event.key)) return;
			const target = event.target;
			if (
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				(target instanceof HTMLElement && target.isContentEditable)
			) {
				return;
			}
			cancelPendingScroll();
		};

		view.registerDomEvent(container, "scroll", handleScroll);
		view.registerDomEvent(container, "wheel", cancelPendingScroll);
		view.registerDomEvent(container, "touchstart", cancelPendingScroll);
		view.registerDomEvent(container, "pointerdown", cancelPendingScroll);
		view.registerDomEvent(ownerDocument, "keydown", handleScrollKey);

		// Initial check
		checkIfAtBottom();

		return () => {
			container.removeEventListener("scroll", handleScroll);
			container.removeEventListener("wheel", cancelPendingScroll);
			container.removeEventListener("touchstart", cancelPendingScroll);
			container.removeEventListener("pointerdown", cancelPendingScroll);
			ownerDocument.removeEventListener("keydown", handleScrollKey);
			messageScrollCoordinatorRef.current?.cancel();
		};
	}, [view, checkIfAtBottom, scheduleActiveTurnUpdate, hasMessages]);

	// ============================================================
	// Render
	// ============================================================

	// Empty state
	if (messages.length === 0) {
		return (
			<div className="harness-message-list-shell">
				<div
					ref={containerRef}
					className="harness-chat-view-messages"
				>
					<div className="harness-chat-empty-state">
						{isRestoringSession
							? "Restoring session..."
							: sessionState === "initializing"
								? `Connecting to ${agentLabel}...`
								: `Start a conversation with ${agentLabel}...`}
					</div>
				</div>
			</div>
		);
	}

	const virtualItems = virtualizer.getVirtualItems();

	return (
		<div
			className={`harness-message-list-shell ${turnItems.length > 0 ? "has-turn-navigator" : ""}`}
		>
			<TurnNavigator
				items={turnItems}
				activeMessageId={activeTurnMessageId}
				onNavigate={navigateToTurn}
			/>
			<div ref={containerRef} className="harness-chat-view-messages">
				{/* Virtualized message list */}
				<div
					className="harness-virtual-list-inner"
					style={{
						height: virtualizer.getTotalSize(),
						position: "relative",
					}}
				>
					{virtualItems.map((virtualItem) => {
						const message = messages[virtualItem.index];
						return (
							<div
								key={message.id}
								ref={virtualizer.measureElement}
								data-index={virtualItem.index}
								data-msg-id={message.id}
								className="harness-virtual-item"
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									width: "100%",
									transform: `translateY(${virtualItem.start}px)`,
								}}
							>
								<MessageBubble
									message={message}
									plugin={plugin}
									terminalClient={terminalClient}
									onApprovePermission={onApprovePermission}
								/>
							</div>
						);
					})}
				</div>

				{/* Loading indicator — outside virtualizer */}
				<div
					className={`harness-loading-indicator ${!isSending ? "harness-hidden" : ""}`}
				>
					<div className="harness-loading-dots">
						<div className="harness-loading-dot"></div>
						<div className="harness-loading-dot"></div>
						<div className="harness-loading-dot"></div>
						<div className="harness-loading-dot"></div>
						<div className="harness-loading-dot"></div>
						<div className="harness-loading-dot"></div>
						<div className="harness-loading-dot"></div>
						<div className="harness-loading-dot"></div>
						<div className="harness-loading-dot"></div>
					</div>
					{hasActivePermission && (
						<span className="harness-loading-status">
							Waiting for permission...
						</span>
					)}
				</div>

				{/* Scroll to bottom button */}
				{!isAtBottom && (
					<button
						className="harness-scroll-to-bottom"
						onClick={scrollToBottom}
						ref={(el) => {
							if (el) setIcon(el, "chevron-down");
						}}
					/>
				)}
			</div>
		</div>
	);
}
