import { describe, expect, it } from "vitest";

import {
	buildAgentConfigWithApiKey,
	findAgentSettings,
	getAvailableAgentsFromSettings,
	getCurrentAgent,
	getDefaultAgentId,
	shouldPersistResolvedSessionId,
	shouldPersistResolvedAgentId,
} from "../src/services/session-helpers";
import type { AgentSettings } from "../src/types/agent";
import type { HarnessPluginSettings } from "../src/plugin";

function createAgent(overrides: Partial<AgentSettings> = {}): AgentSettings {
	return {
		id: "claude-code-acp",
		displayName: "Claude Code",
		command: "claude-agent-acp",
		args: [],
		env: [],
		apiKeySecretId: "",
		apiKeyEnvVarName: "",
		...overrides,
	};
}

function createMinimalSettings(): HarnessPluginSettings {
	return {
		agents: [
			createAgent(),
			createAgent({
				id: "codex-acp",
				displayName: "Codex",
				command: "codex-acp",
			}),
			createAgent({
				id: "gemini-cli",
				displayName: "Gemini CLI",
				command: "gemini",
				args: ["--experimental-acp"],
			}),
		],
		defaultAgentId: "claude-code-acp",
		sessionFolder: "Sessions",
		autoAllowPermissions: false,
		autoMentionActiveNote: true,
		enableSystemNotifications: true,
		debugMode: false,
		nodePath: "",
		exportSettings: {
			defaultFolder: "Agent Chats",
			filenameTemplate: "{{date}}-{{title}}",
			autoExportOnNewChat: false,
			autoExportOnCloseChat: false,
			openFileAfterExport: false,
			includeImages: true,
			imageLocation: "obsidian",
			imageCustomFolder: "attachments",
			frontmatterTag: "agent-chat",
		},
		windowsWslMode: false,
		sendMessageShortcut: "enter",
		chatViewLocation: "right-tab",
		displaySettings: {
			autoCollapseDiffs: true,
			diffCollapseThreshold: 20,
			maxNoteLength: 50000,
			maxSelectionLength: 20000,
			showEmojis: true,
			fontSize: null,
		},
		lastUsedModels: {},
		lastUsedModes: {},
		lastUsedConfigOptions: {},
		enableFloatingChat: false,
		floatingButtonImage: "",
		floatingWindowSize: { width: 420, height: 640 },
		floatingWindowPosition: null,
		floatingButtonPosition: null,
	};
}

describe("session restore helpers", () => {
	it("persists the runtime agent id only when the .session file has none", () => {
		expect(shouldPersistResolvedAgentId("", "runtime-acp")).toBe(true);
		expect(shouldPersistResolvedAgentId(undefined, "runtime-acp")).toBe(
			true,
		);
		expect(
			shouldPersistResolvedAgentId("configured-acp", "runtime-acp"),
		).toBe(false);
		expect(shouldPersistResolvedAgentId("", "")).toBe(false);
		expect(shouldPersistResolvedAgentId("", undefined)).toBe(false);
	});

	it("persists resolved session ids only when they change", () => {
		expect(
			shouldPersistResolvedSessionId(
				"local-bootstrap-id",
				"019f70f3-178a-79be-aff7-981f0c1fa6e8",
			),
		).toBe(true);
		expect(
			shouldPersistResolvedSessionId(
				"019f70f3-178a-79be-aff7-981f0c1fa6e8",
				"019f70f3-178a-79be-aff7-981f0c1fa6e8",
			),
		).toBe(false);
		expect(shouldPersistResolvedSessionId("local-bootstrap-id", null)).toBe(
			false,
		);
	});
});

describe("findAgentSettings (unified agents[] lookup)", () => {
	it("finds every configured entry by id, built-in and user-added alike", () => {
		const settings = createMinimalSettings();
		settings.agents.push(createAgent({ id: "my-agent", displayName: "" }));
		expect(findAgentSettings(settings, "claude-code-acp")?.command).toBe(
			"claude-agent-acp",
		);
		expect(findAgentSettings(settings, "codex-acp")?.command).toBe(
			"codex-acp",
		);
		expect(findAgentSettings(settings, "gemini-cli")?.command).toBe(
			"gemini",
		);
		expect(findAgentSettings(settings, "my-agent")?.id).toBe("my-agent");
	});

	it("returns null for unknown ids — no per-backend discovery fallbacks (BR-075)", () => {
		const settings = createMinimalSettings();
		expect(findAgentSettings(settings, "pi-acp")).toBeNull();
		expect(findAgentSettings(settings, "missing")).toBeNull();
	});
});

describe("available/default agent helpers", () => {
	it("maps agents[] directly into display info with displayName fallback to id", () => {
		const settings = createMinimalSettings();
		settings.agents.push(createAgent({ id: "my-agent", displayName: "" }));
		expect(getAvailableAgentsFromSettings(settings)).toEqual([
			{ id: "claude-code-acp", displayName: "Claude Code" },
			{ id: "codex-acp", displayName: "Codex" },
			{ id: "gemini-cli", displayName: "Gemini CLI" },
			{ id: "my-agent", displayName: "my-agent" },
		]);
	});

	it("resolves the default agent id with array-order fallback", () => {
		const settings = createMinimalSettings();
		expect(getDefaultAgentId(settings)).toBe("claude-code-acp");
		settings.defaultAgentId = "";
		expect(getDefaultAgentId(settings)).toBe("claude-code-acp");
		settings.agents = [];
		expect(getDefaultAgentId(settings)).toBe("");
	});

	it("resolves the current agent with graceful fallback for unknown ids", () => {
		const settings = createMinimalSettings();
		expect(getCurrentAgent(settings, "codex-acp")).toEqual({
			id: "codex-acp",
			displayName: "Codex",
		});
		expect(getCurrentAgent(settings, "missing")).toEqual({
			id: "missing",
			displayName: "missing",
		});
	});
});

describe("AC-0030: buildAgentConfigWithApiKey injection intent", () => {
	it("AC-0030-N-1: attaches the injection intent from the entry's own fields — for any entry, not by agentId branch (AR-012-3)", () => {
		const customEntry = createAgent({
			id: "my-agent",
			displayName: "My Agent",
			command: "my-acp",
			env: [{ key: "MY_FLAG", value: "1" }],
			apiKeySecretId: "my-secret",
			apiKeyEnvVarName: "MY_API_KEY",
		});
		const config = buildAgentConfigWithApiKey(customEntry, "/vault");
		expect(config).toEqual({
			id: "my-agent",
			displayName: "My Agent",
			command: "my-acp",
			args: [],
			env: { MY_FLAG: "1" },
			workingDirectory: "/vault",
			apiKey: {
				secretId: "my-secret",
				envVarName: "MY_API_KEY",
			},
		});
	});

	it.each([
		["only apiKeySecretId", { apiKeySecretId: "my-secret" }],
		["only apiKeyEnvVarName", { apiKeyEnvVarName: "MY_API_KEY" }],
		["neither field", {}],
	])(
		"AC-0030-B-1: %s carries no injection intent (BR-072)",
		(_label, overrides) => {
			const entry = createAgent(overrides);
			const config = buildAgentConfigWithApiKey(entry, "/vault");
			expect(config).not.toHaveProperty("apiKey");
		},
	);

	it("AC-0030-B-2: keeps manual env in the config so the spawn-time injection can override the same-named entry (BR-073)", () => {
		const entry = createAgent({
			env: [{ key: "MY_API_KEY", value: "manual-value" }],
			apiKeySecretId: "my-secret",
			apiKeyEnvVarName: "MY_API_KEY",
		});
		const config = buildAgentConfigWithApiKey(entry, "/vault");
		expect(config.env).toEqual({ MY_API_KEY: "manual-value" });
		expect(config.apiKey).toEqual({
			secretId: "my-secret",
			envVarName: "MY_API_KEY",
		});
	});
});
