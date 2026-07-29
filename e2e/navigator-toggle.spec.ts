import { browser } from "@wdio/globals";

/**
 * E2E acceptance for AC-0027 (Navigator 切换按钮 — Session 视图 header).
 *
 * Fixture: a minimal .session entry file opened as a HarnessSessionView
 * (sidebar-variant ChatPanel). The agent spawn behind the view may fail on
 * machines without the configured backend; the header under test renders
 * regardless, so the spec never depends on a live agent.
 */

const PLUGIN_ID = "obsidian-harness";
const ENTRY_PATH = "Sessions/navigator-toggle.session";
const TOGGLE = '[aria-label="Open session navigator"]';
const MORE = '[aria-label="More"]';
const HEADER = ".harness-chat-view-header";
const VIEW_TYPE_SESSION = "harness-session-view";
const VIEW_TYPE_LEGACY_CHAT = "harness-chat-view";
const VIEW_TYPE_NAVIGATOR = "harness-session-manager";

async function openSessionView(): Promise<void> {
	await browser.execute(async (entryPath: string) => {
		const app = (window as any).app;
		const file = app.vault.getAbstractFileByPath(entryPath);
		if (!file) throw new Error(`fixture missing: ${entryPath}`);
		const leaf = app.workspace.getLeaf(false);
		await leaf.openFile(file);
	}, ENTRY_PATH);
	await browser.waitUntil(
		() =>
			browser.execute(
				(selector: string) =>
					document.querySelector(selector) !== null,
				`${HEADER} .nav-buttons-container ${TOGGLE}`,
			),
		{
			timeout: 5000,
			interval: 100,
			timeoutMsg: "session view header toggle did not render",
		},
	);
}

/** Installs (once) a counting spy around plugin.activateSessionManager. */
async function installActionSpy(): Promise<void> {
	await browser.execute((pluginId: string) => {
		const plugin = (window as any).app.plugins.plugins[pluginId];
		(window as any).__navigatorToggleCalls = 0;
		if (!plugin.__navigatorToggleOriginal) {
			plugin.__navigatorToggleOriginal = plugin.activateSessionManager;
		}
		plugin.activateSessionManager = async function (
			this: unknown,
			...args: unknown[]
		) {
			(window as any).__navigatorToggleCalls += 1;
			return plugin.__navigatorToggleOriginal.apply(this, args);
		};
	}, PLUGIN_ID);
}

async function readActionSpyCalls(): Promise<number> {
	return browser.execute(
		() => (window as any).__navigatorToggleCalls ?? 0,
	);
}

async function restoreActionSpy(): Promise<void> {
	await browser.execute((pluginId: string) => {
		const plugin = (window as any).app.plugins.plugins[pluginId];
		if (plugin.__navigatorToggleOriginal) {
			plugin.activateSessionManager = plugin.__navigatorToggleOriginal;
			delete plugin.__navigatorToggleOriginal;
		}
		delete (window as any).__navigatorToggleCalls;
	}, PLUGIN_ID);
}

async function clickToggle(): Promise<void> {
	const fullSelector = `${HEADER} .nav-buttons-container ${TOGGLE}`;
	await browser.execute((selector: string) => {
		const button = document.querySelector<HTMLElement>(selector);
		if (!button) throw new Error("navigator toggle not found");
		button.click();
	}, fullSelector);
}

async function countLeaves(viewType: string): Promise<number> {
	return browser.execute(
		(type: string) =>
			(window as any).app.workspace.getLeavesOfType(type).length,
		viewType,
	);
}

async function waitForLeafCount(
	viewType: string,
	count: number,
): Promise<void> {
	await browser.waitUntil(async () => (await countLeaves(viewType)) === count, {
		timeout: 5000,
		interval: 100,
		timeoutMsg: `expected ${count} leaf(s) of type ${viewType}`,
	});
}

async function waitForNotice(text: string): Promise<void> {
	await browser.waitUntil(
		() =>
			browser.execute(
				(expected: string) =>
					Array.from(
						document.querySelectorAll<HTMLElement>(".notice"),
					).some((notice) => notice.innerText.includes(expected)),
				text,
			),
		{
			timeout: 3000,
			interval: 100,
			timeoutMsg: `notice "${text}" did not appear`,
		},
	);
}

describe("AC-0027 Navigator toggle in session view header", () => {
	let preExistingSessionFiles: string[] = [];

	before(async () => {
		preExistingSessionFiles = await browser.execute(
			async (entryPath: string) => {
				const app = (window as any).app;
				const existing = app.vault
					.getFiles()
					.filter((file: any) => file.extension === "session")
					.map((file: any) => file.path);
				if (!app.vault.getAbstractFileByPath("Sessions")) {
					await app.vault.createFolder("Sessions");
				}
				const old = app.vault.getAbstractFileByPath(entryPath);
				if (old) await app.vault.delete(old, true);
				await app.vault.create(
					entryPath,
					JSON.stringify({
						version: 2,
						entryId: "navigator-toggle-entry",
						historyId: "navigator-toggle-history",
						agentId: "",
						cwd: app.vault.adapter.getBasePath(),
						title: "Navigator toggle fixture",
						createdAt: "2026-07-29T00:00:00.000Z",
						updatedAt: "2026-07-29T00:00:00.000Z",
						forkedFrom: null,
					}),
				);
				return existing;
			},
			ENTRY_PATH,
		);
	});

	after(async () => {
		await restoreActionSpy();
		await browser.execute(
			async (entryPath: string, keep: string[]) => {
				const app = (window as any).app;
				const plugin = app.plugins.plugins["obsidian-harness"];
				for (const viewId of plugin.getFloatingChatInstances()) {
					plugin.closeFloatingChat(viewId);
				}
				app.workspace.detachLeavesOfType("harness-session-manager");
				app.workspace.detachLeavesOfType("harness-chat-view");
				app.workspace.detachLeavesOfType("harness-session-view");
				for (const file of app.vault.getFiles()) {
					if (
						file.extension === "session" &&
						!keep.includes(file.path)
					) {
						await app.vault.delete(file, true);
					}
				}
				await plugin.settingsService.removeSessionIndex(
					"navigator-toggle-entry",
				);
			},
			ENTRY_PATH,
			preExistingSessionFiles,
		);
	});

	it("AC-0027-N-1: renders the toggle before More and activates the navigator", async () => {
		await openSessionView();
		await installActionSpy();

		const structure = await browser.execute(
			(headerSelector: string, toggle: string, more: string) => {
				const container = document.querySelector(
					`${headerSelector} .nav-buttons-container`,
				);
				if (!container) throw new Error("nav-buttons-container missing");
				const toggleEl = container.querySelector(toggle);
				const moreEl = container.querySelector(more);
				if (!toggleEl || !moreEl) {
					throw new Error("toggle or More button missing");
				}
				const order = Array.from(container.children);
				return {
					toggleBeforeMore:
						order.indexOf(toggleEl) < order.indexOf(moreEl),
					iconClass:
						toggleEl.querySelector("svg")?.getAttribute("class") ??
						"",
				};
			},
			HEADER,
			TOGGLE,
			MORE,
		);
		expect(structure.toggleBeforeMore).toBe(true);
		expect(structure.iconClass).toContain("panel-left");

		await clickToggle();
		await browser.waitUntil(async () => (await readActionSpyCalls()) === 1, {
			timeout: 3000,
			interval: 50,
			timeoutMsg: "activateSessionManager was not called by the toggle",
		});
		await waitForLeafCount(VIEW_TYPE_NAVIGATOR, 1);
		// The session view stays open alongside the navigator.
		expect(await countLeaves(VIEW_TYPE_SESSION)).toBe(1);
		expect(
			await browser.execute(
				(selector: string) =>
					document.querySelector(selector) !== null,
				`${HEADER} .nav-buttons-container ${TOGGLE}`,
			),
		).toBe(true);
	});

	it("AC-0027-N-2: activates via keyboard with focus and stable layout", async () => {
		const before = await readActionSpyCalls();

		const focusState = await browser.execute(
			(headerSelector: string, toggle: string) => {
				const button = document.querySelector<HTMLElement>(
					`${headerSelector} .nav-buttons-container ${toggle}`,
				);
				if (!button) throw new Error("navigator toggle not found");
				button.focus();
				return {
					tabIndex: button.tabIndex,
					focused: document.activeElement === button,
				};
			},
			HEADER,
			TOGGLE,
		);
		expect(focusState.tabIndex).toBe(0);
		expect(focusState.focused).toBe(true);

		for (const key of ["Enter", " "]) {
			await browser.execute(
				(headerSelector: string, toggle: string, keyName: string) => {
					const button = document.querySelector<HTMLElement>(
						`${headerSelector} .nav-buttons-container ${toggle}`,
					);
					if (!button) throw new Error("navigator toggle not found");
					button.dispatchEvent(
						new KeyboardEvent("keydown", {
							key: keyName,
							bubbles: true,
						}),
					);
				},
				HEADER,
				TOGGLE,
				key,
			);
		}
		await browser.waitUntil(
			async () => (await readActionSpyCalls()) === before + 2,
			{
				timeout: 3000,
				interval: 50,
				timeoutMsg: "Enter/Space did not both trigger the action",
			},
		);

		// Agent label and More button are still laid out around the toggle.
		const layout = await browser.execute(
			(headerSelector: string, toggle: string, more: string) => {
				const container = document.querySelector(
					`${headerSelector} .nav-buttons-container`,
				);
				if (!container) throw new Error("nav-buttons-container missing");
				const order = Array.from(container.children);
				return {
					hasAgentLabel:
						container.querySelector(
							".harness-chat-view-header-title",
						) !== null,
					toggleBeforeMore:
						order.indexOf(container.querySelector(toggle)!) <
						order.indexOf(container.querySelector(more)!),
				};
			},
			HEADER,
			TOGGLE,
			MORE,
		);
		expect(layout.hasAgentLabel).toBe(true);
		expect(layout.toggleBeforeMore).toBe(true);
	});

	it("AC-0027-B-1: only the .session FileView sidebar header shows the toggle", async () => {
		// Host 1: .session FileView — toggle present.
		expect(
			await browser.execute(
				(selector: string) =>
					document.querySelector(selector) !== null,
				`${HEADER} .nav-buttons-container ${TOGGLE}`,
			),
		).toBe(true);

		// Host 2: legacy ChatView — must NOT render the toggle (BR-067).
		await browser.execute((pluginId: string) => {
			const plugin = (window as any).app.plugins.plugins[pluginId];
			void plugin.activateView();
		}, PLUGIN_ID);
		await browser.waitUntil(
			() =>
				browser.execute((viewType: string) => {
					const leaf = (window as any).app.workspace.getLeavesOfType(
						viewType,
					)[0];
					return (
						leaf?.containerEl.querySelector(
							".harness-chat-view-header",
						) != null
					);
				}, VIEW_TYPE_LEGACY_CHAT),
			{
				timeout: 5000,
				interval: 100,
				timeoutMsg: "legacy chat view header did not render",
			},
		);
		const legacyToggleCount = await browser.execute(
			(viewType: string, toggle: string) => {
				const leaf = (window as any).app.workspace.getLeavesOfType(
					viewType,
				)[0];
				return leaf.containerEl.querySelectorAll(toggle).length;
			},
			VIEW_TYPE_LEGACY_CHAT,
			TOGGLE,
		);
		expect(legacyToggleCount).toBe(0);

		// Host 3: floating chat — must NOT render the toggle.
		await browser.execute((pluginId: string) => {
			const plugin = (window as any).app.plugins.plugins[pluginId];
			plugin.openNewFloatingChat(true);
		}, PLUGIN_ID);
		await browser.waitUntil(
			() =>
				browser.execute(
					() =>
						document.querySelector(".harness-floating-window") !==
						null,
				),
			{
				timeout: 5000,
				interval: 100,
				timeoutMsg: "floating chat window did not open",
			},
		);
		const floatingToggleCount = await browser.execute(
			(toggle: string) =>
				document.querySelectorAll(
					`.harness-floating-window ${toggle}`,
				).length,
			TOGGLE,
		);
		expect(floatingToggleCount).toBe(0);

		// Close the extra hosts; the session view stays for later tests.
		await browser.execute(
			(pluginId: string, legacyType: string) => {
				const app = (window as any).app;
				const plugin = app.plugins.plugins[pluginId];
				for (const viewId of plugin.getFloatingChatInstances()) {
					plugin.closeFloatingChat(viewId);
				}
				app.workspace.detachLeavesOfType(legacyType);
			},
			PLUGIN_ID,
			VIEW_TYPE_LEGACY_CHAT,
		);
	});

	it("AC-0027-B-2: reuses the existing navigator leaf instead of duplicating it", async () => {
		await waitForLeafCount(VIEW_TYPE_NAVIGATOR, 1);
		// Clicking again with the navigator already open must reveal, not spawn.
		await clickToggle();
		await browser.pause(300);
		expect(await countLeaves(VIEW_TYPE_NAVIGATOR)).toBe(1);
	});

	it("AC-0027-E-1: preserves session view state across the toggle", async () => {
		// Substitute for a live streaming session: the E2E environment has no
		// agent backend, so the session view stays in its not-connected state
		// (no input area). We therefore assert the two things a view toggle
		// must never do: (a) remount the session view — a remount would drop
		// all React session state including streaming content and pending
		// permissions — and (b) alter the visible session UI. Structurally the
		// toggle only calls activateSessionManager (see report).
		const before = await browser.execute((viewType: string) => {
			const leaf = (window as any).app.workspace.getLeavesOfType(
				viewType,
			)[0];
			const container = leaf?.containerEl.querySelector<HTMLElement>(
				".harness-chat-view-container",
			);
			if (!container) throw new Error("session view container not found");
			// Marker dies if the React tree is remounted or the leaf replaced.
			container.dataset.navigatorToggleMarker = "alive";
			return {
				agentLabel:
					leaf.containerEl.querySelector(
						".harness-chat-view-header-title",
					)?.textContent ?? null,
				bodyHtml: container.innerHTML,
			};
		}, VIEW_TYPE_SESSION);

		await clickToggle();
		await waitForLeafCount(VIEW_TYPE_NAVIGATOR, 1);

		// Switch back to the session view.
		await browser.execute((viewType: string) => {
			const app = (window as any).app;
			const leaf = app.workspace.getLeavesOfType(viewType)[0];
			app.workspace.revealLeaf(leaf);
		}, VIEW_TYPE_SESSION);

		const after = await browser.execute((viewType: string) => {
			const leaf = (window as any).app.workspace.getLeavesOfType(
				viewType,
			)[0];
			const container = leaf?.containerEl.querySelector<HTMLElement>(
				".harness-chat-view-container",
			);
			return {
				marker: container?.dataset.navigatorToggleMarker ?? null,
				agentLabel:
					leaf?.containerEl.querySelector(
						".harness-chat-view-header-title",
					)?.textContent ?? null,
				bodyHtml: container?.innerHTML ?? null,
			};
		}, VIEW_TYPE_SESSION);

		// No remount: the marker on the React-rendered container survived.
		expect(after.marker).toBe("alive");
		// Visible session state is untouched by the toggle.
		expect(after.agentLabel).toBe(before.agentLabel);
		expect(after.bodyHtml).toBe(before.bodyHtml);
		expect(await countLeaves(VIEW_TYPE_SESSION)).toBe(1);
	});

	it("AC-0027-F-1: surfaces a non-blocking Notice on failure and recovers", async () => {
		// Start from a closed navigator.
		await browser.execute((viewType: string) => {
			(window as any).app.workspace.detachLeavesOfType(viewType);
		}, VIEW_TYPE_NAVIGATOR);
		await waitForLeafCount(VIEW_TYPE_NAVIGATOR, 0);

		// Inject a workspace failure into the action.
		await browser.execute((pluginId: string) => {
			const plugin = (window as any).app.plugins.plugins[pluginId];
			plugin.__navigatorToggleFaultOriginal =
				plugin.activateSessionManager;
			plugin.activateSessionManager = async () => {
				throw new Error("injected workspace failure");
			};
		}, PLUGIN_ID);

		await clickToggle();
		await waitForNotice("Failed to open the session navigator");
		// No residual or duplicate leaf; session view still usable.
		expect(await countLeaves(VIEW_TYPE_NAVIGATOR)).toBe(0);
		expect(await countLeaves(VIEW_TYPE_SESSION)).toBe(1);
		expect(
			await browser.execute(
				(selector: string) =>
					document.querySelector(selector) !== null,
				`${HEADER} .nav-buttons-container ${TOGGLE}`,
			),
		).toBe(true);

		// Retry after the fault clears succeeds.
		await browser.execute((pluginId: string) => {
			const plugin = (window as any).app.plugins.plugins[pluginId];
			plugin.activateSessionManager =
				plugin.__navigatorToggleFaultOriginal;
			delete plugin.__navigatorToggleFaultOriginal;
		}, PLUGIN_ID);
		await clickToggle();
		await waitForLeafCount(VIEW_TYPE_NAVIGATOR, 1);
	});
});
