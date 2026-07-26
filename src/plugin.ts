import {
	Plugin,
	WorkspaceLeaf,
	Notice,
	requestUrl,
	TFile,
	TAbstractFile,
	normalizePath,
	FileSystemAdapter,
	Menu,
} from "obsidian";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import * as semver from "semver";
import { ChatView, VIEW_TYPE_CHAT } from "./ui/ChatView";
import {
	HarnessSessionView,
	VIEW_TYPE_HARNESS_SESSION,
} from "./ui/HarnessSessionView";
import {
	SessionManagerView,
	VIEW_TYPE_SESSION_MANAGER,
} from "./ui/SessionManagerView";
import {
	createFloatingChat,
	FloatingViewContainer,
} from "./ui/FloatingChatView";
import { FloatingButtonContainer } from "./ui/FloatingButton";
import {
	ChatViewRegistry,
	SessionRuntimeRegistry,
} from "./services/view-registry";
import { SessionCatalogService } from "./services/session-catalog";
import {
	createSettingsService,
	type SettingsService,
} from "./services/settings-service";
import { AgentClientSettingTab } from "./ui/SettingsTab";
import { AcpClient } from "./acp/acp-client";
import {
	sanitizeArgs,
	normalizeEnvVars,
	normalizeCustomAgent,
	ensureUniqueCustomAgentIds,
	parseChatFontSize,
	str,
	bool,
	num,
	enumVal,
	obj,
	strRecord,
	nestedStrRecord,
	xyPoint,
} from "./services/settings-normalizer";
import {
	selectPreferredDefaultAgentId,
	uniqueNonEmpty,
} from "./services/session-helpers";
import { resolveSessionFolderFromFileMenuTarget } from "./services/session-entry-target";
import { parseSessionFileData } from "./services/session-entry";
import {
	isSessionEntryPath,
	reconcileSessionEntryIndex,
} from "./services/session-index-lifecycle";
import { getSessionRenameTarget } from "./services/session-navigator";
import {
	AgentEnvVar,
	GeminiAgentSettings,
	ClaudeAgentSettings,
	CodexAgentSettings,
	CustomAgentSettings,
} from "./types/agent";
import type { SessionFileData, SessionIndexEntry } from "./types/session";
import { initializeLogger, getLogger } from "./utils/logger";

const PLUGIN_RELEASE_REPO = "vlln/obsidian-harness-frontend";

// Re-export for backward compatibility
export type { AgentEnvVar, CustomAgentSettings };

/**
 * Send message shortcut configuration.
 * - 'enter': Enter to send, Shift+Enter for newline (default)
 * - 'cmd-enter': Cmd/Ctrl+Enter to send, Enter for newline
 */
export type SendMessageShortcut = "enter" | "cmd-enter";

/**
 * Chat view location configuration.
 * - 'right-tab': Open in right pane as tabs (default)
 * - 'right-split': Open in right pane with vertical split
 * - 'editor-tab': Open in editor area as tabs
 * - 'editor-split': Open in editor area with right split
 */
export type ChatViewLocation =
	| "right-tab"
	| "right-split"
	| "editor-tab"
	| "editor-split";

export interface AgentClientPluginSettings {
	gemini: GeminiAgentSettings;
	claude: ClaudeAgentSettings;
	codex: CodexAgentSettings;
	customAgents: CustomAgentSettings[];
	/** Default agent ID for new views (renamed from activeAgentId for multi-session) */
	defaultAgentId: string;
	/** Vault-relative folder where default .session files are created */
	sessionFolder: string;
	autoAllowPermissions: boolean;
	autoMentionActiveNote: boolean;
	/** Show OS system notifications on response completion and permission requests */
	enableSystemNotifications: boolean;
	debugMode: boolean;
	nodePath: string;
	exportSettings: {
		defaultFolder: string;
		filenameTemplate: string;
		autoExportOnNewChat: boolean;
		autoExportOnCloseChat: boolean;
		openFileAfterExport: boolean;
		includeImages: boolean;
		imageLocation: "obsidian" | "custom" | "base64";
		imageCustomFolder: string;
		frontmatterTag: string;
	};
	// WSL settings (Windows only)
	windowsWslMode: boolean;
	windowsWslDistribution?: string;
	// Input behavior
	sendMessageShortcut: SendMessageShortcut;
	// View settings
	chatViewLocation: ChatViewLocation;
	// Display settings
	displaySettings: {
		autoCollapseDiffs: boolean;
		diffCollapseThreshold: number;
		maxNoteLength: number;
		maxSelectionLength: number;
		showEmojis: boolean;
		fontSize: number | null;
	};
	// Last used model per agent (agentId → modelId)
	lastUsedModels: Record<string, string>;
	// Last used mode per agent (agentId → modeId)
	lastUsedModes: Record<string, string>;
	// Last used non-model/mode config options per agent (agentId → {optionId → value})
	lastUsedConfigOptions: Record<string, Record<string, string>>;
	// Floating chat settings
	enableFloatingChat: boolean;
	floatingButtonImage: string;
	floatingWindowSize: { width: number; height: number };
	floatingWindowPosition: { x: number; y: number } | null;
	floatingButtonPosition: { x: number; y: number } | null;
}

const DEFAULT_SETTINGS: AgentClientPluginSettings = {
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
	sessionFolder: "Sessions",
	autoAllowPermissions: false,
	autoMentionActiveNote: true,
	enableSystemNotifications: true,
	debugMode: false,
	nodePath: "",
	exportSettings: {
		defaultFolder: "Agent Client",
		filenameTemplate: "agent_client_{date}_{time}",
		autoExportOnNewChat: false,
		autoExportOnCloseChat: false,
		openFileAfterExport: true,
		includeImages: true,
		imageLocation: "obsidian",
		imageCustomFolder: "Agent Client",
		frontmatterTag: "agent-client",
	},
	windowsWslMode: false,
	windowsWslDistribution: undefined,
	sendMessageShortcut: "enter",
	chatViewLocation: "right-tab",
	displaySettings: {
		autoCollapseDiffs: false,
		diffCollapseThreshold: 10,
		maxNoteLength: 10000,
		maxSelectionLength: 10000,
		showEmojis: true,
		fontSize: null,
	},
	lastUsedModels: {},
	lastUsedModes: {},
	lastUsedConfigOptions: {},
	enableFloatingChat: false,
	floatingButtonImage: "",
	floatingWindowSize: { width: 400, height: 500 },
	floatingWindowPosition: null,
	floatingButtonPosition: null,
};

export default class AgentClientPlugin extends Plugin {
	settings: AgentClientPluginSettings;
	settingsService!: SettingsService;

	/** Registry for all chat view containers (sidebar + floating) */
	viewRegistry = new ChatViewRegistry();
	/** Runtime-only status for every file-backed ChatPanel host. */
	sessionRuntimeRegistry = new SessionRuntimeRegistry();
	/** Shared read model for every Session Navigator view. */
	sessionCatalog!: SessionCatalogService;

	/** Map of viewId to AcpClient for multi-session support */
	private _acpClients: Map<string, AcpClient> = new Map();
	/** Floating button container (independent from chat view instances) */
	private floatingButton: FloatingButtonContainer | null = null;
	/** Counter for generating unique floating chat instance IDs */
	private floatingChatCounter = 0;

	async onload() {
		await this.loadSettings();

		initializeLogger(this.settings);

		// Initialize settings store
		this.settingsService = createSettingsService(this.settings, this);
		this.sessionCatalog = new SessionCatalogService({
			getSessionIndex: () => this.settingsService.getSessionIndex(),
			readSessionEntry: async (entryFile) => {
				const file = this.app.vault.getAbstractFileByPath(entryFile);
				if (!(file instanceof TFile)) {
					throw new Error(`Session file not found: ${entryFile}`);
				}
				return this.app.vault.read(file);
			},
			getRuntimeSnapshot: this.sessionRuntimeRegistry.getSnapshot,
			getActiveEntryFile: () =>
				this.app.workspace.getActiveFile()?.path ?? null,
			subscribeIndex: (listener) =>
				this.settingsService.subscribeSessionIndex(listener),
			subscribeSessionEntries: (listener) => {
				const notifySessionFile = (file: TAbstractFile) => {
					if (isSessionEntryPath(file.path)) listener();
				};
				const refs = [
					this.app.vault.on("create", notifySessionFile),
					this.app.vault.on("modify", notifySessionFile),
					this.app.vault.on("rename", notifySessionFile),
					this.app.vault.on("delete", notifySessionFile),
				];
				return () => refs.forEach((ref) => this.app.vault.offref(ref));
			},
			subscribeRuntime: this.sessionRuntimeRegistry.subscribe,
			subscribeActiveEntry: (listener) => {
				const ref = this.app.workspace.on(
					"active-leaf-change",
					listener,
				);
				return () => this.app.workspace.offref(ref);
			},
			onDebugWarning: (issue) =>
				getLogger().debug(`[SessionCatalog] ${issue.message}`),
		});

		// Detach stale leaves from a previous plugin instance to prevent
		// "Attempting to register an existing view type" when Obsidian's
		// hot-reload races onunload/onload (e.g. rapid toggle or npm run dev).
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CHAT);
		this.registerView(VIEW_TYPE_CHAT, (leaf) => new ChatView(leaf, this));

		this.app.workspace.detachLeavesOfType(VIEW_TYPE_SESSION_MANAGER);
		this.registerView(
			VIEW_TYPE_SESSION_MANAGER,
			(leaf) => new SessionManagerView(leaf, this),
		);

		// Register .session file extension and view type
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_HARNESS_SESSION);
		this.registerView(
			VIEW_TYPE_HARNESS_SESSION,
			(leaf) => new HarnessSessionView(leaf, this),
		);
		this.registerExtensions(["session"], VIEW_TYPE_HARNESS_SESSION);

		const ribbonIconEl = this.addRibbonIcon(
			"bot-message-square",
			"Open agent client",
			(_evt: MouseEvent) => {
				void this.activateView();
			},
		);
		ribbonIconEl.addClass("agent-client-ribbon-icon");

		this.addCommand({
			id: "open-chat-view",
			name: "Open chat view",
			callback: () => {
				void this.activateView();
			},
		});

		this.addCommand({
			id: "open-session-manager",
			name: "Open session manager",
			callback: () => {
				void this.activateSessionManager();
			},
		});

		// Create .session file command
		this.addCommand({
			id: "create-session-file",
			name: "Create new .session file",
			callback: () => {
				void this.createSessionFile();
			},
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				this.addNewSessionFileMenuItem(menu, file);
			}),
		);

		this.addSettingTab(new AgentClientSettingTab(this.app, this));

		// Mount floating button (always present; visibility controlled by settings inside component)
		this.floatingButton = new FloatingButtonContainer(this);
		this.floatingButton.mount();

		// Mount initial floating chat instance only if enabled
		if (this.settings.enableFloatingChat) {
			this.openNewFloatingChat();
		}

		// Clean up all ACP sessions when Obsidian quits
		// Note: We don't wait for disconnect to complete to avoid blocking quit
		this.registerEvent(
			this.app.workspace.on("quit", () => {
				// Fire and forget - don't block Obsidian from quitting
				for (const [viewId, client] of this._acpClients) {
					client.disconnect().catch((error) => {
						getLogger().warn(
							`[AgentClient] Quit cleanup error for view ${viewId}:`,
							error,
						);
					});
				}
				this._acpClients.clear();
			}),
		);

		// Keep the focused chat view in sync when the active leaf changes
		// (e.g. clicking a chat tab in the tab bar). ChatPanel's DOM
		// focus/click listeners only fire on interaction inside the view, so a
		// tab-bar switch would otherwise leave the Session Manager highlight on
		// the previous view until the user clicks into the new one.
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf?.view instanceof ChatView) {
					this.setLastActiveChatViewId(leaf.view.viewId);
				}
			}),
		);

		// BR-004: Cascade delete session_index and history when .session file is deleted
		this.registerEvent(
			this.app.vault.on("delete", (file) => {
				if (isSessionEntryPath(file.path)) {
					void this.cleanupSessionFile(file.path);
				}
			}),
		);

		const reconcileSessionFile = (file: TAbstractFile) => {
			if (!(file instanceof TFile) || !isSessionEntryPath(file.path))
				return;
			void this.reconcileSessionFileIndex(file);
		};
		this.registerEvent(this.app.vault.on("create", reconcileSessionFile));
		this.registerEvent(
			this.app.vault.on("rename", (file) => reconcileSessionFile(file)),
		);

		void this.sessionCatalog.start().catch((error) => {
			getLogger().warn(`[SessionCatalog] Failed to start: ${error}`);
		});
	}

	onunload() {
		this.sessionCatalog?.dispose();
		// Unmount floating button
		this.floatingButton?.unmount();
		this.floatingButton = null;

		// Unmount all floating chat instances via registry
		for (const container of this.viewRegistry.getByType("floating")) {
			if (container instanceof FloatingViewContainer) {
				container.unmount();
			}
		}

		// Clear registry (sidebar views are managed by Obsidian workspace)
		this.viewRegistry.clear();
		this.sessionRuntimeRegistry.clear();

		// Disconnect all ACP clients (kill agent processes)
		for (const [, client] of this._acpClients) {
			client.disconnect().catch(() => {});
		}
		this._acpClients.clear();
	}

	/**
	 * Get or create an AcpClient for a specific view.
	 * Each ChatView has its own AcpClient for independent sessions.
	 */
	getOrCreateAcpClient(viewId: string): AcpClient {
		let client = this._acpClients.get(viewId);
		if (!client) {
			client = new AcpClient(this);
			this._acpClients.set(viewId, client);
		}
		return client;
	}

	/**
	 * Update auto-allow permission setting on all live AcpClient instances.
	 * Called when the setting changes at runtime.
	 */
	updateAllAutoAllow(autoAllow: boolean): void {
		for (const client of this._acpClients.values()) {
			client.updateAutoAllow(autoAllow);
		}
	}

	/**
	 * Remove and disconnect the AcpClient for a specific view.
	 * Called when a ChatView is closed.
	 */
	async removeAcpClient(viewId: string): Promise<void> {
		const client = this._acpClients.get(viewId);
		if (client) {
			try {
				await client.disconnect();
			} catch (error) {
				getLogger().warn(
					`[AgentClient] Failed to disconnect client for view ${viewId}:`,
					error,
				);
			}
			this._acpClients.delete(viewId);
		}
		// Note: lastActiveChatViewId is now managed by viewRegistry
		// Clearing happens automatically when view is unregistered
	}

	/**
	 * Get the last active ChatView ID for keybind targeting.
	 */
	get lastActiveChatViewId(): string | null {
		return this.viewRegistry.getFocusedId();
	}

	/**
	 * Set the last active ChatView ID.
	 * Called when a ChatView receives focus or interaction.
	 */
	setLastActiveChatViewId(viewId: string | null): void {
		if (viewId) {
			this.viewRegistry.setFocused(viewId);
		}
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_CHAT);

		if (leaves.length > 0) {
			// Find the leaf matching lastActiveChatViewId, or fall back to first leaf
			const focusedId = this.lastActiveChatViewId;
			if (focusedId) {
				leaf =
					leaves.find(
						(l) => (l.view as ChatView)?.viewId === focusedId,
					) || leaves[0];
			} else {
				leaf = leaves[0];
			}
		} else {
			leaf = this.createNewChatLeaf(false);
			if (leaf) {
				await leaf.setViewState({
					type: VIEW_TYPE_CHAT,
					active: true,
				});
			}
		}

		if (leaf) {
			await workspace.revealLeaf(leaf);
			this.focusTextarea(leaf);
		}
	}

	async activateSessionManager(): Promise<void> {
		const { workspace } = this.app;

		const leaves = workspace.getLeavesOfType(VIEW_TYPE_SESSION_MANAGER);
		if (leaves.length > 0) {
			await workspace.revealLeaf(leaves[0]);
			return;
		}

		const leaf = workspace.getLeftLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: VIEW_TYPE_SESSION_MANAGER,
				active: true,
			});
			await workspace.revealLeaf(leaf);
		}
	}

	/**
	 * Close a specific chat view (sidebar or floating).
	 * Dispatch is via IChatViewContainer.closeContainer(); plugin does not
	 * need to know the concrete container class.
	 */
	closeView(viewId: string): void {
		this.viewRegistry.get(viewId)?.closeContainer();
	}

	/**
	 * Focus the textarea in a ChatView leaf.
	 */
	private focusTextarea(leaf: WorkspaceLeaf): void {
		const viewContainerEl = leaf.view?.containerEl;
		if (viewContainerEl) {
			window.setTimeout(() => {
				const textarea = viewContainerEl.querySelector(
					"textarea.agent-client-chat-input-textarea",
				);
				if (textarea instanceof HTMLTextAreaElement) {
					textarea.focus();
				}
			}, 50);
		}
	}

	/**
	 * Create a new leaf for ChatView based on the configured location setting.
	 * @param isAdditional - true when opening additional views (e.g., Open New View)
	 */
	private createNewChatLeaf(isAdditional: boolean): WorkspaceLeaf | null {
		const { workspace } = this.app;
		const location = this.settings.chatViewLocation;

		switch (location) {
			case "right-tab":
				if (isAdditional) {
					return this.createSidebarTab("right");
				}
				return workspace.getRightLeaf(false);
			case "right-split":
				return workspace.getRightLeaf(isAdditional);
			case "editor-tab":
				return workspace.getLeaf("tab");
			case "editor-split":
				return workspace.getLeaf("split");
			default:
				return workspace.getRightLeaf(false);
		}
	}

	/**
	 * Create a new tab within an existing sidebar tab group.
	 * Uses the parent of an existing chat leaf to add a sibling tab,
	 * avoiding the vertical split caused by getRightLeaf(true).
	 */
	private createSidebarTab(side: "right" | "left"): WorkspaceLeaf | null {
		const { workspace } = this.app;
		const split =
			side === "right" ? workspace.rightSplit : workspace.leftSplit;

		// Find an existing chat leaf in this sidebar to get its tab group
		const existingLeaves = workspace.getLeavesOfType(VIEW_TYPE_CHAT);
		const sidebarLeaf = existingLeaves.find(
			(leaf) => leaf.getRoot() === split,
		);

		if (sidebarLeaf) {
			const tabGroup = sidebarLeaf.parent;
			// Index is clamped by Obsidian, so a large value appends to the end
			return workspace.createLeafInParent(
				tabGroup,
				Number.MAX_SAFE_INTEGER,
			);
		}

		// Fallback: no existing chat leaf in sidebar, create first one
		return side === "right"
			? workspace.getRightLeaf(false)
			: workspace.getLeftLeaf(false);
	}

	/**
	 * Open a new chat view with a specific agent.
	 * Always creates a new view (doesn't reuse existing).
	 */
	async openNewChatViewWithAgent(agentId: string): Promise<void> {
		const leaf = this.createNewChatLeaf(true);
		if (!leaf) {
			getLogger().warn("[AgentClient] Failed to create new leaf");
			return;
		}

		await leaf.setViewState({
			type: VIEW_TYPE_CHAT,
			active: true,
			state: { initialAgentId: agentId },
		});

		await this.app.workspace.revealLeaf(leaf);

		// Focus textarea after revealing the leaf
		const viewContainerEl = leaf.view?.containerEl;
		if (viewContainerEl) {
			window.setTimeout(() => {
				const textarea = viewContainerEl.querySelector(
					"textarea.agent-client-chat-input-textarea",
				);
				if (textarea instanceof HTMLTextAreaElement) {
					textarea.focus();
				}
			}, 0);
		}
	}

	/**
	 * Open a new floating chat window.
	 * Each window is independent with its own session.
	 */
	openNewFloatingChat(
		initialExpanded = false,
		initialPosition?: { x: number; y: number },
	): void {
		// instanceId is just the counter (e.g., "0", "1", "2")
		// FloatingViewContainer will create viewId as "floating-chat-{instanceId}"
		const instanceId = String(this.floatingChatCounter++);
		createFloatingChat(this, instanceId, initialExpanded, initialPosition);
	}

	/**
	 * Close a specific floating chat window.
	 * @param viewId - The viewId in "floating-chat-{id}" format (from getFloatingChatInstances())
	 */
	closeFloatingChat(viewId: string): void {
		const container = this.viewRegistry.get(viewId);
		if (container && container instanceof FloatingViewContainer) {
			container.unmount();
		}
	}

	/**
	 * Get all floating chat instance viewIds.
	 * @returns Array of viewIds in "floating-chat-{id}" format
	 */
	getFloatingChatInstances(): string[] {
		return this.viewRegistry.getByType("floating").map((v) => v.viewId);
	}

	/**
	 * Expand a specific floating chat window by triggering a custom event.
	 * @param viewId - The viewId in "floating-chat-{id}" format (from getFloatingChatInstances())
	 */
	expandFloatingChat(viewId: string): void {
		const view = this.viewRegistry.get(viewId);
		if (view) {
			view.expand();
		}
	}

	/**
	 * Get all available agents.
	 *
	 * Locally discovered backends are listed first because they are known to be
	 * present in this environment. Built-ins remain visible as configurable
	 * options, but their commands may still need user setup.
	 */
	getAvailableAgents(): Array<{ id: string; displayName: string }> {
		const discovered = this.getDiscoveredAgents();
		const configured = [
			{
				id: this.settings.claude.id,
				displayName:
					this.settings.claude.displayName || this.settings.claude.id,
			},
			{
				id: this.settings.codex.id,
				displayName:
					this.settings.codex.displayName || this.settings.codex.id,
			},
			{
				id: this.settings.gemini.id,
				displayName:
					this.settings.gemini.displayName || this.settings.gemini.id,
			},
			...this.settings.customAgents.map((agent) => ({
				id: agent.id,
				displayName: agent.displayName || agent.id,
			})),
		];

		const discoveredIds = new Set(discovered.map((agent) => agent.id));
		return [
			...discovered,
			...configured.filter((agent) => !discoveredIds.has(agent.id)),
		];
	}

	private getDiscoveredAgents(): Array<{ id: string; displayName: string }> {
		const agents: Array<{ id: string; displayName: string }> = [];
		if (this.isPiAcpAvailable()) {
			agents.push({ id: "pi-acp", displayName: "pi-acp" });
		}
		return agents;
	}

	/**
	 * Check if pi-acp is installed as a pi plugin.
	 * Detection: ~/.pi/pi-acp/ directory exists.
	 */
	isPiAcpAvailable(): boolean {
		try {
			return existsSync(join(homedir(), ".pi", "pi-acp"));
		} catch {
			return false;
		}
	}

	async loadSettings() {
		const raw = ((await this.loadData()) ?? {}) as Record<string, unknown>;
		const D = DEFAULT_SETTINGS;
		let migratedSecrets = false;

		// Extract agent sub-objects
		const rc = obj(raw.claude) ?? {};
		const rk = obj(raw.codex) ?? {};
		const rg = obj(raw.gemini) ?? {};
		const re = obj(raw.exportSettings) ?? {};
		const rd = obj(raw.displaySettings) ?? {};

		// Normalize custom agents
		const customAgents = Array.isArray(raw.customAgents)
			? ensureUniqueCustomAgentIds(
					raw.customAgents.map((a: unknown) =>
						normalizeCustomAgent(obj(a) ?? {}),
					),
				)
			: [];

		// Migration: defaultAgentId ← activeAgentId (old name)
		const availableAgentIds = [
			D.claude.id,
			D.codex.id,
			D.gemini.id,
			...customAgents.map((a) => a.id),
		];
		const rawDefaultId =
			str(raw.defaultAgentId, "") || str(raw.activeAgentId, "");
		const defaultAgentId =
			rawDefaultId && availableAgentIds.includes(rawDefaultId)
				? rawDefaultId
				: availableAgentIds[0] || D.claude.id;

		this.settings = {
			claude: {
				id: D.claude.id, // Fixed — never from raw
				displayName: str(rc.displayName, D.claude.displayName),
				apiKeySecretId: this.migrateLegacyApiKey(
					"claude-api-key",
					"agent-client-claude-api-key",
					str(rc.apiKeySecretId, D.claude.apiKeySecretId),
					str(rc.apiKey, ""),
					"Claude",
					() => {
						migratedSecrets = true;
					},
				),
				// Migration: claude.command ← claudeCodeAcpCommandPath (old name)
				command:
					str(rc.command, "") ||
					str(raw.claudeCodeAcpCommandPath, "") ||
					D.claude.command,
				args: sanitizeArgs(rc.args),
				env: normalizeEnvVars(rc.env),
			},
			codex: {
				id: D.codex.id,
				displayName: str(rk.displayName, D.codex.displayName),
				apiKeySecretId: this.migrateLegacyApiKey(
					"openai-api-key",
					"agent-client-openai-api-key",
					str(rk.apiKeySecretId, D.codex.apiKeySecretId),
					str(rk.apiKey, ""),
					"Codex",
					() => {
						migratedSecrets = true;
					},
				),
				command: str(rk.command, "") || D.codex.command,
				args: sanitizeArgs(rk.args),
				env: normalizeEnvVars(rk.env),
			},
			gemini: {
				id: D.gemini.id,
				displayName: str(rg.displayName, D.gemini.displayName),
				apiKeySecretId: this.migrateLegacyApiKey(
					"gemini-api-key",
					"agent-client-gemini-api-key",
					str(rg.apiKeySecretId, D.gemini.apiKeySecretId),
					str(rg.apiKey, ""),
					"Gemini",
					() => {
						migratedSecrets = true;
					},
				),
				// Migration: gemini.command ← geminiCommandPath (old name)
				command:
					str(rg.command, "") ||
					str(raw.geminiCommandPath, "") ||
					D.gemini.command,
				args:
					sanitizeArgs(rg.args).length > 0
						? sanitizeArgs(rg.args)
						: D.gemini.args,
				env: normalizeEnvVars(rg.env),
			},
			customAgents,
			defaultAgentId,
			sessionFolder: str(raw.sessionFolder, D.sessionFolder),
			autoAllowPermissions: bool(
				raw.autoAllowPermissions,
				D.autoAllowPermissions,
			),
			autoMentionActiveNote: bool(
				raw.autoMentionActiveNote,
				D.autoMentionActiveNote,
			),
			enableSystemNotifications: bool(
				raw.enableSystemNotifications,
				D.enableSystemNotifications,
			),
			debugMode: bool(raw.debugMode, D.debugMode),
			nodePath: str(raw.nodePath, D.nodePath),
			exportSettings: {
				defaultFolder: str(
					re.defaultFolder,
					D.exportSettings.defaultFolder,
				),
				filenameTemplate: str(
					re.filenameTemplate,
					D.exportSettings.filenameTemplate,
				),
				autoExportOnNewChat: bool(
					re.autoExportOnNewChat,
					D.exportSettings.autoExportOnNewChat,
				),
				autoExportOnCloseChat: bool(
					re.autoExportOnCloseChat,
					D.exportSettings.autoExportOnCloseChat,
				),
				openFileAfterExport: bool(
					re.openFileAfterExport,
					D.exportSettings.openFileAfterExport,
				),
				includeImages: bool(
					re.includeImages,
					D.exportSettings.includeImages,
				),
				imageLocation: enumVal(
					re.imageLocation,
					["obsidian", "custom", "base64"],
					D.exportSettings.imageLocation,
				),
				imageCustomFolder: str(
					re.imageCustomFolder,
					D.exportSettings.imageCustomFolder,
				),
				frontmatterTag: str(
					re.frontmatterTag,
					D.exportSettings.frontmatterTag,
				),
			},
			windowsWslMode: bool(raw.windowsWslMode, D.windowsWslMode),
			windowsWslDistribution: str(
				raw.windowsWslDistribution,
				D.windowsWslDistribution as string,
			),
			sendMessageShortcut: enumVal(
				raw.sendMessageShortcut,
				["enter", "cmd-enter"],
				D.sendMessageShortcut,
			),
			chatViewLocation: enumVal(
				raw.chatViewLocation,
				["right-tab", "right-split", "editor-tab", "editor-split"],
				D.chatViewLocation,
			),
			displaySettings: {
				autoCollapseDiffs: bool(
					rd.autoCollapseDiffs,
					D.displaySettings.autoCollapseDiffs,
				),
				diffCollapseThreshold: num(
					rd.diffCollapseThreshold,
					D.displaySettings.diffCollapseThreshold,
					1,
				),
				maxNoteLength: num(
					rd.maxNoteLength,
					D.displaySettings.maxNoteLength,
					1,
				),
				maxSelectionLength: num(
					rd.maxSelectionLength,
					D.displaySettings.maxSelectionLength,
					1,
				),
				showEmojis: bool(rd.showEmojis, D.displaySettings.showEmojis),
				fontSize: parseChatFontSize(rd.fontSize),
			},
			lastUsedModels: strRecord(raw.lastUsedModels),
			lastUsedModes: strRecord(raw.lastUsedModes),
			lastUsedConfigOptions: nestedStrRecord(raw.lastUsedConfigOptions),
			// Migration: enableFloatingChat ← showFloatingButton (old name)
			enableFloatingChat: bool(
				raw.enableFloatingChat,
				bool(raw.showFloatingButton, D.enableFloatingChat),
			),
			floatingButtonImage: str(
				raw.floatingButtonImage,
				D.floatingButtonImage,
			),
			floatingWindowSize: (() => {
				const s = obj(raw.floatingWindowSize);
				return s &&
					typeof s.width === "number" &&
					typeof s.height === "number"
					? { width: s.width, height: s.height }
					: D.floatingWindowSize;
			})(),
			floatingWindowPosition: xyPoint(raw.floatingWindowPosition),
			floatingButtonPosition: xyPoint(raw.floatingButtonPosition),
		};

		const defaultAgentChanged = this.ensureDefaultAgentId();

		if (migratedSecrets || defaultAgentChanged) {
			await this.saveSettings();
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async saveSettingsAndNotify(nextSettings: AgentClientPluginSettings) {
		await this.settingsService.updateSettings(nextSettings);
	}

	/**
	 * Migrate legacy plaintext apiKey (v0.10.x) to secretStorage.
	 *
	 * Returns the secretId to use for this agent.
	 *
	 * Behavior:
	 * - If apiKeySecretId is already set, return it as-is. If a legacy
	 *   plaintext apiKey still lingers in data.json (orphaned from prior
	 *   experimental state), trigger onMigrate to schedule a save that
	 *   cleans it up.
	 * - If legacy apiKey is empty, return empty string (no migration needed).
	 * - Otherwise, migrate to secretStorage:
	 *   - Use defaultSecretId (e.g. "claude-api-key") for cross-plugin sharing.
	 *   - On collision (defaultSecretId exists with a different value, e.g.
	 *     from another plugin), fall back to fallbackSecretId
	 *     (e.g. "agent-client-claude-api-key") to preserve the user's key
	 *     and notify them.
	 *
	 * This method is for upgrading from v0.10.x or experimental builds and
	 * can be removed in a future major version once we're confident no
	 * users have legacy plaintext apiKey fields in data.json.
	 */
	private migrateLegacyApiKey(
		defaultSecretId: string,
		fallbackSecretId: string,
		currentSecretId: string,
		legacyApiKey: string,
		agentLabel: string,
		onMigrate: () => void,
	): string {
		const trimmed = legacyApiKey.trim();

		// Already migrated
		if (currentSecretId.length > 0) {
			// Clean up orphaned plaintext apiKey if still in data.json
			if (trimmed.length > 0) {
				onMigrate();
			}
			return currentSecretId;
		}

		if (trimmed.length === 0) {
			return "";
		}

		const existing = this.app.secretStorage.getSecret(defaultSecretId);

		if (existing === null) {
			// No collision — create the secret with the preferred ID
			this.app.secretStorage.setSecret(defaultSecretId, trimmed);
			new Notice(
				`[Agent Client] Your ${agentLabel} API key has been migrated to Obsidian's Keychain as "${defaultSecretId}".`,
			);
			onMigrate();
			return defaultSecretId;
		}

		if (existing === trimmed) {
			// Idempotent re-migration (same value already stored)
			onMigrate();
			return defaultSecretId;
		}

		// Collision: defaultSecretId exists with a different value (likely
		// another plugin). Fall back to a plugin-prefixed ID to preserve
		// the user's key without overwriting other plugins' secrets.
		this.app.secretStorage.setSecret(fallbackSecretId, trimmed);
		new Notice(
			`[Agent Client] "${defaultSecretId}" was already in use. Your ${agentLabel} API key was migrated to "${fallbackSecretId}". You can rename it in Obsidian's Keychain settings.`,
		);
		onMigrate();
		return fallbackSecretId;
	}

	/**
	 * Fetch the latest stable release version from GitHub.
	 */
	private async fetchLatestStable(): Promise<string | null> {
		try {
			const response = await requestUrl({
				url: `https://api.github.com/repos/${PLUGIN_RELEASE_REPO}/releases/latest`,
			});
			const data = response.json as { tag_name?: string };
			return data.tag_name ? semver.clean(data.tag_name) : null;
		} catch {
			return null;
		}
	}

	/**
	 * Fetch the latest prerelease version from GitHub.
	 */
	private async fetchLatestPrerelease(): Promise<string | null> {
		try {
			const response = await requestUrl({
				url: `https://api.github.com/repos/${PLUGIN_RELEASE_REPO}/releases`,
			});
			const releases = response.json as Array<{
				tag_name: string;
				prerelease: boolean;
			}>;

			// Find the first prerelease (releases are sorted by date descending)
			const latestPrerelease = releases.find((r) => r.prerelease);
			return latestPrerelease
				? semver.clean(latestPrerelease.tag_name)
				: null;
		} catch {
			return null;
		}
	}

	/**
	 * Check for plugin updates.
	 * - Stable version users: compare with latest stable release
	 * - Prerelease users: compare with both latest stable and latest prerelease
	 */
	async checkForUpdates(): Promise<boolean> {
		const currentVersion =
			semver.clean(this.manifest.version) || this.manifest.version;
		const isCurrentPrerelease = semver.prerelease(currentVersion) !== null;

		if (isCurrentPrerelease) {
			// Prerelease user: check both stable and prerelease
			const [latestStable, latestPrerelease] = await Promise.all([
				this.fetchLatestStable(),
				this.fetchLatestPrerelease(),
			]);

			const hasNewerStable =
				latestStable && semver.gt(latestStable, currentVersion);
			const hasNewerPrerelease =
				latestPrerelease && semver.gt(latestPrerelease, currentVersion);

			if (hasNewerStable || hasNewerPrerelease) {
				// Prefer stable version notification if available
				const newestVersion = hasNewerStable
					? latestStable
					: latestPrerelease;
				new Notice(
					`Obsidian harness: update available, v${newestVersion}`,
				);
				return true;
			}
		} else {
			// Stable version user: check stable only
			const latestStable = await this.fetchLatestStable();
			if (latestStable && semver.gt(latestStable, currentVersion)) {
				new Notice(
					`Obsidian harness: update available, v${latestStable}`,
				);
				return true;
			}
		}

		return false;
	}

	ensureDefaultAgentId(): boolean {
		const configuredIds = this.collectConfiguredAgentIds();
		const discoveredIds = this.collectDiscoveredAgentIds();
		const nextDefaultAgentId = selectPreferredDefaultAgentId({
			currentDefaultId: this.settings.defaultAgentId,
			configuredAgentIds: configuredIds,
			discoveredAgentIds: discoveredIds,
			fallbackAgentId: DEFAULT_SETTINGS.claude.id,
		});
		if (nextDefaultAgentId === this.settings.defaultAgentId) return false;
		this.settings.defaultAgentId = nextDefaultAgentId;
		return true;
	}

	private collectAvailableAgentIds(): string[] {
		return uniqueNonEmpty([
			...this.collectDiscoveredAgentIds(),
			...this.collectConfiguredAgentIds(),
		]);
	}

	private collectConfiguredAgentIds(): string[] {
		const ids = [
			this.settings.claude.id,
			this.settings.codex.id,
			this.settings.gemini.id,
		];
		for (const agent of this.settings.customAgents) {
			if (agent.id && agent.id.length > 0) {
				ids.push(agent.id);
			}
		}
		return uniqueNonEmpty(ids);
	}

	private collectDiscoveredAgentIds(): string[] {
		return this.getDiscoveredAgents().map((agent) => agent.id);
	}

	getVaultRootPath(): string {
		const adapter = this.app.vault.adapter;
		return adapter instanceof FileSystemAdapter
			? adapter.getBasePath()
			: "";
	}

	private async ensureVaultFolder(folderPath: string): Promise<void> {
		const normalized = normalizePath(folderPath).replace(/^\/+|\/+$/g, "");
		if (!normalized) return;

		const parts = normalized.split("/");
		let current = "";
		for (const part of parts) {
			current = current ? `${current}/${part}` : part;
			if (!this.app.vault.getAbstractFileByPath(current)) {
				await this.app.vault.createFolder(current);
			}
		}
	}

	private getDefaultSessionFolder(): string {
		return normalizePath(this.settings.sessionFolder || "Sessions").replace(
			/^\/+|\/+$/g,
			"",
		);
	}

	private addNewSessionFileMenuItem(menu: Menu, file: TAbstractFile): void {
		menu.addItem((item) => {
			item.setTitle("New session")
				.setIcon("bot-message-square")
				.onClick(() => {
					const folder = resolveSessionFolderFromFileMenuTarget(file);
					void this.createSessionFile({ folder });
				});
		});
	}

	async materializeSessionFile(options?: {
		agentId?: string;
		cwd?: string;
		folder?: string;
		title?: string;
		forkedFrom?: string | null;
	}): Promise<{ file: TFile; config: SessionFileData }> {
		const entryId = crypto.randomUUID();
		const historyId = crypto.randomUUID();
		const cwd = options?.cwd ?? this.getVaultRootPath();
		const createdAt = new Date().toISOString();
		const config: SessionFileData = {
			version: 2,
			entryId,
			historyId,
			agentId: options?.agentId ?? "",
			cwd,
			title: options?.title ?? "New Session",
			createdAt,
			updatedAt: createdAt,
			forkedFrom: options?.forkedFrom ?? null,
		};

		const content = JSON.stringify(config, null, "\t");

		const folder =
			options?.folder !== undefined
				? normalizePath(options.folder).replace(/^\/+|\/+$/g, "")
				: this.getDefaultSessionFolder();
		await this.ensureVaultFolder(folder);

		const fileName = `session-${entryId.slice(0, 8)}.session`;
		const filePath = normalizePath(
			folder ? `${folder}/${fileName}` : fileName,
		);

		const existing = this.app.vault.getAbstractFileByPath(filePath);
		if (existing) {
			throw new Error(`File already exists: ${filePath}`);
		}

		const file = await this.app.vault.create(filePath, content);
		await this.settingsService.initializeTranscript(historyId, {
			agentId: config.agentId,
			cwd,
			title: config.title,
			createdAt,
		});

		const indexEntry: SessionIndexEntry = {
			entryId,
			historyId,
			cwd,
			entryFile: filePath,
		};
		try {
			await this.settingsService.appendSessionIndex(indexEntry);
		} catch (error) {
			getLogger().warn(
				`[Harness] Failed to update session_index.jsonl: ${error}`,
			);
		}

		return { file, config };
	}

	async writeSessionConfig(
		entryFilePath: string,
		config: SessionFileData,
	): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(entryFilePath);
		if (!(file instanceof TFile)) return;
		config.updatedAt = new Date().toISOString();
		await this.app.vault.modify(file, JSON.stringify(config, null, "\t"));
	}

	async handleSessionIdChangedForFile(
		entryFilePath: string,
		config: SessionFileData,
		acpSessionId: string,
	): Promise<void> {
		if (config.acpBinding?.sessionId === acpSessionId) return;
		config.acpBinding = {
			agentId: config.agentId,
			sessionId: acpSessionId,
		};
		await this.writeSessionConfig(entryFilePath, config);
	}

	/**
	 * Create a new .session file and open it in a HarnessSessionView tab.
	 */
	async createSessionFile(options?: {
		agentId?: string;
		cwd?: string;
		folder?: string;
	}): Promise<void> {
		let materialized: { file: TFile; config: SessionFileData };
		try {
			materialized = await this.materializeSessionFile(options);
		} catch (error) {
			new Notice(`[Harness] Failed to create session file: ${error}`);
			return;
		}

		new Notice(`[Harness] Created ${materialized.file.path}`);

		await this.app.workspace.getLeaf().openFile(materialized.file);
	}

	async openNavigatorSession(entryId: string): Promise<void> {
		const file = this.resolveNavigatorSessionFile(entryId);
		if (!file) return;
		await this.app.workspace.getLeaf().openFile(file);
	}

	async revealNavigatorSession(entryId: string): Promise<void> {
		const file = this.resolveNavigatorSessionFile(entryId);
		if (!file) return;
		const leaf = this.app.workspace.getLeavesOfType("file-explorer")[0];
		const explorer = leaf?.view as unknown as {
			revealInFolder?: (target: TFile) => void | Promise<void>;
		};
		if (!leaf || typeof explorer.revealInFolder !== "function") {
			new Notice("File explorer is not open");
			return;
		}
		await explorer.revealInFolder(file);
		await this.app.workspace.revealLeaf(leaf);
	}

	async renameNavigatorSession(
		entryId: string,
		requestedName: string,
	): Promise<void> {
		const file = this.resolveNavigatorSessionFile(entryId);
		if (!file) return;
		let target: { entryFile: string; title: string };
		try {
			target = getSessionRenameTarget(file.path, requestedName);
		} catch (error) {
			new Notice(error instanceof Error ? error.message : String(error));
			return;
		}
		const collision = this.app.vault.getAbstractFileByPath(
			target.entryFile,
		);
		if (collision && collision !== file) {
			new Notice(`File already exists: ${target.entryFile}`);
			return;
		}

		let currentFile = file;
		try {
			if (target.entryFile !== file.path) {
				await this.app.fileManager.renameFile(file, target.entryFile);
				const renamed = this.app.vault.getAbstractFileByPath(
					target.entryFile,
				);
				if (!(renamed instanceof TFile)) {
					throw new Error(
						`Renamed Session not found: ${target.entryFile}`,
					);
				}
				currentFile = renamed;
			}
		} catch (error) {
			new Notice(`[Harness] Failed to rename Session file: ${error}`);
			return;
		}

		try {
			const config = parseSessionFileData(
				await this.app.vault.read(currentFile),
			);
			config.title = target.title;
			config.updatedAt = new Date().toISOString();
			await this.app.vault.modify(
				currentFile,
				JSON.stringify(config, null, "\t"),
			);
			await this.settingsService.reconcileSessionIndex(
				config,
				currentFile.path,
			);
		} catch (error) {
			new Notice(
				`[Harness] Session file renamed, but title update failed: ${error}`,
			);
		}
	}

	async deleteNavigatorSession(entryId: string): Promise<void> {
		const file = this.resolveNavigatorSessionFile(entryId);
		if (!file) return;
		if (!(await this.app.fileManager.promptForDeletion(file))) return;
		const currentFile = this.resolveNavigatorSessionFile(entryId);
		if (!currentFile) return;
		try {
			await this.app.fileManager.trashFile(currentFile);
		} catch (error) {
			new Notice(`[Harness] Failed to delete Session: ${error}`);
		}
	}

	private resolveNavigatorSessionFile(entryId: string): TFile | null {
		const item = this.sessionCatalog
			.getSnapshot()
			.items.find((candidate) => candidate.entryId === entryId);
		if (!item) {
			new Notice("Session is no longer available");
			return null;
		}
		const file = this.app.vault.getAbstractFileByPath(item.entryFile);
		if (!(file instanceof TFile)) {
			new Notice(`Session file not found: ${item.entryFile}`);
			this.sessionCatalog.refresh().catch(() => {});
			return null;
		}
		return file;
	}

	/**
	 * BR-004: Cascade delete session_index entry and history directory
	 * when a .session file is deleted from the vault.
	 */
	async cleanupSessionFile(entryFilePath: string): Promise<void> {
		try {
			const entries = await this.settingsService.getSessionIndex();
			const entry = entries.find((e) => e.entryFile === entryFilePath);
			if (!entry) return;

			await this.settingsService.removeSessionIndex(entry.entryId);
			await this.settingsService.deleteTranscript(entry.historyId);
			getLogger().log(`[Harness] Cleaned up session: ${entry.entryId}`);
		} catch (error) {
			getLogger().warn(
				`[Harness] Failed to clean up session file ${entryFilePath}: ${error}`,
			);
		}
	}

	private async reconcileSessionFileIndex(file: TFile): Promise<void> {
		try {
			const result = await reconcileSessionEntryIndex(
				file.path,
				await this.app.vault.read(file),
				(entry, entryFile) =>
					this.settingsService.reconcileSessionIndex(
						entry,
						entryFile,
					),
			);
			if (result.status === "conflict") {
				getLogger().warn(
					`[Harness] Session index conflict for ${result.entry.entryId}: ${result.conflictingEntryFiles.join(", ")}`,
				);
			}
		} catch (error) {
			getLogger().warn(
				`[Harness] Failed to reconcile session file ${file.path}: ${error}`,
			);
		}
	}
}
