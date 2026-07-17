/**
 * Pure helper functions for agent session management.
 * Extracted from useSession hook for reusability and testability.
 */

import type { AgentClientPluginSettings } from "../plugin";
import type {
	BaseAgentSettings,
	ClaudeAgentSettings,
	GeminiAgentSettings,
	CodexAgentSettings,
} from "../types/agent";
import type { ChatSession, SavedSessionInfo } from "../types/session";
import type { ChatMessage } from "../types/chat";
import { toAgentConfig } from "./settings-normalizer";
import { truncateTitle } from "../utils/text";
import type { AgentUpdateNotification } from "./update-checker";

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
	if (current && current !== fallbackAgentId && configured.includes(current)) {
		return current;
	}
	if (discovered.length > 0) return discovered[0];
	if (current && configured.includes(current)) return current;
	return configured[0] ?? fallbackAgentId;
}

export type InitialSessionLifecycleAction =
	| { type: "idle" }
	| { type: "wait_for_agent" }
	| { type: "restore_existing"; sessionId: string }
	| { type: "create_new"; agentId: string };

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
 * ACP session IDs are opaque. Some backends use ULIDs, pi-acp uses UUID-like
 * IDs, and clients must not infer local-vs-remote state from string shape.
 * Once a .session file has both a sessionId and agentId, try session/load and
 * fall back to session/new if the backend rejects it.
 */
export function shouldRestoreInitialSession(
	sessionId: string | null | undefined,
	agentId: string | null | undefined,
): boolean {
	return Boolean(sessionId && agentId);
}

/**
 * Decide the first lifecycle action for a ChatPanel opened from either a
 * normal chat view or a .session file. This keeps restore/create decisions
 * consistent across React effects.
 */
export function decideInitialSessionLifecycle({
	initialSessionId,
	initialAgentId,
	selectedAgentId,
	restoreStarted,
}: {
	initialSessionId: string | null | undefined;
	initialAgentId: string | null | undefined;
	selectedAgentId: string | null | undefined;
	restoreStarted: boolean;
}): InitialSessionLifecycleAction {
	if (restoreStarted) return { type: "idle" };
	if (initialSessionId && initialAgentId) {
		return { type: "restore_existing", sessionId: initialSessionId };
	}
	const agentId = selectedAgentId || initialAgentId;
	if (!agentId) return { type: "wait_for_agent" };
	return { type: "create_new", agentId };
}

export function shouldPersistResolvedSessionId(
	initialSessionId: string | null | undefined,
	resolvedSessionId: string | null | undefined,
): boolean {
	return Boolean(resolvedSessionId && resolvedSessionId !== initialSessionId);
}

// ============================================================================
// Helper Functions (Inlined from SwitchAgentUseCase)
// ============================================================================

/**
 * Get the default agent ID from settings (for new views).
 */
export function getDefaultAgentId(settings: AgentClientPluginSettings): string {
	return settings.defaultAgentId || settings.claude.id;
}

/**
 * Get list of all available agents from settings.
 */
export function getAvailableAgentsFromSettings(
	settings: AgentClientPluginSettings,
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
	settings: AgentClientPluginSettings,
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
	settings: AgentClientPluginSettings,
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
	settings: AgentClientPluginSettings,
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

/** Derive the session display title (saved title > first user message > "New session"). */
export function computeSessionTitle(
	sessionId: string | null,
	savedSessions: SavedSessionInfo[],
	messages: ChatMessage[],
): string {
	if (sessionId) {
		const saved = savedSessions.find((s) => s.sessionId === sessionId);
		if (saved?.title) return saved.title;
	}
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

// ============================================================================
// Gemini CLI Deprecation Notice
// ============================================================================

/** Docs URL for the Gemini CLI deprecation announcement. */
export const GEMINI_DEPRECATION_DOCS_URL =
	"https://rait-09.github.io/obsidian-agent-client/announcements/gemini-cli-deprecation.html";

/**
 * Build the in-app notice shown while the Gemini CLI agent is selected.
 *
 * Google is retiring Gemini CLI for account-login (Pro/Ultra/free) tiers on
 * June 18, 2026. This notice is static (no network) and is driven purely by the
 * active agent id, unlike the npm-registry-backed agent update check.
 */
export function buildGeminiDeprecationNotice(): AgentUpdateNotification {
	return {
		variant: "info",
		title: "Gemini CLI is being discontinued",
		message:
			"Google is retiring account login for Gemini CLI (Pro/Ultra/free tiers) on June 18, 2026. " +
			"Google states Gemini CLI stays accessible via a paid Gemini API key — see the guide for setup and privacy notes.",
		link: { text: "Learn more", url: GEMINI_DEPRECATION_DOCS_URL },
	};
}
