import { browser } from "@wdio/globals";

import {
	closeSettings,
	openPluginSettingsAndWait,
} from "./support/settings-tab";

/**
 * E2E acceptance for AC-0029 (Agents 分区与统一编辑器).
 *
 * The spec drives the Obsidian-native settings UI: it mutates agent entries
 * through DOM inputs/buttons and asserts both the rendered structure and the
 * persisted `plugin.settings.agents` state.
 *
 * Fixture hygiene: the test vault ships a legacy-schema data.json. The suite
 * snapshots the raw file plus the normalized in-memory state in `before()` and
 * restores both in `after()`, so the vault fixture stays byte-identical.
 */

const PLUGIN_ID = "obsidian-harness";
const CONTENT = ".modal.mod-settings .vertical-tab-content";
const DATA_JSON = ".obsidian/plugins/obsidian-harness/data.json";

const EXPECTED_FIELD_ORDER = [
	"Agent ID",
	"Display name",
	"Path",
	"Arguments",
	"API key",
	"API key env var name",
	"Environment variables",
];

interface AgentSnapshot {
	id: string;
	displayName: string;
	command: string;
	args: string[];
	env: { key: string; value: string }[];
	apiKeySecretId: string;
	apiKeyEnvVarName: string;
}

interface SettingsState {
	agents: AgentSnapshot[];
	defaultAgentId: string;
}

async function readSettingsState(): Promise<SettingsState> {
	return browser.execute((pluginId: string) => {
		const plugin = (window as any).app.plugins.plugins[pluginId];
		return {
			agents: JSON.parse(JSON.stringify(plugin.settings.agents)),
			defaultAgentId: plugin.settings.defaultAgentId,
		};
	}, PLUGIN_ID);
}

/** Replaces agents/defaultAgentId and re-renders the open settings tab. */
async function arrangeAgents(
	agents: AgentSnapshot[],
	defaultAgentId: string,
): Promise<void> {
	await browser.execute(
		async (pluginId: string, nextAgents, nextDefault) => {
			const app = (window as any).app;
			const plugin = app.plugins.plugins[pluginId];
			await plugin.settingsService.updateSettings({
				agents: JSON.parse(JSON.stringify(nextAgents)),
				defaultAgentId: nextDefault,
			});
			// updateSettings does not re-render agent blocks; force display().
			app.setting.activeTab?.display?.();
		},
		PLUGIN_ID,
		agents,
		defaultAgentId,
	);
}

interface AgentsSectionDom {
	headings: string[];
	blocks: {
		rows: {
			name: string;
			desc: string;
			hasDelete: boolean;
			buttonTexts: string[];
		}[];
		idValue: string;
	}[];
	buttonTexts: string[];
	ctaButtonTexts: string[];
	paragraphs: string[];
}

async function readAgentsSection(): Promise<AgentsSectionDom> {
	return browser.execute((contentSelector: string) => {
		const content = document.querySelector(contentSelector);
		if (!content) throw new Error("settings tab content not found");
		const text = (el: Element | null | undefined) =>
			el?.textContent?.trim() ?? "";
		return {
			headings: Array.from(
				content.querySelectorAll(
					".setting-item-heading .setting-item-name",
				),
			).map(text),
			blocks: Array.from(
				content.querySelectorAll(".harness-custom-agent"),
			).map((block) => {
				const rows = Array.from(
					block.querySelectorAll(":scope > .setting-item"),
				).map((row) => ({
					name: text(row.querySelector(".setting-item-name")),
					desc: text(
						row.querySelector(".setting-item-description"),
					),
					hasDelete:
						row.querySelector(
							".setting-item-control .extra-setting-button",
						) !== null,
					buttonTexts: Array.from(
						row.querySelectorAll(".setting-item-control button"),
					).map(text),
				}));
				const idInput = block.querySelector<HTMLInputElement>(
					":scope > .setting-item input",
				);
				return { rows, idValue: idInput?.value ?? "" };
			}),
			buttonTexts: Array.from(content.querySelectorAll("button")).map(
				text,
			),
			ctaButtonTexts: Array.from(
				content.querySelectorAll("button.mod-cta"),
			).map(text),
			paragraphs: Array.from(content.querySelectorAll("p")).map(text),
		};
	}, CONTENT);
}

async function readDefaultAgentDropdown(): Promise<{
	options: { value: string; text: string }[];
	value: string;
} | null> {
	return browser.execute((contentSelector: string) => {
		const content = document.querySelector(contentSelector);
		if (!content) throw new Error("settings tab content not found");
		const row = Array.from(content.querySelectorAll(".setting-item")).find(
			(item) =>
				item.querySelector(".setting-item-name")?.textContent?.trim() ===
				"Default agent",
		);
		const select = row?.querySelector("select");
		if (!select) return null;
		return {
			options: Array.from(select.options).map((option) => ({
				value: option.value,
				text: option.text,
			})),
			value: select.value,
		};
	}, CONTENT);
}

/** Types into a field of an agent block, triggering the Obsidian onChange. */
async function setAgentField(
	blockIndex: number,
	rowName: string,
	value: string,
): Promise<void> {
	await browser.execute(
		(
			contentSelector: string,
			idx: number,
			name: string,
			nextValue: string,
		) => {
			const content = document.querySelector(contentSelector);
			if (!content) throw new Error("settings tab content not found");
			const block =
				content.querySelectorAll(".harness-custom-agent")[idx];
			if (!block) throw new Error(`agent block ${idx} not found`);
			const row = Array.from(
				block.querySelectorAll(".setting-item"),
			).find(
				(item) =>
					item
						.querySelector(".setting-item-name")
						?.textContent?.trim() === name,
			);
			if (!row) {
				throw new Error(`row "${name}" not found in block ${idx}`);
			}
			const field = row.querySelector<HTMLInputElement | HTMLTextAreaElement>(
				"input, textarea",
			);
			if (!field) throw new Error(`input for "${name}" not found`);
			field.value = nextValue;
			field.dispatchEvent(new Event("input", { bubbles: true }));
		},
		CONTENT,
		blockIndex,
		rowName,
		value,
	);
}

async function clickAddAgent(): Promise<void> {
	await browser.execute((contentSelector: string) => {
		const content = document.querySelector(contentSelector);
		if (!content) throw new Error("settings tab content not found");
		const button = Array.from(content.querySelectorAll("button")).find(
			(candidate) => candidate.textContent?.trim() === "Add agent",
		);
		if (!button) throw new Error("Add agent button not found");
		button.click();
	}, CONTENT);
}

async function clickDeleteAgent(blockIndex: number): Promise<void> {
	await browser.execute(
		(contentSelector: string, idx: number) => {
			const content = document.querySelector(contentSelector);
			if (!content) throw new Error("settings tab content not found");
			const block =
				content.querySelectorAll(".harness-custom-agent")[idx];
			if (!block) throw new Error(`agent block ${idx} not found`);
			const button = block.querySelector<HTMLElement>(
				".setting-item .setting-item-control .extra-setting-button",
			);
			if (!button) {
				throw new Error(`delete button not found in block ${idx}`);
			}
			button.click();
		},
		CONTENT,
		blockIndex,
	);
}

async function waitForAgentCount(
	count: number,
	timeoutMsg: string,
): Promise<void> {
	await browser.waitUntil(
		async () => (await readSettingsState()).agents.length === count,
		{ timeout: 5000, interval: 50, timeoutMsg },
	);
}

async function waitForBlockCount(
	count: number,
	timeoutMsg: string,
): Promise<void> {
	await browser.waitUntil(
		async () => (await readAgentsSection()).blocks.length === count,
		{ timeout: 5000, interval: 50, timeoutMsg },
	);
}

describe("AC-0029 Agents settings section", () => {
	let originalState: SettingsState;
	let originalDataJson: string | null = null;

	before(async () => {
		await openPluginSettingsAndWait();
		originalState = await readSettingsState();
		originalDataJson = await browser.execute(async (dataPath: string) => {
			const adapter = (window as any).app.vault.adapter;
			return (await adapter.exists(dataPath))
				? await adapter.read(dataPath)
			: null;
		}, DATA_JSON);
	});

	after(async () => {
		// Restore in-memory settings, then rewrite the raw data.json so the
		// vault fixture stays byte-identical (updateSettings persists
		// immediately and would otherwise drop legacy schema keys).
		await browser.execute(
			async (pluginId: string, state: SettingsState) => {
				const plugin = (window as any).app.plugins.plugins[pluginId];
				await plugin.settingsService.updateSettings({
					agents: JSON.parse(JSON.stringify(state.agents)),
					defaultAgentId: state.defaultAgentId,
				});
			},
			PLUGIN_ID,
			originalState,
		);
		if (originalDataJson !== null) {
			await browser.execute(
				async (dataPath: string, raw: string) => {
					await (window as any).app.vault.adapter.write(dataPath, raw);
				},
				DATA_JSON,
				originalDataJson,
			);
		}
		await closeSettings();
	});

	it("AC-0029-N-1: renders a single Agents section with the unified editor", async () => {
		const section = await readAgentsSection();

		expect(
			section.headings.filter((name) => name === "Agents"),
		).toHaveLength(1);
		expect(section.headings).not.toContain("Built-in agents");
		expect(section.headings).not.toContain("Custom agents");

		expect(section.blocks).toHaveLength(4);
		expect(section.blocks.map((block) => block.idValue)).toEqual([
			"claude-code-acp",
			"codex-acp",
			"gemini-cli",
			"pi-acp",
		]);
		for (const block of section.blocks) {
			expect(block.rows.map((row) => row.name)).toEqual(
				EXPECTED_FIELD_ORDER,
			);
			expect(block.rows[0].hasDelete).toBe(true);
			// All built-in defaults carry a command, so Path shows auto-detect.
			expect(block.rows[2].buttonTexts).toContain("Auto-detect");
		}
		expect(section.ctaButtonTexts).toContain("Add agent");
	});

	it("AC-0029-N-2: edits a built-in entry through the same editor path", async () => {
		await arrangeAgents(originalState.agents, "claude-code-acp");
		await waitForBlockCount(4, "agent blocks did not re-render");

		const startedAt = Date.now();
		await setAgentField(0, "Display name", "Claude Prime");
		await setAgentField(0, "Path", "/usr/local/bin/claude-agent-acp");
		await setAgentField(0, "Arguments", "--verbose\n--foo=bar");
		await setAgentField(0, "Environment variables", "FOO=bar\nBAZ=qux");

		let dropdownRefreshedAt = -1;
		await browser.waitUntil(
			async () => {
				const dropdown = await readDefaultAgentDropdown();
				if (
					dropdown?.options.some((option) =>
						option.text.startsWith("Claude Prime ("),
					)
				) {
					dropdownRefreshedAt = Date.now();
					return true;
				}
				return false;
			},
			{
				timeout: 5000,
				interval: 10,
				timeoutMsg: "default agent dropdown did not refresh",
			},
		);

		const state = await readSettingsState();
		expect(state.agents[0]).toMatchObject({
			id: "claude-code-acp",
			displayName: "Claude Prime",
			command: "/usr/local/bin/claude-agent-acp",
			args: ["--verbose", "--foo=bar"],
			env: [
				{ key: "FOO", value: "bar" },
				{ key: "BAZ", value: "qux" },
			],
		});

		const refreshLatency = dropdownRefreshedAt - startedAt;
		console.log(
			`[AC-0029-N-2] dropdown refresh latency: ${refreshLatency}ms`,
		);
		expect(refreshLatency).toBeLessThan(2000);
	});

	it("AC-0029-N-3: adds an agent and edits its fields", async () => {
		await arrangeAgents(originalState.agents, "claude-code-acp");
		await waitForBlockCount(4, "agent blocks did not re-render");

		await clickAddAgent();
		await waitForAgentCount(5, "new agent was not persisted");
		await waitForBlockCount(5, "new agent block did not render");

		let state = await readSettingsState();
		expect(state.agents[4].id).toMatch(/^custom-agent(-\d+)?$/);
		expect(state.agents[4].displayName).toMatch(/^Custom agent( \d+)?$/);

		await setAgentField(4, "Agent ID", "e2e-agent");
		await setAgentField(4, "Display name", "E2E Agent");
		await setAgentField(4, "Path", "/bin/true");
		await setAgentField(4, "Arguments", "--acp");

		await browser.waitUntil(
			async () =>
				(await readSettingsState()).agents.some(
					(agent) =>
						agent.id === "e2e-agent" &&
						agent.displayName === "E2E Agent",
				),
			{
				timeout: 5000,
				interval: 50,
				timeoutMsg: "edited agent fields were not persisted",
			},
		);

		state = await readSettingsState();
		const added = state.agents.find((agent) => agent.id === "e2e-agent");
		expect(added).toMatchObject({
			displayName: "E2E Agent",
			command: "/bin/true",
			args: ["--acp"],
		});

		const dropdown = await readDefaultAgentDropdown();
		expect(dropdown?.options.map((option) => option.value)).toContain(
			"e2e-agent",
		);
	});

	it("AC-0029-N-4: shows the mandated secret-handling descriptions", async () => {
		await arrangeAgents(originalState.agents, "claude-code-acp");
		await waitForBlockCount(4, "agent blocks did not re-render");

		const section = await readAgentsSection();
		const rows = section.blocks[0].rows;
		const descOf = (name: string) =>
			rows.find((row) => row.name === name)?.desc ?? "";

		expect(descOf("API key")).toContain("Obsidian's Keychain");
		expect(descOf("API key")).toContain("never written to data.json");
		expect(descOf("API key env var name")).toContain(
			"leave empty to disable injection",
		);
		expect(descOf("Environment variables")).toContain(
			"do not put secrets here",
		);
	});

	it("AC-0029-B-1: regenerates a cleared Agent ID and syncs the default", async () => {
		await arrangeAgents(originalState.agents, "claude-code-acp");
		await waitForBlockCount(4, "agent blocks did not re-render");

		await setAgentField(0, "Agent ID", "");
		await browser.waitUntil(
			async () =>
				(await readSettingsState()).agents[0]?.id !== "claude-code-acp",
			{
				timeout: 5000,
				interval: 50,
				timeoutMsg: "cleared Agent ID was not regenerated",
			},
		);

		const state = await readSettingsState();
		const regenerated = state.agents[0].id;
		expect(regenerated).toMatch(/^custom-agent(-\d+)?$/);
		expect(new Set(state.agents.map((agent) => agent.id)).size).toBe(4);
		expect(state.defaultAgentId).toBe(regenerated);

		const section = await readAgentsSection();
		expect(section.blocks[0].idValue).toBe(regenerated);
		const dropdown = await readDefaultAgentDropdown();
		expect(dropdown?.value).toBe(regenerated);
	});

	it("AC-0029-B-2: falls back after deleting the default and shows an empty state", async () => {
		await arrangeAgents(originalState.agents, "claude-code-acp");
		await waitForBlockCount(4, "agent blocks did not re-render");

		await clickDeleteAgent(0);
		await waitForAgentCount(3, "default agent was not deleted");
		expect((await readSettingsState()).defaultAgentId).toBe("codex-acp");

		await clickDeleteAgent(0);
		await waitForAgentCount(2, "second agent was not deleted");
		await clickDeleteAgent(0);
		await waitForAgentCount(1, "third agent was not deleted");
		await clickDeleteAgent(0);
		await waitForAgentCount(0, "last agent was not deleted");
		await waitForBlockCount(0, "agent blocks did not disappear");

		const section = await readAgentsSection();
		expect(section.paragraphs).toContain(
			"No agents configured yet. Add an agent to start a session.",
		);
		expect(section.ctaButtonTexts).toContain("Add agent");

		const state = await readSettingsState();
		expect(state.defaultAgentId).toBe("");

		const dropdown = await readDefaultAgentDropdown();
		expect(dropdown?.options).toHaveLength(0);
	});

	it("AC-0029-E-1: persists an entry with an empty command as-is", async () => {
		const noopAgent: AgentSnapshot = {
			id: "e2e-noop",
			displayName: "Noop",
			command: "",
			args: [],
			env: [],
			apiKeySecretId: "",
			apiKeyEnvVarName: "",
		};
		await arrangeAgents(
			[...originalState.agents, noopAgent],
			"claude-code-acp",
		);
		await waitForBlockCount(5, "noop agent block did not render");

		// Save through the UI once (edit the display name) and confirm the
		// empty command survives untouched.
		await setAgentField(4, "Display name", "Noop Renamed");
		await browser.waitUntil(
			async () =>
				(await readSettingsState()).agents.some(
					(agent) => agent.displayName === "Noop Renamed",
				),
			{
				timeout: 5000,
				interval: 50,
				timeoutMsg: "display name edit was not persisted",
			},
		);

		const state = await readSettingsState();
		const persisted = state.agents.find((agent) => agent.id === "e2e-noop");
		expect(persisted).toMatchObject({
			displayName: "Noop Renamed",
			command: "",
		});

		const dropdown = await readDefaultAgentDropdown();
		expect(dropdown?.options.map((option) => option.value)).toContain(
			"e2e-noop",
		);

		// The entry is written verbatim to data.json (spawn-time failure for
		// the empty command is covered by the spawn error path integration
		// tests, not by this UI-level spec).
		const persistedRaw = await browser.execute(
			async (dataPath: string) => {
				const adapter = (window as any).app.vault.adapter;
				return JSON.parse(await adapter.read(dataPath));
			},
			DATA_JSON,
		);
		expect(
			(persistedRaw.agents as AgentSnapshot[]).find(
				(agent) => agent.id === "e2e-noop",
			)?.command,
		).toBe("");
	});

	it("AC-0029-F-1: keeps settings and UI consistent across rapid add/delete", async () => {
		await arrangeAgents(originalState.agents, "claude-code-acp");
		await waitForBlockCount(4, "agent blocks did not re-render");

		// Alternating adds and deletes, including deleting a just-added entry.
		await clickAddAgent();
		await waitForAgentCount(5, "add #1 was not persisted");
		await waitForBlockCount(5, "add #1 did not render");
		await clickDeleteAgent(4); // delete the just-added entry
		await waitForAgentCount(4, "delete of new entry was not persisted");
		await waitForBlockCount(4, "delete of new entry did not render");

		await clickAddAgent();
		await waitForAgentCount(5, "add #2 was not persisted");
		await waitForBlockCount(5, "add #2 did not render");
		await clickDeleteAgent(0); // delete a pre-existing entry
		await waitForAgentCount(4, "delete of existing entry was not persisted");
		await waitForBlockCount(4, "delete of existing entry did not render");

		await clickAddAgent();
		await waitForAgentCount(5, "add #3 was not persisted");
		await waitForBlockCount(5, "add #3 did not render");

		const state = await readSettingsState();
		const section = await readAgentsSection();

		// UI and persisted state agree.
		expect(section.blocks.map((block) => block.idValue)).toEqual(
			state.agents.map((agent) => agent.id),
		);
		// No duplicate ids.
		expect(new Set(state.agents.map((agent) => agent.id)).size).toBe(
			state.agents.length,
		);
		// defaultAgentId points at an existing entry or is empty.
		const ids = state.agents.map((agent) => agent.id);
		expect(
			state.defaultAgentId === "" ||
				ids.includes(state.defaultAgentId),
		).toBe(true);
	});
});
