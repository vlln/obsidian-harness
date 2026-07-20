import type { PromptContent } from "../../src/types/chat";
import type { SessionUpdate } from "../../src/types/session";

export interface AcpTurnFixture {
	sessionId: string;
	prompt: PromptContent[];
	updates: SessionUpdate[];
	stopReason: string;
}

export function createCompletedTurnFixture(
	sessionId = "acp-session-fixture",
): AcpTurnFixture {
	return {
		sessionId,
		prompt: [{ type: "text", text: "Inspect the project" }],
		updates: [
			{ type: "agent_thought_chunk", sessionId, text: "I will " },
			{ type: "agent_thought_chunk", sessionId, text: "inspect it." },
			{ type: "agent_message_chunk", sessionId, text: "Reading " },
			{ type: "agent_message_chunk", sessionId, text: "the files." },
			{
				type: "tool_call",
				sessionId,
				toolCallId: "tool-1",
				title: "Read README",
				kind: "read",
				status: "in_progress",
				rawInput: { path: "README.md" },
			},
			{
				type: "tool_call_update",
				sessionId,
				toolCallId: "tool-1",
				status: "completed",
				rawOutput: { text: "# Project" },
			},
			{
				type: "plan",
				sessionId,
				entries: [
					{
						content: "Inspect project",
						status: "completed",
						priority: "high",
					},
				],
			},
			{
				type: "usage_update",
				sessionId,
				used: 120,
				size: 1000,
			},
			{
				type: "usage_update",
				sessionId,
				used: 180,
				size: 1000,
			},
			{ type: "agent_message_chunk", sessionId, text: "Done." },
		],
		stopReason: "end_turn",
	};
}

export function createInterruptedTurnFixture(
	sessionId = "acp-session-interrupted",
): AcpTurnFixture {
	return {
		sessionId,
		prompt: [{ type: "text", text: "Run the long task" }],
		updates: [
			{ type: "agent_message_chunk", sessionId, text: "Starting." },
			{
				type: "tool_call",
				sessionId,
				toolCallId: "tool-long",
				title: "Long task",
				kind: "execute",
				status: "in_progress",
			},
		],
		stopReason: "",
	};
}
