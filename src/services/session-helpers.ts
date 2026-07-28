/**
 * Pure helper functions for agent session management.
 * Extracted from useSession hook for reusability and testability.
 */

import type { HarnessPluginSettings } from "../plugin";
import type {
	BaseAgentSettings,
	ClaudeAgentSettings,
	GeminiAgentSettings,
	CodexAgentSettings,
} from "../types/agent";
import type { ChatSession } from "../types/session";
import type { ChatMessage } from "../types/chat";
import { toAgentConfig } from "./settings-normalizer";
import { truncateTitle } from "../utils/text";

// ============================================================================
// Types
// ============================================================================

/**
 * Agent information for display.
 * (Inlined from SwitchAgentUseCase)
 */
export interface AgentDisplayInfo {
	/** Unique agent ID */
	id: string;
	/** Display name for UI */
	displayName: string;
}

export function uniqueNonEmpty(
	values: Array<string | null | undefined>,
): string[] {
	return Array.from(
		new Set(values.map((value) => value?.trim() ?? "").filter(Boolean)),
	);
}

export function selectPreferredDefaultAgentId({
	currentDefaultId,
	configuredAgentIds,
	discoveredAgentIds,
	fallbackAgentId,
}: {
	currentDefaultId: string | null | undefined;
	configuredAgentIds: string[];
	discoveredAgentIds: string[];
	fallbackAgentId: string;
}): string {
	const configured = uniqueNonEmpty(configuredAgentIds);
	const discovered = uniqueNonEmpty(discoveredAgentIds);
	const current = currentDefaultId?.trim() ?? "";

	if (current && discovered.includes(current)) return current;
	if (
		current &&
		current !== fallbackAgentId &&
		configured.includes(current)
	) {
		return current;
	}
	if (discovered.length > 0) return discovered[0];
	if (current && configured.includes(current)) return current;
	return configured[0] ?? fallbackAgentId;
}

/**
 * New .session files are created before the user/backend choice is resolved.
 * Once the runtime session has a concrete agentId, persist it exactly once so
 * future session/load calls use the same backend instead of guessing defaults.
 */
export function shouldPersistResolvedAgentId(
	storedAgentId: string | null | undefined,
	resolvedAgentId: string | null | undefined,
): boolean {
	return Boolean(!storedAgentId && resolvedAgentId);
}

/**
 * ACP session IDs are opaque. Restore is valid only after session/new has
 * produced a backend session id and the .session file has recorded it.
 */
export function shouldPersistResolvedSessionId(
	initialBackendSessionId: string | null | undefined,
	resolvedSessionId: string | null | undefined,
): boolean {
	return Boolean(
		resolvedSessionId && resolvedSessionId !== initialBackendSessionId,
	);
}

// ============================================================================
// Helper Functions (Inlined from SwitchAgentUseCase)
// ============================================================================

/**
 * Get the default agent ID from settings (for new views).
 */
export function getDefaultAgentId(settings: HarnessPluginSettings): string {
	return settings.defaultAgentId || settings.claude.id;
}

/**
 * Get list of all available agents from settings.
 */
export function getAvailableAgentsFromSettings(
	settings: HarnessPluginSettings,
): AgentDisplayInfo[] {
	return [
		{
			id: settings.claude.id,
			displayName: settings.claude.displayName || settings.claude.id,
		},
		{
			id: settings.codex.id,
			displayName: settings.codex.displayName || settings.codex.id,
		},
		{
			id: settings.gemini.id,
			displayName: settings.gemini.displayName || settings.gemini.id,
		},
		...settings.customAgents.map((agent) => ({
			id: agent.id,
			displayName: agent.displayName || agent.id,
		})),
	];
}

/**
 * Get the currently active agent information from settings.
 */
export function getCurrentAgent(
	settings: HarnessPluginSettings,
	agentId?: string,
): AgentDisplayInfo {
	const activeId = agentId || getDefaultAgentId(settings);
	const agents = getAvailableAgentsFromSettings(settings);
	return (
		agents.find((agent) => agent.id === activeId) || {
			id: activeId,
			displayName: activeId,
		}
	);
}

// ============================================================================
// Helper Functions (Inlined from ManageSessionUseCase)
// ============================================================================

/**
 * Find agent settings by ID from plugin settings.
 */
export function findAgentSettings(
	settings: HarnessPluginSettings,
	agentId: string,
): BaseAgentSettings | null {
	if (agentId === settings.claude.id) {
		return settings.claude;
	}
	if (agentId === settings.codex.id) {
		return settings.codex;
	}
	if (agentId === settings.gemini.id) {
		return settings.gemini;
	}
	// Search in custom agents
	const customAgent = settings.customAgents.find(
		(agent) => agent.id === agentId,
	);
	if (customAgent) return customAgent;

	// Auto-discovered pi-acp: use pi Node.js npx path
	// (Electron does not inherit the user PATH, so npx is not found)
	if (agentId === "pi-acp") {
		return {
			id: "pi-acp",
			displayName: "pi-acp",
			command: "pi-acp",
			args: [],
			env: [],
		};
	}

	return null;
}

/**
 * Build AgentConfig with API key injection intent for known agents.
 *
 * For built-in agents, attaches an `apiKey` intent (secretId + envVarName)
 * to the config. AcpClient.initialize() resolves the secret value from
 * Obsidian's secret storage just before spawn.
 *
 * Custom agents pass through unchanged (they manage env vars directly).
 */
export function buildAgentConfigWithApiKey(
	settings: HarnessPluginSettings,
	agentSettings: BaseAgentSettings,
	agentId: string,
	workingDirectory: string,
) {
	const baseConfig = toAgentConfig(agentSettings, workingDirectory);

	if (agentId === settings.claude.id) {
		const claudeSettings = agentSettings as ClaudeAgentSettings;
		return {
			...baseConfig,
			apiKey: {
				secretId: claudeSettings.apiKeySecretId,
				envVarName: "ANTHROPIC_API_KEY",
			},
		};
	}
	if (agentId === settings.codex.id) {
		const codexSettings = agentSettings as CodexAgentSettings;
		return {
			...baseConfig,
			apiKey: {
				secretId: codexSettings.apiKeySecretId,
				envVarName: "OPENAI_API_KEY",
			},
		};
	}
	if (agentId === settings.gemini.id) {
		const geminiSettings = agentSettings as GeminiAgentSettings;
		return {
			...baseConfig,
			apiKey: {
				secretId: geminiSettings.apiKeySecretId,
				envVarName: "GEMINI_API_KEY",
			},
		};
	}

	// Custom agents — no API key injection
	return baseConfig;
}

// ============================================================================
// Initial State
// ============================================================================

/**
 * Create initial session state.
 */
export function createInitialSession(
	agentId: string,
	agentDisplayName: string,
	workingDirectory: string,
): ChatSession {
	return {
		sessionId: null,
		state: "disconnected",
		agentId,
		agentDisplayName,
		authMethods: [],
		availableCommands: undefined,
		modes: undefined,
		createdAt: new Date(),
		lastActivityAt: new Date(),
		workingDirectory,
	};
}

// ============================================================================
// Session Title Derivation
// ============================================================================

/** Derive the session display title from the first user message. */
export function computeSessionTitle(messages: ChatMessage[]): string {
	const firstUserMessage = messages.find((m) => m.role === "user");
	if (firstUserMessage) {
		const textContent = firstUserMessage.content.find(
			(c) => c.type === "text" || c.type === "text_with_context",
		);
		if (textContent && "text" in textContent) {
			return truncateTitle(textContent.text);
		}
	}
	return "New session";
}
