import type { ChatMessage, MessageContent } from "../types/chat";

export interface TurnNavigationItem {
	messageId: string;
	messageIndex: number;
	preview: string;
	ordinal: number;
}

const MAX_PREVIEW_LENGTH = 160;

function contentPreview(content: MessageContent): string | null {
	switch (content.type) {
		case "text":
		case "text_with_context":
			return content.text;
		case "image": {
			const subtype = content.mimeType.split("/")[1];
			return subtype ? `[Image: ${subtype}]` : "[Image]";
		}
		case "resource_link":
			return `[Attachment: ${content.name || content.mimeType || "file"}]`;
		case "terminal":
			return "[Terminal]";
		default:
			return null;
	}
}

export function createTurnPreview(message: ChatMessage): string {
	const normalized = message.content
		.map(contentPreview)
		.filter((value): value is string => Boolean(value))
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
	const preview = normalized || "[Message]";
	return Array.from(preview).slice(0, MAX_PREVIEW_LENGTH).join("");
}

export function deriveTurnNavigation(
	messages: readonly ChatMessage[],
): TurnNavigationItem[] {
	const items: TurnNavigationItem[] = [];
	for (let messageIndex = 0; messageIndex < messages.length; messageIndex++) {
		const message = messages[messageIndex];
		if (message.role !== "user") continue;
		items.push({
			messageId: message.id,
			messageIndex,
			preview: createTurnPreview(message),
			ordinal: items.length + 1,
		});
	}
	return items;
}

export function getActiveTurnMessageId(
	items: readonly TurnNavigationItem[],
	anchorMessageIndex: number,
): string | null {
	if (items.length === 0) return null;
	let active = items[0];
	for (const item of items) {
		if (item.messageIndex > anchorMessageIndex) break;
		active = item;
	}
	return active.messageId;
}

export function isCurrentTurnNavigationTarget(
	messages: readonly ChatMessage[],
	item: TurnNavigationItem,
): boolean {
	return messages[item.messageIndex]?.id === item.messageId;
}
