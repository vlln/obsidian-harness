import { FileView, WorkspaceLeaf, TFile } from "obsidian";
import * as React from "react";
const { useMemo } = React;
import { createRoot, Root } from "react-dom/client";

import type HarnessPlugin from "../plugin";
import { ChatContextProvider } from "./ChatContext";
import { ChatPanel } from "./ChatPanel";
import { VaultService } from "../services/vault-service";
import type { SessionFileData } from "../types/session";
import { parseSessionFileData } from "../services/session-entry";

export const VIEW_TYPE_HARNESS_SESSION = "harness-session-view";

function SessionChatComponent({
	plugin,
	view,
	viewId,
	config,
}: {
	plugin: HarnessPlugin;
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

	return (
		<ChatContextProvider value={contextValue}>
			<ChatPanel
				variant="sidebar"
				viewId={viewId}
				workingDirectory={config.cwd || undefined}
				initialAgentId={config.acpBinding?.agentId || config.agentId}
				initialSessionId={config.acpBinding?.sessionId}
				sessionEntry={config}
				showTurnNavigator
				showNavigatorToggle
				viewHost={view}
				onSessionTitleChanged={() => view.refreshDisplayText()}
				onAgentIdChanged={(agentId: string) => {
					config.agentId = agentId;
					void view.updateSessionConfig(config);
				}}
				onSessionIdChanged={(sessionId: string) => {
					{
						void view.onSessionIdChanged(sessionId, config);
					}
				}}
			/>
		</ChatContextProvider>
	);
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
	private plugin: HarnessPlugin;
	private entryFilePath: string | null = null;
	readonly viewId: string;

	acpClient!: ReturnType<HarnessPlugin["getOrCreateAcpClient"]>;
	vaultService!: VaultService;

	constructor(leaf: WorkspaceLeaf, plugin: HarnessPlugin) {
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
		this.entryFilePath = file.path;
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
			config = parseSessionFileData(raw);
		} catch (error) {
			container.createEl("div", {
				text:
					error instanceof Error
						? error.message
						: "Invalid session file format",
				cls: "harness-error",
			});
			return;
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
		if (!this.entryFilePath) return;
		await this.plugin.handleSessionIdChangedForFile(
			this.entryFilePath,
			config,
			acpSessionId,
		);
	}

	/**
	 * Update the .session file with new config (e.g., agentId change).
	 */
	async updateSessionConfig(config: SessionFileData): Promise<void> {
		if (!this.entryFilePath) return;
		await this.plugin.writeSessionConfig(this.entryFilePath, config);
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
