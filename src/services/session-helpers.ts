/**
 * Pure helper functions for agent session management.
 * Extracted from useSession hook for reusability and testability.
 */

import type { HarnessPluginSettings } from "../plugin";
import type { AgentSettings } from "../types/agent";
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
	return settings.defaultAgentId || settings.agents[0]?.id || "";
}

/**
 * Get list of all available agents from settings.
 */
export function getAvailableAgentsFromSettings(
	settings: HarnessPluginSettings,
): AgentDisplayInfo[] {
	return settings.agents.map((agent) => ({
		id: agent.id,
		displayName: agent.displayName || agent.id,
	}));
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
 *
 * Plain array lookup over the unified agents[] model — built-in and
 * user-added entries are isomorphic (BR-068), and there are no
 * per-backend discovery fallbacks (BR-075).
 */
export function findAgentSettings(
	settings: HarnessPluginSettings,
	agentId: string,
): AgentSettings | null {
	return settings.agents.find((agent) => agent.id === agentId) ?? null;
}

/**
 * Build AgentConfig with an optional API key injection intent.
 *
 * The decision depends only on the entry's own fields (AR-012-3): when both
 * `apiKeySecretId` and `apiKeyEnvVarName` are set, an `apiKey` intent is
 * attached and AcpClient.initialize() resolves the secret value from
 * Obsidian's secret storage just before spawn, overriding any same-named
 * manual `env` entry (BR-072/BR-073). Otherwise the backend relies on its
 * own login state or manual env vars.
 */
export function buildAgentConfigWithApiKey(
	agentSettings: AgentSettings,
	workingDirectory: string,
) {
	const baseConfig = toAgentConfig(agentSettings, workingDirectory);

	if (
		agentSettings.apiKeySecretId.length > 0 &&
		agentSettings.apiKeyEnvVarName.length > 0
	) {
		return {
			...baseConfig,
			apiKey: {
				secretId: agentSettings.apiKeySecretId,
				envVarName: agentSettings.apiKeyEnvVarName,
			},
		};
	}

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
