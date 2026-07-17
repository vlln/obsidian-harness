import type { ChatMessage } from "../types/chat";

export function getLatestAssistantText(messages: ChatMessage[]): string | null {
	for (let i = messages.length - 1; i >= 0; i -= 1) {
		const message = messages[i];
		if (message.role !== "assistant") continue;

		const text = message.content
			.flatMap((content) => {
				if (content.type === "text") return [content.text];
				if (content.type === "text_with_context") return [content.text];
				return [];
			})
			.join("\n\n")
			.trim();

		if (text.length > 0) return text;
	}
	return null;
}

export function formatAgentResponseSection(
	response: string,
	now = new Date(),
): string {
	return [
		`## Agent response - ${formatLocalDateTime(now)}`,
		"",
		response.trim(),
		"",
	].join("\n");
}

export function appendMarkdownSection(
	existingContent: string,
	section: string,
): string {
	const trimmedSection = section.trimEnd();
	if (existingContent.length === 0) return `${trimmedSection}\n`;
	const separator = existingContent.endsWith("\n") ? "\n" : "\n\n";
	return `${existingContent}${separator}${trimmedSection}\n`;
}

function formatLocalDateTime(date: Date): string {
	const year = date.getFullYear();
	const month = pad2(date.getMonth() + 1);
	const day = pad2(date.getDate());
	const hours = pad2(date.getHours());
	const minutes = pad2(date.getMinutes());
	return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function pad2(value: number): string {
	return String(value).padStart(2, "0");
}
