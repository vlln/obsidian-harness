/**
 * Settings normalization and validation utilities.
 *
 * Pure functions for validating and normalizing plugin settings values.
 * Used by plugin.ts (loadSettings) and SettingsTab.ts.
 */

import type { AgentEnvVar, AgentSettings } from "../types/agent";
import type { AgentConfig } from "../acp/acp-client";

// ============================================================================
// Display Settings
// ============================================================================

export const CHAT_FONT_SIZE_MIN = 10;
export const CHAT_FONT_SIZE_MAX = 30;

export const parseChatFontSize = (value: unknown): number | null => {
	if (value === null || value === undefined) {
		return null;
	}

	const numericValue = (() => {
		if (typeof value === "number") {
			return value;
		}

		if (typeof value === "string") {
			const trimmedValue = value.trim();
			if (trimmedValue.length === 0) {
				return Number.NaN;
			}
			if (!/^-?\d+$/.test(trimmedValue)) {
				return Number.NaN;
			}
			return Number.parseInt(trimmedValue, 10);
		}

		return Number.NaN;
	})();

	if (!Number.isFinite(numericValue)) {
		return null;
	}

	return Math.min(
		CHAT_FONT_SIZE_MAX,
		Math.max(CHAT_FONT_SIZE_MIN, Math.round(numericValue)),
	);
};

// ============================================================================
// Settings Utilities
// ============================================================================

export const sanitizeArgs = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		return value
			.map((item) => (typeof item === "string" ? item.trim() : ""))
			.filter((item) => item.length > 0);
	}
	if (typeof value === "string") {
		return value
			.split(/\r?\n/)
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
	}
	return [];
};

// Convert stored env structures into a deduplicated list
export const normalizeEnvVars = (value: unknown): AgentEnvVar[] => {
	const pairs: AgentEnvVar[] = [];
	if (!value) {
		return pairs;
	}

	if (Array.isArray(value)) {
		for (const entry of value) {
			if (entry && typeof entry === "object") {
				// Type guard: check if entry has key and value properties
				const entryObj = entry as Record<string, unknown>;
				const key = "key" in entryObj ? entryObj.key : undefined;
				const val = "value" in entryObj ? entryObj.value : undefined;
				if (typeof key === "string" && key.trim().length > 0) {
					pairs.push({
						key: key.trim(),
						value: typeof val === "string" ? val : "",
					});
				}
			}
		}
	} else if (typeof value === "object") {
		for (const [key, val] of Object.entries(
			value as Record<string, unknown>,
		)) {
			if (typeof key === "string" && key.trim().length > 0) {
				pairs.push({
					key: key.trim(),
					value: typeof val === "string" ? val : "",
				});
			}
		}
	}

	const seen = new Set<string>();
	return pairs.filter((pair) => {
		if (seen.has(pair.key)) {
			return false;
		}
		seen.add(pair.key);
		return true;
	});
};

// ============================================================================
// Agent Settings (Spec-0008 §4)
// ============================================================================

/**
 * Built-in default agent entries (Spec-0008 §4.3).
 *
 * These are plain AgentSettings entries — after loading they are fully
 * isomorphic to user-added entries (BR-068). Adding a new built-in backend
 * only requires appending an entry here.
 */
export const DEFAULT_AGENT_SETTINGS: AgentSettings[] = [
	{
		id: "claude-code-acp",
		displayName: "Claude Code",
		command: "claude-agent-acp",
		args: [],
		env: [],
		apiKeySecretId: "",
		apiKeyEnvVarName: "ANTHROPIC_API_KEY",
	},
	{
		id: "codex-acp",
		displayName: "Codex",
		command: "codex-acp",
		args: [],
		env: [],
		apiKeySecretId: "",
		apiKeyEnvVarName: "OPENAI_API_KEY",
	},
	{
		id: "gemini-cli",
		displayName: "Gemini CLI",
		command: "gemini",
		args: ["--experimental-acp"],
		env: [],
		apiKeySecretId: "",
		apiKeyEnvVarName: "GEMINI_API_KEY",
	},
	{
		id: "pi-acp",
		displayName: "Pi",
		command: "pi-acp",
		args: [],
		env: [],
		apiKeySecretId: "",
		apiKeyEnvVarName: "",
	},
];

// Rebuild an agent entry with per-field defaults and cleaned values.
// Wrong-typed or missing fields fall back individually ("" / []) — the
// entry itself is always kept (Spec-0008 §7).
export const normalizeAgentEntry = (
	agent: Record<string, unknown>,
): AgentSettings => ({
	id: str(agent.id, "").trim(),
	displayName: str(agent.displayName, "").trim(),
	command: str(agent.command, "").trim(),
	args: sanitizeArgs(agent.args),
	env: normalizeEnvVars(agent.env),
	apiKeySecretId: str(agent.apiKeySecretId, "").trim(),
	apiKeyEnvVarName: str(agent.apiKeyEnvVarName, "").trim(),
});

const copyAgentSettings = (agent: AgentSettings): AgentSettings => ({
	...agent,
	args: [...agent.args],
	env: agent.env.map((entry) => ({ ...entry })),
});

/**
 * Generate an id of the form `custom-agent-N` that is not occupied in the
 * given collection (BR-069). Used when the user clears an id in the editor
 * and when a loaded entry has an empty/missing id.
 */
export const generateUnoccupiedAgentId = (
	agents: ReadonlyArray<{ id: string }>,
	base = "custom-agent",
): string => {
	const existing = new Set(agents.map((agent) => agent.id));
	if (!existing.has(base)) {
		return base;
	}
	let counter = 2;
	let candidate = `${base}-${counter}`;
	while (existing.has(candidate)) {
		counter += 1;
		candidate = `${base}-${counter}`;
	}
	return candidate;
};

/**
 * Normalize the persisted `agents` value into the unified model (AC-0028).
 *
 * - Non-array values fall back to a deep copy of `fallback` (built-in defaults).
 * - Each entry is normalized per-field; empty/missing ids are regenerated as
 *   unoccupied `custom-agent-N` ids.
 * - Duplicate ids keep the first entry; later duplicates are dropped (BR-069).
 *
 * Legacy schema fields (claude/codex/gemini/customAgents/plaintext apiKey)
 * are never read here — the caller passes only `raw.agents` (BR-074).
 */
export const normalizeAgents = (
	raw: unknown,
	fallback: AgentSettings[],
): AgentSettings[] => {
	if (!Array.isArray(raw)) {
		return fallback.map(copyAgentSettings);
	}
	const result: AgentSettings[] = [];
	const seen = new Set<string>();
	for (const entry of raw) {
		const normalized = normalizeAgentEntry(obj(entry) ?? {});
		let id = normalized.id;
		if (id.length === 0) {
			id = generateUnoccupiedAgentId(result);
		}
		if (seen.has(id)) {
			continue;
		}
		seen.add(id);
		result.push({ ...normalized, id });
	}
	return result;
};

/**
 * Resolve `defaultAgentId` against the agents[] array (BR-070): a valid
 * reference is kept, a dangling one falls back to the first entry, and an
 * empty array yields "".
 */
export const resolveDefaultAgentId = (
	currentDefaultId: unknown,
	agents: AgentSettings[],
): string => {
	const current = str(currentDefaultId, "").trim();
	if (current.length > 0 && agents.some((agent) => agent.id === current)) {
		return current;
	}
	return agents[0]?.id ?? "";
};

/**
 * Convert AgentSettings to AgentConfig for process execution.
 *
 * Transforms the storage format (AgentSettings) to the runtime format (AgentConfig)
 * needed by AcpClient.initialize().
 */
export const toAgentConfig = (
	settings: AgentSettings,
	workingDirectory: string,
): AgentConfig => {
	// Convert AgentEnvVar[] to Record<string, string> for process.spawn()
	const env = settings.env.reduce(
		(acc, { key, value }) => {
			acc[key] = value;
			return acc;
		},
		{} as Record<string, string>,
	);

	return {
		id: settings.id,
		displayName: settings.displayName,
		command: settings.command,
		args: settings.args,
		env,
		workingDirectory,
	};
};

// ============================================================================
// Settings Loading Helpers
// ============================================================================

/** Extract a string value, falling back to default if not a string */
export function str(raw: unknown, fallback: string): string {
	return typeof raw === "string" ? raw : fallback;
}

/** Extract a boolean value, falling back to default if not a boolean */
export function bool(raw: unknown, fallback: boolean): boolean {
	return typeof raw === "boolean" ? raw : fallback;
}

/** Extract a number value with optional minimum, falling back to default */
export function num(raw: unknown, fallback: number, min?: number): number {
	if (typeof raw !== "number") return fallback;
	if (min !== undefined && raw < min) return fallback;
	return raw;
}

/** Extract a value that must be one of the valid options */
export function enumVal<T extends string>(
	raw: unknown,
	valid: T[],
	fallback: T,
): T {
	return valid.includes(raw as T) ? (raw as T) : fallback;
}

/** Extract a plain object, or return null */
export function obj(raw: unknown): Record<string, unknown> | null {
	return raw && typeof raw === "object" && !Array.isArray(raw)
		? (raw as Record<string, unknown>)
		: null;
}

/** Extract a Record<string, string> with validated entries */
export function strRecord(raw: unknown): Record<string, string> {
	const result: Record<string, string> = {};
	const o = obj(raw);
	if (!o) return result;
	for (const [key, value] of Object.entries(o)) {
		if (
			typeof key === "string" &&
			key.length > 0 &&
			typeof value === "string" &&
			value.length > 0
		) {
			result[key] = value;
		}
	}
	return result;
}

/** Normalize a nested string record, e.g. agentId → { optionId → value }. */
export function nestedStrRecord(
	raw: unknown,
): Record<string, Record<string, string>> {
	const result: Record<string, Record<string, string>> = {};
	const o = obj(raw);
	if (!o) return result;
	for (const [key, value] of Object.entries(o)) {
		if (
			typeof key === "string" &&
			key.length > 0 &&
			key !== "__proto__" &&
			key !== "constructor"
		) {
			result[key] = strRecord(value);
		}
	}
	return result;
}

/** Extract an {x, y} point, or return null if invalid */
export function xyPoint(raw: unknown): { x: number; y: number } | null {
	const o = obj(raw);
	if (!o || typeof o.x !== "number" || typeof o.y !== "number") return null;
	return { x: o.x, y: o.y };
}
