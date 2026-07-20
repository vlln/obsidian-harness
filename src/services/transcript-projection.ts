import type { ChatMessage, MessageContent, PromptContent } from "../types/chat";
import type { TranscriptItem, TurnRecord } from "../types/transcript";

function projectItem(item: TranscriptItem): MessageContent {
	switch (item.type) {
		case "assistant_message":
			return { type: "text", text: item.text };
		case "thought":
			return { type: "agent_thought", text: item.text };
		case "tool":
			return {
				type: "tool_call",
				toolCallId: item.toolCallId,
				status: item.status,
				...(item.title !== undefined ? { title: item.title } : {}),
				...(item.kind !== undefined ? { kind: item.kind } : {}),
				...(item.content !== undefined
					? { content: item.content }
					: {}),
				...(item.locations !== undefined
					? { locations: item.locations }
					: {}),
				...(item.rawInput !== undefined
					? { rawInput: item.rawInput }
					: {}),
				...(item.rawOutput !== undefined
					? { rawOutput: { ...item.rawOutput } }
					: {}),
				...(item.permissionRequest !== undefined
					? { permissionRequest: item.permissionRequest }
					: {}),
			};
		case "plan":
			return { type: "plan", entries: item.entries };
		case "error":
			return { type: "text", text: `[Agent error: ${item.message}]` };
		case "unknown":
			return {
				type: "text",
				text: `[Unsupported transcript item: ${item.updateType}]`,
			};
	}
}

function projectPromptContent(content: PromptContent): MessageContent {
	switch (content.type) {
		case "text":
		case "image":
		case "resource_link":
			return content;
		case "resource":
			return { type: "text", text: content.resource.text };
	}
}

export function projectTranscript(turns: TurnRecord[]): ChatMessage[] {
	return turns.flatMap((turn) => {
		const timestamp = new Date(turn.startedAt);
		const prompt: ChatMessage = {
			id: `${turn.turnId}:prompt`,
			role: "user",
			content: turn.prompt.map(projectPromptContent),
			timestamp,
		};
		const response: ChatMessage = {
			id: `${turn.turnId}:response`,
			role: "assistant",
			content: turn.items.map(projectItem),
			timestamp: new Date(turn.endedAt ?? turn.startedAt),
		};
		return [prompt, response];
	});
}
