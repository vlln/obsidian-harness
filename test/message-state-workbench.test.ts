import { afterEach, describe, expect, it, vi } from "vitest";

import { applySingleUpdate } from "../src/services/message-state";
import type { ChatMessage } from "../src/types/chat";

describe("message state workbench metadata", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("records thought start and update timestamps", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-18T16:00:00.000Z"));
		const index = new Map<string, number>();
		let messages: ChatMessage[] = [];

		messages = applySingleUpdate(
			messages,
			{
				type: "agent_thought_chunk",
				sessionId: "s1",
				text: "first",
			},
			index,
		);

		vi.setSystemTime(new Date("2026-07-18T16:00:03.000Z"));
		messages = applySingleUpdate(
			messages,
			{
				type: "agent_thought_chunk",
				sessionId: "s1",
				text: " second",
			},
			index,
		);

		const thought = messages[0].content[0];
		expect(thought.type).toBe("agent_thought");
		if (thought.type !== "agent_thought") return;
		expect(thought.text).toBe("first second");
		expect(thought.startedAt).toBe("2026-07-18T16:00:00.000Z");
		expect(thought.updatedAt).toBe("2026-07-18T16:00:03.000Z");
	});

	it("merges tool raw output updates", () => {
		const index = new Map<string, number>();
		let messages: ChatMessage[] = [];

		messages = applySingleUpdate(
			messages,
			{
				type: "tool_call",
				sessionId: "s1",
				toolCallId: "tool-1",
				title: "Bash",
				status: "in_progress",
				rawInput: { command: "ls" },
			},
			index,
		);
		messages = applySingleUpdate(
			messages,
			{
				type: "tool_call_update",
				sessionId: "s1",
				toolCallId: "tool-1",
				status: "completed",
				rawOutput: { exitCode: 0 },
			},
			index,
		);

		const tool = messages[0].content[0];
		expect(tool.type).toBe("tool_call");
		if (tool.type !== "tool_call") return;
		expect(tool.rawInput).toEqual({ command: "ls" });
		expect(tool.rawOutput).toEqual({ exitCode: 0 });
		expect(tool.status).toBe("completed");
	});
});
