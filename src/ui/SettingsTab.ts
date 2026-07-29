import {
	App,
	PluginSettingTab,
	Setting,
	DropdownComponent,
	Platform,
	SecretComponent,
} from "obsidian";
import type HarnessPlugin from "../plugin";
import type {
	AgentSettings,
	AgentEnvVar,
	ChatViewLocation,
} from "../plugin";
import { resolveCommandPath, resolveCommandPathInWsl } from "../utils/paths";
import {
	normalizeEnvVars,
	generateUnoccupiedAgentId,
	CHAT_FONT_SIZE_MAX,
	CHAT_FONT_SIZE_MIN,
	parseChatFontSize,
} from "../services/settings-normalizer";

/* eslint-disable obsidianmd/ui/sentence-case -- Settings labels contain product names, API acronyms, CLI names, environment variables, and placeholders. */

export class HarnessSettingTab extends PluginSettingTab {
	plugin: HarnessPlugin;
	private agentSelector: DropdownComponent | null = null;
	private unsubscribe: (() => void) | null = null;

	constructor(app: App, plugin: HarnessPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		this.agentSelector = null;

		// Cleanup previous subscription if exists
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}

		// Documentation link
		const docContainer = containerEl.createDiv({
			cls: "harness-doc-link",
		});
		docContainer.createSpan({ text: "Need help? Check out the " });
		docContainer.createEl("a", {
			text: "documentation",
			href: "https://vlln.github.io/obsidian-harness/",
			attr: { target: "_blank" },
		});
		docContainer.createSpan({ text: "." });

		// ─────────────────────────────────────────────────────────────────────
		// Top-level settings (no header)
		// ─────────────────────────────────────────────────────────────────────

		this.renderAgentSelector(containerEl);

		// Subscribe to settings changes to update agent dropdown
		this.unsubscribe = this.plugin.settingsService.subscribe(() => {
			this.updateAgentDropdown();
		});

		// Also update immediately on display to sync with current settings
		this.updateAgentDropdown();

		const nodePathSetting = new Setting(containerEl)
			.setName("Node.js path")
			.setDesc(
				"Path to Node.js. Usually leave blank. Only needed if node is in a non-standard location (enter absolute path, e.g. /usr/local/bin/node).",
			)
			.addText((text) => {
				text.setPlaceholder("Leave blank (login shell auto-resolves)")
					.setValue(this.plugin.settings.nodePath)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							nodePath: value.trim(),
						});
					});
			});
		this.addAutoDetectButton(nodePathSetting, "node", async (path) => {
			await this.plugin.settingsService.updateSettings({
				nodePath: path,
			});
		});

		new Setting(containerEl)
			.setName("Send message shortcut")
			.setDesc(
				"Choose the keyboard shortcut to send messages. Note: If using Cmd/Ctrl+Enter, you may need to remove any hotkeys assigned to Cmd/Ctrl+Enter (Settings → Hotkeys).",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption(
						"enter",
						"Enter to send, Shift+Enter for newline",
					)
					.addOption(
						"cmd-enter",
						"Cmd/Ctrl+Enter to send, Enter for newline",
					)
					.setValue(this.plugin.settings.sendMessageShortcut)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							sendMessageShortcut: value as "enter" | "cmd-enter",
						});
					}),
			);

		new Setting(containerEl)
			.setName("Session folder")
			.setDesc(
				"Vault-relative folder for new .session files. Leave empty to create them at the vault root.",
			)
			.addText((text) =>
				text
					.setPlaceholder("Sessions")
					.setValue(this.plugin.settings.sessionFolder)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							sessionFolder: value.trim(),
						});
					}),
			);

		// ─────────────────────────────────────────────────────────────────────
		// Mentions
		// ─────────────────────────────────────────────────────────────────────

		new Setting(containerEl).setName("Mentions").setHeading();

		new Setting(containerEl)
			.setName("Auto-mention active note")
			.setDesc(
				"Include the current note in your messages automatically. The agent will have access to its content without typing @notename.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoMentionActiveNote)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							autoMentionActiveNote: value,
						});
					}),
			);

		new Setting(containerEl)
			.setName("Max note length")
			.setDesc(
				"Maximum characters per mentioned note. Notes longer than this will be truncated.",
			)
			.addText((text) =>
				text
					.setPlaceholder("10000")
					.setValue(
						String(
							this.plugin.settings.displaySettings.maxNoteLength,
						),
					)
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 1) {
							await this.plugin.settingsService.updateSettings({
								displaySettings: {
									...this.plugin.settings.displaySettings,
									maxNoteLength: num,
								},
							});
						}
					}),
			);

		new Setting(containerEl)
			.setName("Max selection length")
			.setDesc(
				"Maximum characters for text selection in auto-mention. Selections longer than this will be truncated.",
			)
			.addText((text) =>
				text
					.setPlaceholder("10000")
					.setValue(
						String(
							this.plugin.settings.displaySettings
								.maxSelectionLength,
						),
					)
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 1) {
							await this.plugin.settingsService.updateSettings({
								displaySettings: {
									...this.plugin.settings.displaySettings,
									maxSelectionLength: num,
								},
							});
						}
					}),
			);

		// ─────────────────────────────────────────────────────────────────────
		// Display
		// ─────────────────────────────────────────────────────────────────────

		new Setting(containerEl).setName("Display").setHeading();

		new Setting(containerEl)
			.setName("Chat view location")
			.setDesc("Where to open new chat views")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("right-tab", "Right pane (tabs)")
					.addOption("right-split", "Right pane (split)")
					.addOption("editor-tab", "Editor area (tabs)")
					.addOption("editor-split", "Editor area (split)")
					.setValue(this.plugin.settings.chatViewLocation)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							chatViewLocation: value as ChatViewLocation,
						});
					}),
			);

		new Setting(containerEl)
			.setName("Chat font size")
			.setDesc(
				`Adjust the font size of the chat message area (${CHAT_FONT_SIZE_MIN}-${CHAT_FONT_SIZE_MAX}px).`,
			)
			.addText((text) => {
				const getCurrentDisplayValue = (): string => {
					const currentFontSize =
						this.plugin.settings.displaySettings.fontSize;
					return currentFontSize === null
						? ""
						: String(currentFontSize);
				};

				const persistChatFontSize = async (
					fontSize: number | null,
				): Promise<void> => {
					if (
						this.plugin.settings.displaySettings.fontSize ===
						fontSize
					) {
						return;
					}

					const nextSettings = {
						...this.plugin.settings,
						displaySettings: {
							...this.plugin.settings.displaySettings,
							fontSize,
						},
					};
					await this.plugin.saveSettingsAndNotify(nextSettings);
				};

				text.setPlaceholder(
					`${CHAT_FONT_SIZE_MIN}-${CHAT_FONT_SIZE_MAX}`,
				)
					.setValue(getCurrentDisplayValue())
					.onChange(async (value) => {
						if (value.trim().length === 0) {
							await persistChatFontSize(null);
							return;
						}

						const trimmedValue = value.trim();
						if (!/^-?\d+$/.test(trimmedValue)) {
							return;
						}

						const numericValue = Number.parseInt(trimmedValue, 10);
						if (
							numericValue < CHAT_FONT_SIZE_MIN ||
							numericValue > CHAT_FONT_SIZE_MAX
						) {
							return;
						}

						const parsedFontSize = parseChatFontSize(numericValue);
						if (parsedFontSize === null) {
							return;
						}

						const hasChanged =
							this.plugin.settings.displaySettings.fontSize !==
							parsedFontSize;
						if (hasChanged) {
							await persistChatFontSize(parsedFontSize);
						}
					});

				text.inputEl.addEventListener("blur", () => {
					const currentInputValue = text.getValue();
					const parsedFontSize = parseChatFontSize(currentInputValue);

					if (
						currentInputValue.trim().length > 0 &&
						parsedFontSize === null
					) {
						text.setValue(getCurrentDisplayValue());
						return;
					}

					if (parsedFontSize !== null) {
						text.setValue(String(parsedFontSize));
						const hasChanged =
							this.plugin.settings.displaySettings.fontSize !==
							parsedFontSize;
						if (hasChanged) {
							void persistChatFontSize(parsedFontSize);
						}
						return;
					}

					text.setValue("");
				});
			});

		new Setting(containerEl)
			.setName("Show emojis")
			.setDesc(
				"Display emoji icons in tool calls, thoughts, plans, and terminal blocks.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.displaySettings.showEmojis)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							displaySettings: {
								...this.plugin.settings.displaySettings,
								showEmojis: value,
							},
						});
					}),
			);

		new Setting(containerEl)
			.setName("Auto-collapse long diffs")
			.setDesc(
				"Automatically collapse diffs that exceed the line threshold.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.displaySettings.autoCollapseDiffs,
					)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							displaySettings: {
								...this.plugin.settings.displaySettings,
								autoCollapseDiffs: value,
							},
						});
						this.refresh();
					}),
			);

		if (this.plugin.settings.displaySettings.autoCollapseDiffs) {
			new Setting(containerEl)
				.setName("Collapse threshold")
				.setDesc(
					"Diffs with more lines than this will be collapsed by default.",
				)
				.addText((text) =>
					text
						.setPlaceholder("10")
						.setValue(
							String(
								this.plugin.settings.displaySettings
									.diffCollapseThreshold,
							),
						)
						.onChange(async (value) => {
							const num = parseInt(value, 10);
							if (!isNaN(num) && num > 0) {
								await this.plugin.settingsService.updateSettings(
									{
										displaySettings: {
											...this.plugin.settings
												.displaySettings,
											diffCollapseThreshold: num,
										},
									},
								);
							}
						}),
				);
		}

		// ─────────────────────────────────────────────────────────────────────
		// Floating chat
		// ─────────────────────────────────────────────────────────────────────

		new Setting(containerEl).setName("Floating chat").setHeading();

		new Setting(containerEl)
			.setName("Enable floating chat")
			.setDesc(
				"Enable the floating chat button and draggable chat windows.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableFloatingChat)
					.onChange(async (value) => {
						const wasEnabled =
							this.plugin.settings.enableFloatingChat;
						await this.plugin.settingsService.updateSettings({
							enableFloatingChat: value,
						});

						// Handle dynamic toggle of floating chat
						if (value && !wasEnabled) {
							// Turning ON: create floating chat instance
							this.plugin.openNewFloatingChat();
						} else if (!value && wasEnabled) {
							// Turning OFF: close all floating chat instances
							const instances =
								this.plugin.getFloatingChatInstances();
							for (const instanceId of instances) {
								this.plugin.closeFloatingChat(instanceId);
							}
						}
					}),
			);

		new Setting(containerEl)
			.setName("Floating button image")
			.setDesc(
				"URL or path to an image for the floating button. Leave empty for default icon.",
			)
			.addText((text) =>
				text
					.setPlaceholder("https://example.com/avatar.png")
					.setValue(this.plugin.settings.floatingButtonImage)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							floatingButtonImage: value.trim(),
						});
					}),
			);

		// ─────────────────────────────────────────────────────────────────────
		// Permissions
		// ─────────────────────────────────────────────────────────────────────

		new Setting(containerEl).setName("Permissions").setHeading();

		new Setting(containerEl)
			.setName("Auto-allow permissions")
			.setDesc(
				"Automatically allow all permission requests from agents. ⚠️ Use with caution - this gives agents full access to your system.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoAllowPermissions)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							autoAllowPermissions: value,
						});
						// Propagate to all live AcpClient instances
						this.plugin.updateAllAutoAllow(value);
					}),
			);

		// ─────────────────────────────────────────────────────────────────────
		// Notifications
		// ─────────────────────────────────────────────────────────────────────

		new Setting(containerEl).setName("Notifications").setHeading();

		new Setting(containerEl)
			.setName("System notifications")
			.setDesc(
				"Show OS notifications when the agent completes a response or requests permission. Notifications are suppressed while Obsidian is focused.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enableSystemNotifications)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							enableSystemNotifications: value,
						});
					}),
			);

		// ─────────────────────────────────────────────────────────────────────
		// Windows WSL Settings (Windows only)
		// ─────────────────────────────────────────────────────────────────────

		if (Platform.isWin) {
			new Setting(containerEl)
				.setName("Windows Subsystem for Linux")
				.setHeading();

			new Setting(containerEl)
				.setName("Enable WSL mode")
				.setDesc(
					"Run agents inside Windows Subsystem for Linux. Recommended for agents like Codex that don't work well in native Windows environments.",
				)
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.windowsWslMode)
						.onChange(async (value) => {
							await this.plugin.settingsService.updateSettings({
								windowsWslMode: value,
							});
							this.refresh(); // Refresh to show/hide distribution setting
						}),
				);

			if (this.plugin.settings.windowsWslMode) {
				new Setting(containerEl)
					.setName("WSL distribution")
					.setDesc(
						"Specify WSL distribution name (leave empty for default). Example: Ubuntu, Debian",
					)
					.addText((text) =>
						text
							.setPlaceholder("Leave empty for default")
							.setValue(
								this.plugin.settings.windowsWslDistribution ||
									"",
							)
							.onChange(async (value) => {
								await this.plugin.settingsService.updateSettings(
									{
										windowsWslDistribution:
											value.trim() || undefined,
									},
								);
							}),
					);
			}
		}

		// ─────────────────────────────────────────────────────────────────────
		// Agents
		// ─────────────────────────────────────────────────────────────────────

		new Setting(containerEl).setName("Agents").setHeading();

		this.renderAgents(containerEl);

		// ─────────────────────────────────────────────────────────────────────
		// Export
		// ─────────────────────────────────────────────────────────────────────

		new Setting(containerEl).setName("Export").setHeading();

		new Setting(containerEl)
			.setName("Export folder")
			.setDesc("Folder where chat exports will be saved")
			.addText((text) =>
				text
					.setPlaceholder("Harness")
					.setValue(this.plugin.settings.exportSettings.defaultFolder)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							exportSettings: {
								...this.plugin.settings.exportSettings,
								defaultFolder: value,
							},
						});
					}),
			);

		new Setting(containerEl)
			.setName("Filename")
			.setDesc(
				"Template for exported filenames. Use {date} for date and {time} for time",
			)
			.addText((text) =>
				text
					.setPlaceholder("harness_{date}_{time}")
					.setValue(
						this.plugin.settings.exportSettings.filenameTemplate,
					)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							exportSettings: {
								...this.plugin.settings.exportSettings,
								filenameTemplate: value,
							},
						});
					}),
			);

		new Setting(containerEl)
			.setName("Frontmatter tag")
			.setDesc(
				"Tag to add to exported notes. Supports nested tags (e.g., projects/harness). Leave empty to disable.",
			)
			.addText((text) =>
				text
					.setPlaceholder("harness")
					.setValue(
						this.plugin.settings.exportSettings.frontmatterTag,
					)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							exportSettings: {
								...this.plugin.settings.exportSettings,
								frontmatterTag: value,
							},
						});
					}),
			);

		new Setting(containerEl)
			.setName("Include images")
			.setDesc("Include images in exported markdown files")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.exportSettings.includeImages)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							exportSettings: {
								...this.plugin.settings.exportSettings,
								includeImages: value,
							},
						});
						this.refresh();
					}),
			);

		if (this.plugin.settings.exportSettings.includeImages) {
			new Setting(containerEl)
				.setName("Image location")
				.setDesc("Where to save exported images")
				.addDropdown((dropdown) =>
					dropdown
						.addOption(
							"obsidian",
							"Use Obsidian's attachment setting",
						)
						.addOption("custom", "Save to custom folder")
						.addOption(
							"base64",
							"Embed as Base64 (not recommended)",
						)
						.setValue(
							this.plugin.settings.exportSettings.imageLocation,
						)
						.onChange(async (value) => {
							await this.plugin.settingsService.updateSettings({
								exportSettings: {
									...this.plugin.settings.exportSettings,
									imageLocation: value as
										| "obsidian"
										| "custom"
										| "base64",
								},
							});
							this.refresh();
						}),
				);

			if (
				this.plugin.settings.exportSettings.imageLocation === "custom"
			) {
				new Setting(containerEl)
					.setName("Custom image folder")
					.setDesc(
						"Folder path for exported images (relative to vault root)",
					)
					.addText((text) =>
						text
							.setPlaceholder("Harness")
							.setValue(
								this.plugin.settings.exportSettings
									.imageCustomFolder,
							)
							.onChange(async (value) => {
								await this.plugin.settingsService.updateSettings(
									{
										exportSettings: {
											...this.plugin.settings
												.exportSettings,
											imageCustomFolder: value,
										},
									},
								);
							}),
					);
			}
		}

		new Setting(containerEl)
			.setName("Auto-export on new chat")
			.setDesc(
				"Automatically export the current chat when starting a new chat",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.exportSettings.autoExportOnNewChat,
					)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							exportSettings: {
								...this.plugin.settings.exportSettings,
								autoExportOnNewChat: value,
							},
						});
					}),
			);

		new Setting(containerEl)
			.setName("Auto-export on close chat")
			.setDesc(
				"Automatically export the current chat when closing the chat view",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.exportSettings
							.autoExportOnCloseChat,
					)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							exportSettings: {
								...this.plugin.settings.exportSettings,
								autoExportOnCloseChat: value,
							},
						});
					}),
			);

		new Setting(containerEl)
			.setName("Open note after export")
			.setDesc("Automatically open the exported note after exporting")
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.exportSettings.openFileAfterExport,
					)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							exportSettings: {
								...this.plugin.settings.exportSettings,
								openFileAfterExport: value,
							},
						});
					}),
			);

		// ─────────────────────────────────────────────────────────────────────
		// Developer
		// ─────────────────────────────────────────────────────────────────────

		new Setting(containerEl).setName("Developer").setHeading();

		new Setting(containerEl)
			.setName("Debug mode")
			.setDesc(
				"Enable debug logging to console. Useful for development and troubleshooting.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value) => {
						await this.plugin.settingsService.updateSettings({
							debugMode: value,
						});
					}),
			);
	}

	/**
	 * Update the agent dropdown when settings change.
	 * Only updates if the value is different to avoid infinite loops.
	 */
	private updateAgentDropdown(): void {
		if (!this.agentSelector) {
			return;
		}

		// Get latest settings from store snapshot
		const settings = this.plugin.settingsService.getSnapshot();
		const currentValue = this.agentSelector.getValue();

		// Only update if different to avoid triggering onChange
		if (settings.defaultAgentId !== currentValue) {
			this.agentSelector.setValue(settings.defaultAgentId);
		}
	}

	private refresh(): void {
		// eslint-disable-next-line @typescript-eslint/no-deprecated -- Obsidian settings tabs still refresh by re-rendering display().
		this.display();
	}

	/**
	 * Called when the settings tab is hidden.
	 * Clean up subscriptions to prevent memory leaks.
	 */
	hide(): void {
		if (this.unsubscribe) {
			this.unsubscribe();
			this.unsubscribe = null;
		}
	}

	private renderAgentSelector(containerEl: HTMLElement) {
		this.plugin.ensureDefaultAgentId();

		new Setting(containerEl)
			.setName("Default agent")
			.setDesc("Choose which agent is used when opening a new chat view.")
			.addDropdown((dropdown) => {
				this.agentSelector = dropdown;
				this.populateAgentDropdown(dropdown);
				dropdown.setValue(this.plugin.settings.defaultAgentId);
				dropdown.onChange(async (value) => {
					const nextSettings = {
						...this.plugin.settings,
						defaultAgentId: value,
					};
					this.plugin.ensureDefaultAgentId();
					await this.plugin.saveSettingsAndNotify(nextSettings);
				});
			});
	}

	private populateAgentDropdown(dropdown: DropdownComponent) {
		dropdown.selectEl.empty();
		for (const option of this.getAgentOptions()) {
			dropdown.addOption(option.id, option.label);
		}
	}

	private refreshAgentDropdown() {
		if (!this.agentSelector) {
			return;
		}
		this.populateAgentDropdown(this.agentSelector);
		this.agentSelector.setValue(this.plugin.settings.defaultAgentId);
	}

	private getAgentOptions(): { id: string; label: string }[] {
		const toOption = (id: string, displayName: string) => ({
			id,
			label: `${displayName} (${id})`,
		});
		const options: { id: string; label: string }[] = [];
		for (const agent of this.plugin.settings.agents) {
			if (agent.id && agent.id.length > 0) {
				options.push(toOption(agent.id, agent.displayName || agent.id));
			}
		}
		const seen = new Set<string>();
		return options.filter(({ id }) => {
			if (seen.has(id)) {
				return false;
			}
			seen.add(id);
			return true;
		});
	}

	private renderAgents(containerEl: HTMLElement) {
		const { agents } = this.plugin.settings;
		if (agents.length === 0) {
			containerEl.createEl("p", {
				text: "No agents configured yet. Add an agent to start a session.",
			});
		} else {
			agents.forEach((agent, index) => {
				this.renderAgentBlock(containerEl, agent, index);
			});
		}

		new Setting(containerEl).addButton((button) => {
			button
				.setButtonText("Add agent")
				.setCta()
				.onClick(async () => {
					const newId = generateUnoccupiedAgentId(
						this.plugin.settings.agents,
					);
					const newDisplayName = this.generateAgentDisplayName();
					this.plugin.settings.agents.push({
						id: newId,
						displayName: newDisplayName,
						command: "",
						args: [],
						env: [],
						apiKeySecretId: "",
						apiKeyEnvVarName: "",
					});
					this.plugin.ensureDefaultAgentId();
					await this.flushSettings();
					this.refresh();
				});
		});
	}

	private renderAgentBlock(
		containerEl: HTMLElement,
		agent: AgentSettings,
		index: number,
	) {
		const blockEl = containerEl.createDiv({
			cls: "harness-custom-agent",
		});

		// 1. Agent ID (with delete button at the end of the row)
		const idSetting = new Setting(blockEl)
			.setName("Agent ID")
			.setDesc("Unique identifier used to reference this agent.")
			.addText((text) => {
				text.setPlaceholder("custom-agent")
					.setValue(agent.id)
					.onChange(async (value) => {
						const previousId =
							this.plugin.settings.agents[index].id;
						const trimmed = value.trim();
						let nextId = trimmed;
						const occupiedByOther = this.plugin.settings.agents.some(
							(entry, entryIndex) =>
								entryIndex !== index && entry.id === trimmed,
						);
						if (nextId.length === 0 || occupiedByOther) {
							nextId = generateUnoccupiedAgentId(
								this.plugin.settings.agents.filter(
									(_, entryIndex) => entryIndex !== index,
								),
							);
							text.setValue(nextId);
						}
						this.plugin.settings.agents[index].id = nextId;
						if (
							this.plugin.settings.defaultAgentId === previousId
						) {
							this.plugin.settings.defaultAgentId = nextId;
						}
						this.plugin.ensureDefaultAgentId();
						await this.flushSettings();
						this.refreshAgentDropdown();
					});
			});

		// Any entry — including built-in default entries — can be deleted (BR-071)
		idSetting.addExtraButton((button) => {
			button
				.setIcon("trash")
				.setTooltip("Delete this agent")
				.onClick(async () => {
					this.plugin.settings.agents.splice(index, 1);
					this.plugin.ensureDefaultAgentId();
					await this.flushSettings();
					this.refresh();
				});
		});

		// 2. Display name
		new Setting(blockEl)
			.setName("Display name")
			.setDesc("Shown in menus and headers.")
			.addText((text) => {
				text.setPlaceholder(agent.id)
					.setValue(agent.displayName || agent.id)
					.onChange(async (value) => {
						const trimmed = value.trim();
						this.plugin.settings.agents[index].displayName =
							trimmed.length > 0
								? trimmed
								: this.plugin.settings.agents[index].id;
						await this.flushSettings();
						this.refreshAgentDropdown();
					});
			});

		// 3. Path (with auto-detect button)
		const pathSetting = new Setting(blockEl)
			.setName("Path")
			.setDesc(
				"Command name or path to the agent. Use just the command name to let the login shell resolve it, or enter an absolute path.",
			)
			.addText((text) => {
				text.setPlaceholder("Command name or path")
					.setValue(agent.command)
					.onChange(async (value) => {
						this.plugin.settings.agents[index].command =
							value.trim();
						await this.flushSettings();
					});
			});
		if (agent.command) {
			this.addAutoDetectButton(pathSetting, agent.command, async (path) => {
				this.plugin.settings.agents[index].command = path;
				await this.flushSettings();
			});
		}

		// 4. Arguments
		new Setting(blockEl)
			.setName("Arguments")
			.setDesc(
				"Enter one argument per line. Leave empty to run without arguments.",
			)
			.addTextArea((text) => {
				text.setPlaceholder("--flag\n--another=value")
					.setValue(this.formatArgs(agent.args))
					.onChange(async (value) => {
						this.plugin.settings.agents[index].args =
							this.parseArgs(value);
						await this.flushSettings();
					});
				text.inputEl.rows = 3;
			});

		// 5. API key (secret reference — the key itself never touches data.json)
		new Setting(blockEl)
			.setName("API key")
			.setDesc(
				"API key for this agent. The key is stored in Obsidian's Keychain and is never written to data.json — only the secret reference is saved.",
			)
			.addComponent((el) =>
				new SecretComponent(this.app, el)
					.setValue(agent.apiKeySecretId)
					.onChange(async (value) => {
						this.plugin.settings.agents[index].apiKeySecretId =
							value;
						await this.flushSettings();
					}),
			);

		// 6. API key env var name
		new Setting(blockEl)
			.setName("API key env var name")
			.setDesc(
				"Environment variable name used to inject the API key into the agent process. Only meaningful when an API key is configured above; leave empty to disable injection.",
			)
			.addText((text) => {
				text.setPlaceholder("ANTHROPIC_API_KEY")
					.setValue(agent.apiKeyEnvVarName)
					.onChange(async (value) => {
						this.plugin.settings.agents[index].apiKeyEnvVarName =
							value.trim();
						await this.flushSettings();
					});
			});

		// 7. Environment variables
		new Setting(blockEl)
			.setName("Environment variables")
			.setDesc(
				"Enter KEY=VALUE pairs, one per line. Stored as plain text in data.json — do not put secrets here; use the API key field above instead.",
			)
			.addTextArea((text) => {
				text.setPlaceholder("TOKEN=...")
					.setValue(this.formatEnv(agent.env))
					.onChange(async (value) => {
						this.plugin.settings.agents[index].env =
							this.parseEnv(value);
						await this.flushSettings();
					});
				text.inputEl.rows = 3;
			});
	}

	/**
	 * Flush the current `plugin.settings` state through `settingsService.updateSettings()`
	 * so that React components subscribed via `useSettings` re-render.
	 *
	 * Use this after calling legacy helpers (e.g. `ensureDefaultAgentId`) that mutate
	 * `plugin.settings` directly. Passes the current values as the "update" to trigger
	 * the notification pipeline without re-merging.
	 */
	private async flushSettings(): Promise<void> {
		await this.plugin.settingsService.updateSettings({
			agents: this.plugin.settings.agents,
			defaultAgentId: this.plugin.settings.defaultAgentId,
		});
	}

	private generateAgentDisplayName(): string {
		const base = "Custom agent";
		const existing = new Set<string>();
		for (const item of this.plugin.settings.agents) {
			existing.add(item.displayName || item.id);
		}
		if (!existing.has(base)) {
			return base;
		}
		let counter = 2;
		let candidate = `${base} ${counter}`;
		while (existing.has(candidate)) {
			counter += 1;
			candidate = `${base} ${counter}`;
		}
		return candidate;
	}

	/**
	 * Shared helper: adds an "Auto-detect" button to a Path setting.
	 * Calls `resolveCommandPath(commandName)` and, on success, writes the
	 * resolved absolute path via `onResolved`, then re-renders the tab.
	 */
	private addAutoDetectButton(
		setting: import("obsidian").Setting,
		commandName: string,
		onResolved: (path: string) => Promise<void>,
	): void {
		setting.addButton((btn) => {
			const isWsl = Platform.isWin && this.plugin.settings.windowsWslMode;
			const lookupCmd = Platform.isWin && !isWsl ? "where" : "which";
			btn.setButtonText("Auto-detect")
				.setTooltip(
					`Run \`${lookupCmd} ${commandName}\` to find the path`,
				)
				.onClick(async () => {
					btn.setButtonText("Detecting…");
					btn.setDisabled(true);
					try {
						const found = isWsl
							? await resolveCommandPathInWsl(
									commandName,
									this.plugin.settings
										.windowsWslDistribution || undefined,
								)
							: await resolveCommandPath(commandName);
						if (found) {
							await onResolved(found);
							this.refresh();
						} else {
							btn.setButtonText("Not found");
							window.setTimeout(() => {
								btn.setButtonText("Auto-detect");
								btn.setDisabled(false);
							}, 2000);
						}
					} catch {
						btn.setButtonText("Error");
						window.setTimeout(() => {
							btn.setButtonText("Auto-detect");
							btn.setDisabled(false);
						}, 2000);
					}
				});
		});
	}

	private formatArgs(args: string[]): string {
		return args.join("\n");
	}

	private parseArgs(value: string): string[] {
		return value
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
	}

	private formatEnv(env: AgentEnvVar[]): string {
		return env
			.map((entry) => `${entry.key}=${entry.value ?? ""}`)
			.join("\n");
	}

	private parseEnv(value: string): AgentEnvVar[] {
		const envVars: AgentEnvVar[] = [];

		for (const line of value.split(/\r?\n/)) {
			const trimmed = line.trim();
			if (!trimmed) {
				continue;
			}
			const delimiter = trimmed.indexOf("=");
			if (delimiter === -1) {
				continue;
			}
			const key = trimmed.slice(0, delimiter).trim();
			const envValue = trimmed.slice(delimiter + 1).trim();
			if (!key) {
				continue;
			}
			envVars.push({ key, value: envValue });
		}

		return normalizeEnvVars(envVars);
	}
}
