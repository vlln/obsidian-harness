/**
 * Domain Models for Agent Configuration
 *
 * These types represent agent settings and configuration,
 * independent of the plugin infrastructure. They define
 * the core concepts of agent identity, capabilities, and
 * connection parameters.
 */

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Environment variable for agent process.
 *
 * Used to pass configuration and credentials to agent processes
 * via environment variables (e.g., API keys, paths, feature flags).
 *
 * Stored as plain text in data.json — never put secrets here.
 */
export interface AgentEnvVar {
	/** Environment variable name (e.g., "ANTHROPIC_API_KEY") */
	key: string;

	/** Environment variable value */
	value: string;
}

// ============================================================================
// Agent Configuration
// ============================================================================

/**
 * Unified configuration for any ACP-compatible agent backend.
 *
 * Single model for all backends (Spec-0008 §4.1): built-in agents are merely
 * prefilled entries in DEFAULT_SETTINGS.agents and are fully isomorphic to
 * user-added entries once loaded.
 *
 * The API key is an optional per-entry capability: when both `apiKeySecretId`
 * and `apiKeyEnvVarName` are set, the secret value is resolved from Obsidian's
 * secret storage and injected into the spawn environment under
 * `apiKeyEnvVarName`. When either is empty, the backend relies on its own
 * login state or manual `env` entries.
 */
export interface AgentSettings {
	/** Unique identifier within the agents[] array (e.g., "claude-code-acp", "custom-agent-2") */
	id: string;

	/** Human-readable display name shown in UI; falls back to `id` when empty */
	displayName: string;

	/** Command to execute (full path to executable or command name); may be empty (unconfigured) */
	command: string;

	/** Command-line arguments passed to the agent */
	args: string[];

	/** Manually configured environment variables (plain text, stored in data.json) */
	env: AgentEnvVar[];

	/**
	 * Reference to the secret storage entry holding the API key.
	 * This is NOT the key itself. Empty string means no key is configured.
	 */
	apiKeySecretId: string;

	/**
	 * Environment variable name used to inject the resolved API key into the
	 * agent process. Takes effect only together with `apiKeySecretId`.
	 */
	apiKeyEnvVarName: string;
}
