import { describe, expect, it } from "vitest";

import {
	decideInitialSessionLifecycle,
	findAgentSettings,
	selectPreferredDefaultAgentId,
	shouldPersistResolvedSessionId,
	shouldRestoreInitialSession,
	shouldPersistResolvedAgentId,
	uniqueNonEmpty,
} from "../src/services/session-helpers";
import type { AgentClientPluginSettings } from "../src/plugin";

function createMinimalSettings(): AgentClientPluginSettings {
	return {
		claude: {
			id: "claude-code-acp",
			displayName: "Claude Code",
			apiKeySecretId: "",
			command: "claude-agent-acp",
			args: [],
			env: [],
		},
		codex: {
			id: "codex-acp",
			displayName: "Codex",
			apiKeySecretId: "",
			command: "codex-acp",
			args: [],
			env: [],
		},
		gemini: {
			id: "gemini-cli",
			displayName: "Gemini CLI",
			apiKeySecretId: "",
			command: "gemini",
			args: ["--experimental-acp"],
			env: [],
		},
		customAgents: [],
		defaultAgentId: "claude-code-acp",
		autoAllowPermissions: false,
		autoMentionActiveNote: true,
		enableSystemNotifications: true,
		promptInjection: {
			enabled: true,
			latex: true,
			wikiLinks: true,
			tables: true,
		},
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
		savedSessions: [],
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
	it("restores when both session id and agent id are known", () => {
		expect(
			shouldRestoreInitialSession(
				"019f70f3-178a-79be-aff7-981f0c1fa6e8",
				"pi-acp",
			),
		).toBe(true);
		expect(
			shouldRestoreInitialSession("01JZABCDEFGHJKLMNPQRSTUVWX", "pi-acp"),
		).toBe(true);
		expect(
			shouldRestoreInitialSession(
				"550e8400-e29b-41d4-a716-446655440000",
				"",
			),
		).toBe(false);
		expect(shouldRestoreInitialSession("", "pi-acp")).toBe(false);
	});

	it("persists the runtime agent id only when the .session file has none", () => {
		expect(shouldPersistResolvedAgentId("", "pi-acp")).toBe(true);
		expect(shouldPersistResolvedAgentId(undefined, "pi-acp")).toBe(true);
		expect(shouldPersistResolvedAgentId("claude-code-acp", "pi-acp")).toBe(
			false,
		);
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

	it("decides the initial lifecycle action for session files", () => {
		expect(
			decideInitialSessionLifecycle({
				initialSessionId: "019f70f3-178a-79be-aff7-981f0c1fa6e8",
				initialAgentId: "pi-acp",
				selectedAgentId: undefined,
				restoreStarted: false,
			}),
		).toEqual({
			type: "restore_existing",
			sessionId: "019f70f3-178a-79be-aff7-981f0c1fa6e8",
		});

		expect(
			decideInitialSessionLifecycle({
				initialSessionId: "local-bootstrap-id",
				initialAgentId: "",
				selectedAgentId: "pi-acp",
				restoreStarted: false,
			}),
		).toEqual({ type: "create_new", agentId: "pi-acp" });

		expect(
			decideInitialSessionLifecycle({
				initialSessionId: "local-bootstrap-id",
				initialAgentId: "",
				selectedAgentId: undefined,
				fallbackAgentId: "pi-acp",
				restoreStarted: false,
			}),
		).toEqual({ type: "create_new", agentId: "pi-acp" });

		expect(
			decideInitialSessionLifecycle({
				initialSessionId: "local-bootstrap-id",
				initialAgentId: "",
				selectedAgentId: undefined,
				restoreStarted: false,
			}),
		).toEqual({ type: "wait_for_agent" });

		expect(
			decideInitialSessionLifecycle({
				initialSessionId: "019f70f3-178a-79be-aff7-981f0c1fa6e8",
				initialAgentId: "pi-acp",
				selectedAgentId: "pi-acp",
				restoreStarted: true,
			}),
		).toEqual({ type: "idle" });
	});

	it("resolves auto-discovered pi-acp sessions without custom settings", () => {
		expect(findAgentSettings(createMinimalSettings(), "pi-acp")).toEqual({
			id: "pi-acp",
			displayName: "pi-acp",
			command: "pi-acp",
			args: [],
			env: [],
		});
	});

	it("deduplicates non-empty agent ids", () => {
		expect(uniqueNonEmpty(["", " pi-acp ", "codex-acp", "pi-acp"])).toEqual(
			["pi-acp", "codex-acp"],
		);
	});

	it("prefers discovered backends over the built-in fallback default", () => {
		expect(
			selectPreferredDefaultAgentId({
				currentDefaultId: "claude-code-acp",
				configuredAgentIds: [
					"claude-code-acp",
					"codex-acp",
					"gemini-cli",
				],
				discoveredAgentIds: ["pi-acp"],
				fallbackAgentId: "claude-code-acp",
			}),
		).toBe("pi-acp");
	});

	it("keeps an explicit non-fallback default when it is configured", () => {
		expect(
			selectPreferredDefaultAgentId({
				currentDefaultId: "codex-acp",
				configuredAgentIds: [
					"claude-code-acp",
					"codex-acp",
					"gemini-cli",
				],
				discoveredAgentIds: ["pi-acp"],
				fallbackAgentId: "claude-code-acp",
			}),
		).toBe("codex-acp");
	});

	it("falls back to the first configured agent when no discovered backend exists", () => {
		expect(
			selectPreferredDefaultAgentId({
				currentDefaultId: "missing-agent",
				configuredAgentIds: ["claude-code-acp", "codex-acp"],
				discoveredAgentIds: [],
				fallbackAgentId: "claude-code-acp",
			}),
		).toBe("claude-code-acp");
	});
});
