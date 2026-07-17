import { FileView, WorkspaceLeaf, TFile } from "obsidian";
import * as React from "react";
const { useMemo } = React;
import { createRoot, Root } from "react-dom/client";

import type AgentClientPlugin from "../plugin";
import { ChatContextProvider } from "./ChatContext";
import { ChatPanel } from "./ChatPanel";
import { VaultService } from "../services/vault-service";
import type { SessionFileData } from "../types/session";
import { getLogger } from "../utils/logger";

export const VIEW_TYPE_HARNESS_SESSION = "harness-session-view";

function SessionChatComponent({
	plugin,
	view,
	viewId,
	config,
}: {
	plugin: AgentClientPlugin;
	view: HarnessSessionView;
	viewId: string;
	config: SessionFileData;
}) {
	const contextValue = useMemo(
		() => ({
			plugin,
			acpClient: view.acpClient,
			vaultService: view.vaultService,
			settingsService: plugin.settingsService,
		}),
		[plugin, view.acpClient, view.vaultService],
	);

	const sourcePrompt = useMemo(() => buildSourceNotePrompt(config), [config]);
	const sourceLabel = useMemo(() => buildSourceNoteLabel(config), [config]);

	return (
		<ChatContextProvider value={contextValue}>
			<ChatPanel
				variant="sidebar"
				viewId={viewId}
				workingDirectory={config.cwd || undefined}
				initialAgentId={config.agentId}
				initialSessionId={config.sessionId}
				initialInputValue={sourcePrompt}
				entryContextLabel={sourceLabel}
				appendTargetNotePath={config.sourceNote?.path}
				viewHost={view}
				onSessionTitleChanged={() => view.refreshDisplayText()}
				onAgentIdChanged={(agentId: string) => {
					config.agentId = agentId;
					void view.updateSessionConfig(config);
				}}
				onSessionIdChanged={(sessionId: string) => {
					{
						view.acpClient.setHistorySessionId(sessionId);
						void view.onSessionIdChanged(sessionId, config);
					}
				}}
			/>
		</ChatContextProvider>
	);
}

function buildSourceNoteLabel(config: SessionFileData): string | undefined {
	const sourceNote = config.sourceNote;
	if (!sourceNote) return undefined;
	const selection = sourceNote.selection;
	if (selection) {
		return `From ${sourceNote.path}, lines ${selection.fromLine}-${selection.toLine}`;
	}
	return `From ${sourceNote.path}`;
}

function buildSourceNotePrompt(config: SessionFileData): string | undefined {
	const sourceNote = config.sourceNote;
	if (!sourceNote) return undefined;
	const selection = sourceNote.selection;
	if (!selection) {
		return `Please use this Obsidian note as context: @[[${sourceNote.name}]]\n\n`;
	}
	return [
		`Please use this selected context from @[[${sourceNote.name}]]:${selection.fromLine}-${selection.toLine}:`,
		"",
		"```md",
		selection.text,
		"```",
		"",
	].join("\n");
}

/**
 * Custom FileView for .session files.
 *
 * When a .session file is opened in Obsidian, this view renders the ChatPanel
 * interface. The .session file contains session metadata (sessionId, agentId,
 * cwd, etc.) which is used to initialize the agent connection.
 *
 * Extends FileView (not ItemView) so that Obsidian's native file association
 * works — onLoadFile(file: TFile) is called automatically when the file is opened.
 */
export class HarnessSessionView extends FileView {
	private root: Root | null = null;
	private plugin: AgentClientPlugin;
	readonly viewId: string;

	acpClient!: ReturnType<AgentClientPlugin["getOrCreateAcpClient"]>;
	vaultService!: VaultService;

	constructor(leaf: WorkspaceLeaf, plugin: AgentClientPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.viewId = (leaf as { id?: string }).id ?? crypto.randomUUID();
	}

	getViewType(): string {
		return VIEW_TYPE_HARNESS_SESSION;
	}

	getIcon(): string {
		return "bot-message-square";
	}

	refreshDisplayText(): void {
		const leaf = this.leaf as unknown as { updateHeader?: () => void };
		leaf.updateHeader?.();
	}

	getViewData(): string {
		return "";
	}

	setViewData(_data: string, _clear: boolean): void {
		// noop
	}

	clear(): void {
		// noop
	}

	async onLoadFile(file: TFile): Promise<void> {
		const container = this.containerEl.children[1];

		// Unmount previous React root before clearing DOM
		// (container.empty() only removes DOM nodes; React needs unmount()
		// to trigger cleanup effects and prevent memory leaks)
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}

		container.empty();

		// Read and parse the .session file
		const raw = await this.app.vault.read(file);
		let config: SessionFileData;
		try {
			config = JSON.parse(raw) as SessionFileData;
		} catch {
			container.createEl("div", {
				text: "Invalid session file format",
				cls: "harness-error",
			});
			return;
		}

		// Validate required fields
		if (!config.sessionId || !config.cwd) {
			container.createEl("div", {
				text: "Invalid session file: missing required fields",
				cls: "harness-error",
			});
			return;
		}

		// Check if agent is configured (skip if not yet set)
		if (config.agentId) {
			const availableAgents = this.plugin.getAvailableAgents();
			const agentExists = availableAgents.some(
				(a) => a.id === config.agentId,
			);
			if (!agentExists) {
				container.createEl("div", {
					text: `Agent "${config.agentId}" is not configured. Please add it in plugin settings.`,
					cls: "harness-error",
				});
				return;
			}
		}

		this.acpClient = this.plugin.getOrCreateAcpClient(this.viewId);
		this.vaultService = new VaultService(this.plugin);

		this.root = createRoot(container);
		this.root.render(
			<SessionChatComponent
				plugin={this.plugin}
				view={this}
				viewId={this.viewId}
				config={config}
			/>,
		);
	}

	async onUnloadFile(_file: TFile): Promise<void> {
		// noop
	}

	/**
	 * BR-002: Write ACP sessionId back to .session file and session_index.
	 * Called when the agent creates a new session (sessionId changes from null to a value).
	 */
	async onSessionIdChanged(
		acpSessionId: string,
		config: SessionFileData,
	): Promise<void> {
		if (config.sessionId === acpSessionId) return;
		const oldSessionId = config.sessionId;
		config.sessionId = acpSessionId;
		config.updatedAt = new Date().toISOString();

		// Update the .session file in vault
		const file = this.app.workspace.getActiveFile();
		if (file && file.extension === "session") {
			await this.app.vault.modify(file, JSON.stringify(config, null, "	"));
		}

		// Update session_index.jsonl: remove old entry, add new entry
		try {
			await this.plugin.settingsService.removeSessionIndex(oldSessionId);
			await this.plugin.settingsService.appendSessionIndex({
				sessionId: acpSessionId,
				cwd: config.cwd,
				entryFile: file?.path ?? "",
			});
		} catch (error) {
			getLogger().warn(
				`[Harness] Failed to update session index: ${error}`,
			);
		}
	}

	/**
	 * Update the .session file with new config (e.g., agentId change).
	 */
	async updateSessionConfig(config: SessionFileData): Promise<void> {
		const file = this.app.workspace.getActiveFile();
		if (!file || file.extension !== "session") return;
		config.updatedAt = new Date().toISOString();
		await this.app.vault.modify(file, JSON.stringify(config, null, "	"));
	}

	async onClose(): Promise<void> {
		if (this.root) {
			this.root.unmount();
			this.root = null;
		}

		this.vaultService?.destroy();
		await this.plugin.removeAcpClient(this.viewId);
	}
}
