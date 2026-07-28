import { useSyncExternalStore } from "react";
import type HarnessPlugin from "../plugin";

/**
 * Hook for subscribing to plugin settings changes.
 *
 * Uses useSyncExternalStore to safely subscribe to the external settings store,
 * ensuring React re-renders when settings change.
 *
 * @param plugin - Plugin instance containing the settings store
 * @returns Current settings snapshot (HarnessPluginSettings)
 */
export function useSettings(plugin: HarnessPlugin) {
	return useSyncExternalStore(
		plugin.settingsService.subscribe,
		plugin.settingsService.getSnapshot,
		plugin.settingsService.getSnapshot,
	);
}
