import type { SessionFileData } from "../types/session";

export const SESSION_ENTRY_VERSION = 2 as const;

export class UnsupportedSessionEntryVersionError extends Error {
	constructor(readonly actualVersion: number) {
		super(
			`Unsupported session version ${actualVersion}; requires version ${SESSION_ENTRY_VERSION}`,
		);
		this.name = "UnsupportedSessionEntryVersionError";
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseSessionFileData(content: string): SessionFileData {
	const value = JSON.parse(content) as unknown;
	if (!isRecord(value)) throw new Error("Session entry must be an object");
	if (typeof value.version === "number" && value.version !== 2) {
		throw new UnsupportedSessionEntryVersionError(value.version);
	}
	if (value.version !== 2)
		throw new Error("Session entry requires version 2");
	for (const field of [
		"entryId",
		"historyId",
		"agentId",
		"cwd",
		"title",
		"createdAt",
		"updatedAt",
	]) {
		if (typeof value[field] !== "string") {
			throw new Error(`Session entry field ${field} must be a string`);
		}
	}
	if (value.acpBinding !== undefined) {
		if (
			!isRecord(value.acpBinding) ||
			typeof value.acpBinding.agentId !== "string" ||
			typeof value.acpBinding.sessionId !== "string"
		) {
			throw new Error("Session entry ACP binding is invalid");
		}
	}
	if (value.forkedFrom !== null && typeof value.forkedFrom !== "string") {
		throw new Error("Session entry field forkedFrom must be a string or null");
	}
	return value as unknown as SessionFileData;
}
