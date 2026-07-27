import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
	createTurnPreview,
	deriveTurnNavigation,
	getActiveTurnMessageId,
	isCurrentTurnNavigationTarget,
} from "../src/services/turn-navigation";
import type { ChatMessage, MessageContent } from "../src/types/chat";

const root = fileURLToPath(new URL("..", import.meta.url));

function message(
	id: string,
	role: "user" | "assistant",
	content: MessageContent[],
): ChatMessage {
	return { id, role, content, timestamp: new Date(0) };
}

describe("turn navigation projection", () => {
	it("AC-0025-N-1: creates exactly one item per user message", () => {
		const items = deriveTurnNavigation([
			message("u1", "user", [{ type: "text", text: "First" }]),
			message("a1", "assistant", [{ type: "text", text: "Answer" }]),
			message("u2", "user", [
				{ type: "text_with_context", text: "Second" },
			]),
		]);
		expect(items).toEqual([
			{ messageId: "u1", messageIndex: 0, preview: "First", ordinal: 1 },
			{ messageId: "u2", messageIndex: 2, preview: "Second", ordinal: 2 },
		]);
	});

	it("AC-0025-B-2: truncates normalized visible text to 160 characters", () => {
		const preview = createTurnPreview(
			message("u", "user", [
				{ type: "text", text: `  ${"word ".repeat(50)}  ` },
			]),
		);
		expect(Array.from(preview)).toHaveLength(160);
		expect(preview).not.toMatch(/\s{2}/);
	});

	it("AC-0025-B-2: summarizes attachments without data or URI leakage", () => {
		const preview = createTurnPreview(
			message("u", "user", [
				{
					type: "image",
					data: "base64-secret",
					mimeType: "image/png",
					uri: "file:///secret/image.png",
				},
				{
					type: "resource_link",
					uri: "file:///secret/report.pdf",
					name: "report.pdf",
				},
			]),
		);
		expect(preview).toBe("[Image: png] [Attachment: report.pdf]");
		expect(preview).not.toContain("base64-secret");
		expect(preview).not.toContain("file://");
	});

	it("AC-0025-B-1: produces no rail items without user messages", () => {
		expect(
			deriveTurnNavigation([
				message("a", "assistant", [{ type: "text", text: "Only" }]),
			]),
		).toEqual([]);
	});

	it("AC-0025-B-4: clamps active state before first and after last turn", () => {
		const items = deriveTurnNavigation([
			message("a0", "assistant", [{ type: "text", text: "Prelude" }]),
			message("u1", "user", [{ type: "text", text: "First" }]),
			message("a1", "assistant", [{ type: "text", text: "Answer" }]),
			message("u2", "user", [{ type: "text", text: "Last" }]),
		]);
		expect(getActiveTurnMessageId(items, 0)).toBe("u1");
		expect(getActiveTurnMessageId(items, 2)).toBe("u1");
		expect(getActiveTurnMessageId(items, 99)).toBe("u2");
	});

	it("AC-0025-E-1: rejects a stale turn after the Session changes", () => {
		const stale = {
			messageId: "old-user",
			messageIndex: 0,
			preview: "Old",
			ordinal: 1,
		};
		const currentMessages = [
			message("new-user", "user", [{ type: "text", text: "New" }]),
		];

		expect(isCurrentTurnNavigationTarget(currentMessages, stale)).toBe(
			false,
		);
		expect(
			isCurrentTurnNavigationTarget(currentMessages, {
				...stale,
				messageId: "new-user",
			}),
		).toBe(true);
	});

	it("AC-0025-B-3: derives 500 messages within the 16 ms budget", () => {
		const messages = Array.from({ length: 500 }, (_, index) =>
			message(`m${index}`, index % 2 === 0 ? "user" : "assistant", [
				{ type: "text", text: `Message ${index}` },
			]),
		);
		const started = performance.now();
		const items = deriveTurnNavigation(messages);
		expect(performance.now() - started).toBeLessThan(16);
		expect(items).toHaveLength(250);
	});

	it("AC-0025-E-1/E-2/F-1: confines and guards navigator wiring", async () => {
		const [
			sessionView,
			chatView,
			floatingView,
			messageList,
			scrollCoordinator,
			styles,
		] =
			await Promise.all([
				readFile(join(root, "src/ui/HarnessSessionView.tsx"), "utf8"),
				readFile(join(root, "src/ui/ChatView.tsx"), "utf8"),
				readFile(join(root, "src/ui/FloatingChatView.tsx"), "utf8"),
				readFile(join(root, "src/ui/MessageList.tsx"), "utf8"),
				readFile(
					join(root, "src/ui/message-scroll-coordinator.ts"),
					"utf8",
				),
				readFile(join(root, "styles.css"), "utf8"),
			]);

		expect(sessionView).toContain("showTurnNavigator");
		expect(chatView).not.toContain("showTurnNavigator");
		expect(floatingView).not.toContain("showTurnNavigator");
		expect(messageList).toContain("isCurrentTurnNavigationTarget");
		expect(messageList).toContain("getVirtualMessageAnchorIndex");
		expect(messageList).toContain("coordinateSmoothMessageScroll");
		expect(scrollCoordinator).toContain("catch {");
		expect(scrollCoordinator).toContain("cancelIfTargetChanged");
		expect(messageList).toContain("scheduleCoalescedAnimationFrame");
		expect(styles).toContain("grid-template-columns: 34px minmax(0, 1fr)");
		expect(styles).toContain("@container (max-width: 519px)");
		expect(styles).toContain("width: 24px;");
		expect(styles).toContain("height: 24px;");
		expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
	});
});
