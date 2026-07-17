import { describe, expect, it } from "vitest";

import {
	appendMarkdownSection,
	formatAgentResponseSection,
	getLatestAssistantText,
} from "../src/services/agent-output-appender";
import type { ChatMessage } from "../src/types/chat";

function message(
	role: ChatMessage["role"],
	content: ChatMessage["content"],
	id = crypto.randomUUID(),
): ChatMessage {
	return {
		id,
		role,
		content,
		timestamp: new Date("2026-07-17T19:00:00Z"),
	};
}

describe("agent output appender", () => {
	it("extracts the latest assistant text response", () => {
		const messages: ChatMessage[] = [
			message("assistant", [{ type: "text", text: "older" }]),
			message("user", [{ type: "text", text: "question" }]),
			message("assistant", [{ type: "text", text: "latest" }]),
		];

		expect(getLatestAssistantText(messages)).toBe("latest");
	});

	it("joins assistant text blocks and ignores non-text content", () => {
		const messages: ChatMessage[] = [
			message("assistant", [
				{ type: "tool_call", toolCallId: "t1", status: "completed" },
				{ type: "text", text: "first" },
				{ type: "image", data: "abc", mimeType: "image/png" },
				{ type: "text_with_context", text: "second" },
			]),
		];

		expect(getLatestAssistantText(messages)).toBe("first\n\nsecond");
	});

	it("returns null when there is no assistant text", () => {
		const messages: ChatMessage[] = [
			message("user", [{ type: "text", text: "hello" }]),
			message("assistant", [
				{ type: "tool_call", toolCallId: "t1", status: "completed" },
			]),
		];

		expect(getLatestAssistantText(messages)).toBeNull();
	});

	it("formats a dated markdown section", () => {
		const section = formatAgentResponseSection(
			"Done.",
			new Date(2026, 6, 17, 19, 5),
		);

		expect(section).toBe("## Agent response - 2026-07-17 19:05\n\nDone.\n");
	});

	it("appends to existing markdown without overwriting", () => {
		expect(
			appendMarkdownSection("# Note\nExisting", "## Agent\n\nOutput\n"),
		).toBe("# Note\nExisting\n\n## Agent\n\nOutput\n");
	});

	it("appends to empty markdown", () => {
		expect(appendMarkdownSection("", "## Agent\n\nOutput\n")).toBe(
			"## Agent\n\nOutput\n",
		);
	});
});
