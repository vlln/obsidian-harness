export const MESSAGE_SCROLL_PHASE_TIMEOUT_MS = 1600;

export interface MessageScrollContainer {
	scrollTop: number;
	scrollHeight: number;
	clientHeight: number;
	scrollTo(options: ScrollToOptions): void;
	addEventListener(
		type: "scrollend",
		listener: EventListener,
		options?: boolean | AddEventListenerOptions,
	): void;
	removeEventListener(
		type: "scrollend",
		listener: EventListener,
		options?: boolean | EventListenerOptions,
	): void;
}

export interface VirtualItemForOffsetLookup {
	getVirtualItemForOffset(offset: number): { index: number } | undefined;
}

export interface AnimationFrameRef {
	current: number | null;
}

export function scheduleCoalescedAnimationFrame(
	frameRef: AnimationFrameRef,
	requestFrame: (callback: () => void) => number,
	callback: () => void,
): void {
	if (frameRef.current !== null) return;
	frameRef.current = requestFrame(() => {
		frameRef.current = null;
		callback();
	});
}

export interface MessageScrollRequest {
	resolveOffset(): number | undefined;
	commitExact(): void;
	isCurrent(): boolean;
	reducedMotion: boolean;
}

export interface MessageScrollCoordinatorOptions {
	getContainer(): MessageScrollContainer | null;
	setTimer(callback: () => void, delay: number): number;
	clearTimer(timer: number): void;
}

export interface MessageScrollCoordinator {
	coordinateSmoothMessageScroll(request: MessageScrollRequest): void;
	cancel(): void;
	cancelIfTargetChanged(): void;
	isActive(): boolean;
}

interface ActiveScroll {
	request: MessageScrollRequest;
	container: MessageScrollContainer;
	correctionStarted: boolean;
	timer: number | null;
	settle: EventListener;
}

function readOffset(request: MessageScrollRequest): number | undefined {
	try {
		const offset = request.resolveOffset();
		return Number.isFinite(offset) ? offset : undefined;
	} catch {
		return undefined;
	}
}

function commitIfCurrent(request: MessageScrollRequest): void {
	try {
		if (!request.isCurrent()) return;
		request.commitExact();
	} catch {
		// A failed exact landing must not restart the scroll sequence.
	}
}

export function getVirtualMessageAnchorIndex(
	virtualizer: VirtualItemForOffsetLookup | null,
	scrollTop: number,
	messageCount: number,
): number {
	if (messageCount <= 0) return 0;
	try {
		const item = virtualizer?.getVirtualItemForOffset(
			Math.max(0, scrollTop),
		);
		if (item && Number.isInteger(item.index)) {
			return Math.min(messageCount - 1, Math.max(0, item.index));
		}
	} catch {
		// Fall through to a deterministic boundary anchor.
	}
	return scrollTop > 0 ? messageCount - 1 : 0;
}

export function createMessageScrollCoordinator(
	options: MessageScrollCoordinatorOptions,
): MessageScrollCoordinator {
	let active: ActiveScroll | null = null;

	const disarm = (action: ActiveScroll) => {
		action.container.removeEventListener("scrollend", action.settle);
		if (action.timer !== null) {
			options.clearTimer(action.timer);
			action.timer = null;
		}
	};

	const cancel = () => {
		if (!active) return;
		disarm(active);
		active = null;
	};

	const coordinateSmoothMessageScroll = (
		request: MessageScrollRequest,
	) => {
		cancel();
		try {
			if (!request.isCurrent()) return;
		} catch {
			return;
		}

		const container = options.getContainer();
		const initialOffset = readOffset(request);
		if (request.reducedMotion || !container || initialOffset === undefined) {
			commitIfCurrent(request);
			return;
		}

		const action: ActiveScroll = {
			request,
			container,
			correctionStarted: false,
			timer: null,
			settle: () => undefined,
		};

		const finish = () => {
			if (active !== action) return;
			disarm(action);
			active = null;
			commitIfCurrent(request);
		};

		const arm = () => {
			container.addEventListener("scrollend", action.settle, {
				once: true,
			});
			action.timer = options.setTimer(
				() => action.settle(new Event("scrollend")),
				MESSAGE_SCROLL_PHASE_TIMEOUT_MS,
			);
		};

		action.settle = () => {
			if (active !== action) return;
			disarm(action);
			if (!request.isCurrent()) {
				active = null;
				return;
			}

			const exactOffset = readOffset(request);
			if (
				!action.correctionStarted &&
				exactOffset !== undefined &&
				Math.abs(exactOffset - container.scrollTop) > 1
			) {
				action.correctionStarted = true;
				arm();
				try {
					container.scrollTo({
						top: exactOffset,
						behavior: "smooth",
					});
					return;
				} catch {
					disarm(action);
				}
			}
			finish();
		};

		active = action;
		arm();
		try {
			container.scrollTo({ top: initialOffset, behavior: "smooth" });
		} catch {
			finish();
		}
	};

	return {
		coordinateSmoothMessageScroll,
		cancel,
		isActive: () => active !== null,
		cancelIfTargetChanged: () => {
			if (!active) return;
			try {
				if (!active.request.isCurrent()) cancel();
			} catch {
				cancel();
			}
		},
	};
}
