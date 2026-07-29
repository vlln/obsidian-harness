/**
 * Pure functions for session state updates.
 *
 * These functions are extracted from useSession to keep the hook thin
 * and to allow independent testing. They handle session config restoration
 * and legacy mode/model management.
 */

import type {
	ChatSession,
	SessionConfigOption,
	SessionResult,
} from "../types/session";
import { flattenConfigSelectOptions } from "../types/session";
import type { AcpClient } from "../acp/acp-client";

// ============================================================================
// Legacy Config Helpers
// ============================================================================

/**
 * Apply a legacy mode/model value to the session state.
 * Used for both optimistic updates and rollbacks.
 */
export function applyLegacyValue(
	prev: ChatSession,
	value: string,
): ChatSession {
	if (!prev.modes) return prev;
	return { ...prev, modes: { ...prev.modes, currentModeId: value } };
}

// ============================================================================
// Config Restore Helpers
// ============================================================================

/**
 * Try to restore a saved config option value by category.
 * Returns updated configOptions if restored, or the original if unchanged.
 */
export async function tryRestoreConfigOption(
	harness: AcpClient,
	sessionId: string,
	configOptions: SessionConfigOption[],
	category: string,
	savedValue: string | undefined,
): Promise<SessionConfigOption[]> {
	if (!savedValue) return configOptions;

	const option = configOptions.find((o) => o.category === category);
	if (!option || option.type !== "select") return configOptions;
	if (savedValue === option.currentValue) return configOptions;
	if (
		!flattenConfigSelectOptions(option.options).some(
			(o) => o.value === savedValue,
		)
	)
		return configOptions;

	try {
		return await harness.setSessionConfigOption(
			sessionId,
			option.id,
			savedValue,
		);
	} catch {
		return configOptions;
	}
}

/**
 * Restore saved config option values by option id (non-legacy config options;
 * model/mode use the category-based path above + lastUsedModels/lastUsedModes).
 * Applies each saved value that still maps to a currently-available choice;
 * unknown ids and stale/unavailable values are skipped. Mirrors the validation
 * in tryRestoreConfigOption but keyed by id instead of category.
 */
export async function restoreSavedConfigOptions(
	harness: AcpClient,
	sessionId: string,
	configOptions: SessionConfigOption[],
	savedById: Record<string, string> | undefined,
): Promise<SessionConfigOption[]> {
	if (!savedById) return configOptions;

	let result = configOptions;
	for (const [optionId, savedValue] of Object.entries(savedById)) {
		const option = result.find((o) => o.id === optionId);
		if (!option || option.type !== "select") continue;
		if (savedValue === option.currentValue) continue;
		if (
			!flattenConfigSelectOptions(option.options).some(
				(o) => o.value === savedValue,
			)
		)
			continue;
		try {
			result = await harness.setSessionConfigOption(
				sessionId,
				optionId,
				savedValue,
			);
		} catch {
			// Keep current value on failure.
		}
	}
	return result;
}

/**
 * Restore last used mode/model via legacy APIs.
 * Only called when configOptions is not available.
 *
 * Returns the final modes/models state after restoration (or the originals
 * if no restoration was needed or if the agent-side calls failed).
 * The caller is responsible for applying these to session state.
 * This function has no side effects on React state so callers can sequence
 * the restore BEFORE marking the session as "ready", avoiding a UI race
 * where the dropdown briefly shows the agent's default mode/model before
 * the user's saved selection is re-applied.
 */
export async function restoreLegacyConfig(
	harness: AcpClient,
	sessionResult: SessionResult,
	savedModeId: string | undefined,
): Promise<{
	modes: SessionResult["modes"];
}> {
	let modes = sessionResult.modes;

	if (!sessionResult.sessionId) return { modes };

	// Legacy mode restore
	if (modes && savedModeId) {
		if (
			savedModeId !== modes.currentModeId &&
			modes.availableModes.some((m) => m.id === savedModeId)
		) {
			try {
				await harness.setSessionMode(
					sessionResult.sessionId,
					savedModeId,
				);
				modes = { ...modes, currentModeId: savedModeId };
			} catch {
				// Agent default is fine as fallback
			}
		}
	}

	return { modes };
}
