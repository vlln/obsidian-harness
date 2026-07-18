import type { ToolCallLocation } from "../types/chat";
import { toRelativePath } from "../utils/paths";

export const DEFAULT_TOOL_SUMMARY_LIMIT = 96;

export function formatThoughtDuration(
	startedAt: string | null | undefined,
	updatedAt: string | null | undefined,
): string {
	const start = startedAt ? Date.parse(startedAt) : NaN;
	const end = updatedAt ? Date.parse(updatedAt) : NaN;
	if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
		return "0s";
	}
	const seconds = Math.max(0, Math.round((end - start) / 1000));
	return `${seconds}s`;
}

export function truncateMiddle(text: string, maxChars: number): string {
	const normalized = text.replace(/\s+/g, " ").trim();
	if (normalized.length <= maxChars) return normalized;
	if (maxChars <= 1) return "…";
	const headLength = Math.ceil((maxChars - 1) * 0.65);
	const tailLength = Math.max(0, maxChars - 1 - headLength);
	return `${normalized.slice(0, headLength)}…${normalized.slice(-tailLength)}`;
}

function stringifyScalar(value: unknown): string {
	if (typeof value === "string") return value.trim();
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return "";
}

export function stableStringify(value: unknown): string {
	if (value === undefined) return "";
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(sortJsonValue(value), null, 2);
	} catch {
		if (typeof value === "number" || typeof value === "boolean") {
			return String(value);
		}
		return "";
	}
}

function sortJsonValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortJsonValue);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, item]) => [key, sortJsonValue(item)]),
		);
	}
	return value;
}

export function formatToolPayload(value: unknown): string {
	return stableStringify(value).trim();
}

export function summarizeToolInput({
	rawInput,
	locations,
	vaultPath,
	maxChars = DEFAULT_TOOL_SUMMARY_LIMIT,
}: {
	rawInput?: Record<string, unknown>;
	locations?: ToolCallLocation[];
	vaultPath: string;
	maxChars?: number;
}): string {
	let summary = "";
	if (rawInput) {
		const command = stringifyScalar(rawInput.command);
		const args = Array.isArray(rawInput.args)
			? rawInput.args.map(stringifyScalar).filter(Boolean).join(" ")
			: "";
		if (command) summary = `$ ${[command, args].filter(Boolean).join(" ")}`;

		if (!summary) {
			const path =
				stringifyScalar(rawInput.path) ||
				stringifyScalar(rawInput.file_path) ||
				stringifyScalar(rawInput.filePath);
			if (path) summary = toRelativePath(path, vaultPath);
		}

		if (!summary) {
			const query =
				stringifyScalar(rawInput.query) ||
				stringifyScalar(rawInput.pattern);
			if (query) summary = query;
		}

		if (!summary) summary = formatToolPayload(rawInput);
	}

	if (!summary && locations && locations.length > 0) {
		const loc = locations[0];
		const suffix = loc.line != null ? `:${loc.line}` : "";
		const extra = locations.length > 1 ? ` +${locations.length - 1}` : "";
		summary = `${toRelativePath(loc.path, vaultPath)}${suffix}${extra}`;
	}

	return truncateMiddle(summary, maxChars);
}
