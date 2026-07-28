import { browser } from "@wdio/globals";

/**
 * Helpers for driving the Obsidian-native settings UI in E2E tests.
 *
 * Usage precedent for opening a plugin settings tab:
 * `src/ui/ChatPanel.tsx` `handleOpenSettings` —
 * `app.setting.open()` followed by `app.setting.openTabById(plugin.manifest.id)`.
 *
 * Setting rows in the Obsidian settings DOM are `.setting-item` elements whose
 * label lives in `.setting-item-name`.
 */

export const HARNESS_PLUGIN_ID = "obsidian-harness";

/**
 * Opens the Obsidian settings modal on the given plugin's tab.
 * Defaults to the Harness plugin tab.
 */
export async function openPluginSettingsTab(
	pluginId: string = HARNESS_PLUGIN_ID,
): Promise<void> {
	await browser.execute((id: string) => {
		const app = (window as any).app;
		app?.setting?.open();
		app?.setting?.openTabById(id);
	}, pluginId);
}

/**
 * Waits until the settings tab DOM has rendered at least one setting row.
 */
export async function waitForSettingsDom(timeout = 5000): Promise<void> {
	await browser.waitUntil(
		async () =>
			browser.execute(
				() =>
					document.querySelectorAll(
						".modal.mod-settings .setting-item",
					).length > 0,
			),
		{
			timeout,
			interval: 100,
			timeoutMsg: "Settings DOM did not render any .setting-item in time",
		},
	);
}

/**
 * Opens the plugin settings tab and waits for its DOM to be ready.
 */
export async function openPluginSettingsAndWait(
	pluginId: string = HARNESS_PLUGIN_ID,
	timeout = 5000,
): Promise<void> {
	await openPluginSettingsTab(pluginId);
	await waitForSettingsDom(timeout);
}

/**
 * Returns the `.setting-item` element whose `.setting-item-name` matches the
 * given label exactly, or `null` when no such row exists.
 */
export async function findSettingItemByName(name: string) {
	const handle = await browser.execute((label: string) => {
		const items = document.querySelectorAll(
			".modal.mod-settings .setting-item",
		);
		for (const item of items) {
			const nameEl = item.querySelector(".setting-item-name");
			if (nameEl?.textContent?.trim() === label) return item;
		}
		return null;
	}, name);
	// WebdriverIO serializes the returned Element as an element reference;
	// a missing row comes back as null.
	return handle ?? null;
}

/**
 * Closes the settings modal so specs leave the workspace clean.
 */
export async function closeSettings(): Promise<void> {
	await browser.execute(() => {
		const app = (window as any).app;
		app?.setting?.close();
	});
}
