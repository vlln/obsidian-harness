/**
 * Settings Store Adapter
 *
 * Reactive settings store implementing ISettingAccess port.
 * Manages plugin settings state with observer pattern for React integration
 * via useSyncExternalStore, and handles persistence to Obsidian's data.json.
 */

import type { AgentClientPluginSettings } from "../plugin";
import type AgentClientPlugin from "../plugin";
import type { SessionIndexEntry } from "../types/session";
import type {
	ActiveTurnRecord,
	TranscriptManifest,
	TranscriptReadResult,
	TurnRecord,
} from "../types/transcript";
import { updateDebugMode } from "../utils/logger";
import { SessionStorage, type TranscriptMetadata } from "./session-storage";

// ============================================================================
// Port Types (from settings-access.port.ts)
// ============================================================================

/**
 * Interface for accessing and managing plugin settings.
 *
 * Provides reactive access to settings with subscription support
 * for detecting changes (e.g., for React components using useSyncExternalStore).
 *
 * This port will be implemented by adapters that handle the actual
 * storage mechanism (SettingsService, localStorage, etc.).
 */
export interface ISettingsAccess {
	/**
	 * Get the current settings snapshot.
	 *
	 * Used by React's useSyncExternalStore to read current state.
	 * Should return the settings object immediately without side effects.
	 *
	 * @returns Current plugin settings
	 */
	getSnapshot(): AgentClientPluginSettings;

	/**
	 * Update plugin settings.
	 *
	 * Merges the provided updates with existing settings and persists
	 * the changes. Notifies all subscribers after the update.
	 *
	 * @param updates - Partial settings object with properties to update
	 * @returns Promise that resolves when settings are saved
	 */
	updateSettings(updates: Partial<AgentClientPluginSettings>): Promise<void>;

	/**
	 * Subscribe to settings changes.
	 *
	 * The listener will be called whenever settings are updated.
	 * Used by React's useSyncExternalStore to detect changes and trigger re-renders.
	 *
	 * @param listener - Callback to invoke on settings changes
	 * @returns Unsubscribe function to remove the listener
	 */
	subscribe(listener: () => void): () => void;

	// ============================================================
	// Transcript v2 Methods
	// ============================================================

	initializeTranscript(
		historyId: string,
		metadata: TranscriptMetadata,
	): Promise<TranscriptManifest>;
	writeCheckpoint(
		historyId: string,
		checkpoint: ActiveTurnRecord,
	): Promise<void>;
	commitTurn(historyId: string, turn: TurnRecord): Promise<void>;
	readTranscript(historyId: string): Promise<TranscriptReadResult>;
	deleteTranscript(historyId: string): Promise<void>;

	// ============================================================
	// Session Index Methods (session_index.jsonl)
	// ============================================================

	appendSessionIndex(entry: SessionIndexEntry): Promise<void>;
	getSessionIndex(cwd?: string): Promise<SessionIndexEntry[]>;
	removeSessionIndex(entryId: string): Promise<void>;
}

/** Listener callback invoked when settings change */
type Listener = () => void;

/**
 * Observable store for plugin settings implementing ISettingsAccess port.
 *
 * Manages plugin settings state and notifies subscribers of changes.
 * Designed to work with React's useSyncExternalStore hook for
 * automatic re-rendering when settings update.
 *
 * Pattern: Observer/Publisher-Subscriber
 */
export class SettingsService implements ISettingsAccess {
	/** Current settings state */
	private state: AgentClientPluginSettings;

	/** Set of registered listeners */
	private listeners = new Set<Listener>();

	/** Plugin instance for persistence */
	private plugin: AgentClientPlugin;

	/** Session storage delegate */
	private sessionStorage: SessionStorage;

	/**
	 * Create a new settings store.
	 *
	 * @param initial - Initial settings state
	 * @param plugin - Plugin instance for saving settings
	 */
	constructor(initial: AgentClientPluginSettings, plugin: AgentClientPlugin) {
		this.state = initial;
		this.plugin = plugin;
		this.sessionStorage = new SessionStorage(plugin);
	}

	/**
	 * Get current settings snapshot.
	 *
	 * Used by React's useSyncExternalStore to read current state.
	 *
	 * @returns Current plugin settings
	 */
	getSnapshot = (): AgentClientPluginSettings => this.state;

	/**
	 * Update plugin settings.
	 *
	 * Merges the provided updates with existing settings, notifies subscribers,
	 * and persists changes to disk.
	 *
	 * @param updates - Partial settings object with properties to update
	 * @returns Promise that resolves when settings are saved
	 */
	async updateSettings(
		updates: Partial<AgentClientPluginSettings>,
	): Promise<void> {
		const next = { ...this.state, ...updates };
		this.state = next;

		// Sync with plugin.settings (required for saveSettings to persist correctly)
		this.plugin.settings = next;

		// Keep logger in sync with debug mode toggle
		updateDebugMode(next.debugMode);

		// Notify all subscribers
		for (const listener of this.listeners) {
			listener();
		}

		// Persist to disk
		await this.plugin.saveSettings();
	}

	/**
	 * Subscribe to settings changes.
	 *
	 * The listener will be called whenever settings are updated via updateSettings().
	 * Used by React's useSyncExternalStore to detect changes.
	 *
	 * @param listener - Callback to invoke on settings changes
	 * @returns Unsubscribe function to remove the listener
	 */
	subscribe = (listener: Listener): (() => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	/**
	 * Set entire settings object (legacy method).
	 *
	 * For backward compatibility with existing code.
	 * Delegates to updateSettings() for async persistence.
	 *
	 * @param next - New settings object
	 */
	set(next: AgentClientPluginSettings): void {
		// Delegate to async updateSettings
		// Note: Fire-and-forget - callers don't expect this to be async
		void this.updateSettings(next);
	}

	// ============================================================
	// Transcript v2 Methods
	// ============================================================

	async initializeTranscript(
		historyId: string,
		metadata: TranscriptMetadata,
	): Promise<TranscriptManifest> {
		return this.sessionStorage.initializeTranscript(historyId, metadata);
	}

	async writeCheckpoint(
		historyId: string,
		checkpoint: ActiveTurnRecord,
	): Promise<void> {
		return this.sessionStorage.writeCheckpoint(historyId, checkpoint);
	}

	async commitTurn(historyId: string, turn: TurnRecord): Promise<void> {
		return this.sessionStorage.commitTurn(historyId, turn);
	}

	async readTranscript(historyId: string): Promise<TranscriptReadResult> {
		return this.sessionStorage.readTranscript(historyId);
	}

	async deleteTranscript(historyId: string): Promise<void> {
		return this.sessionStorage.deleteTranscript(historyId);
	}

	// ============================================================
	// Session Index Methods
	// ============================================================

	async appendSessionIndex(entry: SessionIndexEntry): Promise<void> {
		return this.sessionStorage.appendSessionIndex(entry);
	}

	async getSessionIndex(cwd?: string): Promise<SessionIndexEntry[]> {
		return this.sessionStorage.getSessionIndex(cwd);
	}

	async removeSessionIndex(entryId: string): Promise<void> {
		return this.sessionStorage.removeSessionIndex(entryId);
	}
}

/**
 * Create a new settings store instance.
 */
export const createSettingsService = (
	initial: AgentClientPluginSettings,
	plugin: AgentClientPlugin,
) => new SettingsService(initial, plugin);
