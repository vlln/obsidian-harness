/**
 * Session storage for persisting session metadata and message history.
 *
 * Handles:
 * - Session metadata CRUD (in plugin settings savedSessions array)
 * - Session message file I/O (sessions/{id}.json)
 * - Session index file (session_index.jsonl)
 * - JSONL history (append-only, AC-0003)
 */

import { Platform } from "obsidian";

import type { AgentClientPluginSettings } from "../plugin";
import type AgentClientPlugin from "../plugin";
import type { ChatMessage, MessageContent } from "../types/chat";
import type { SavedSessionInfo, SessionUpdate, SessionIndexEntry } from "../types/session";
import { convertWindowsPathToWsl } from "../utils/platform";
import { getLogger } from "../utils/logger";

// ============================================================================
// Types
// ============================================================================

/**
 * Serialized format for session message files.
 */
interface SessionMessagesFile {
	version: number;
	sessionId: string;
	agentId: string;
	messages: Array<{
		id: string;
		role: "user" | "assistant";
		content: MessageContent[];
		timestamp: string;
	}>;
	savedAt: string;
}

/**
 * Interface for settings access needed by SessionStorage.
 * Subset of SettingsService to avoid circular dependency.
 */
interface SessionStorageSettingsAccess {
	getSnapshot(): AgentClientPluginSettings;
	updateSettings(updates: Partial<AgentClientPluginSettings>): Promise<void>;
}

// ============================================================================
// Implementation
// ============================================================================

/** Maximum number of saved sessions to keep */
const MAX_SAVED_SESSIONS = 50;

export class SessionStorage {
	private plugin: AgentClientPlugin;
	private settingsAccess: SessionStorageSettingsAccess;

	/** Lock for session operations to prevent race conditions */
	private sessionLock: Promise<void> = Promise.resolve();

	constructor(
		plugin: AgentClientPlugin,
		settingsAccess: SessionStorageSettingsAccess,
	) {
		this.plugin = plugin;
		this.settingsAccess = settingsAccess;
	}

	// ============================================================
	// Session Metadata Methods
	// ============================================================

	/**
	 * Save a session to local storage.
	 *
	 * Updates existing session if sessionId matches.
	 * Maintains max 50 sessions, removing oldest when exceeded.
	 */
	async saveSession(info: SavedSessionInfo): Promise<void> {
		this.sessionLock = this.sessionLock.then(async () => {
			// Convert Windows path to WSL path if in WSL mode
			let sessionInfo = info;
			const state = this.settingsAccess.getSnapshot();
			if (Platform.isWin && state.windowsWslMode && info.cwd) {
				sessionInfo = {
					...info,
					cwd: convertWindowsPathToWsl(info.cwd),
				};
			}

			const sessions = [...(state.savedSessions || [])];

			// Find existing session by sessionId
			const existingIndex = sessions.findIndex(
				(s) => s.sessionId === sessionInfo.sessionId,
			);

			if (existingIndex >= 0) {
				sessions[existingIndex] = sessionInfo;
			} else {
				sessions.unshift(sessionInfo);
				if (sessions.length > MAX_SAVED_SESSIONS) {
					sessions.pop();
				}
			}

			await this.settingsAccess.updateSettings({
				savedSessions: sessions,
			});
		});
		await this.sessionLock;
	}

	/**
	 * Get saved sessions, optionally filtered by agentId and/or cwd.
	 * Returns sessions sorted by updatedAt (newest first).
	 */
	getSavedSessions(agentId?: string, cwd?: string): SavedSessionInfo[] {
		const state = this.settingsAccess.getSnapshot();
		let sessions = state.savedSessions || [];

		if (agentId) {
			sessions = sessions.filter((s) => s.agentId === agentId);
		}
		if (cwd) {
			let filterCwd = cwd;
			if (Platform.isWin && state.windowsWslMode) {
				filterCwd = convertWindowsPathToWsl(cwd);
			}
			sessions = sessions.filter((s) => s.cwd === filterCwd);
		}

		return [...sessions].sort(
			(a, b) =>
				new Date(b.updatedAt).getTime() -
				new Date(a.updatedAt).getTime(),
		);
	}

	/**
	 * Delete a saved session by sessionId.
	 * Also deletes the associated message history file.
	 */
	async deleteSession(sessionId: string): Promise<void> {
		this.sessionLock = this.sessionLock.then(async () => {
			const state = this.settingsAccess.getSnapshot();
			const sessions = (state.savedSessions || []).filter(
				(s) => s.sessionId !== sessionId,
			);
			await this.settingsAccess.updateSettings({
				savedSessions: sessions,
			});
			await this.deleteSessionMessages(sessionId);
		});
		await this.sessionLock;
	}

	/**
	 * Update the title of a saved session.
	 * If createIfMissing is provided and session doesn't exist, creates a new entry.
	 */
	async updateSessionTitle(
		sessionId: string,
		newTitle: string,
		createIfMissing?: { agentId: string; cwd: string },
	): Promise<void> {
		this.sessionLock = this.sessionLock.then(async () => {
			const state = this.settingsAccess.getSnapshot();
			const sessions = [...(state.savedSessions || [])];
			const idx = sessions.findIndex((s) => s.sessionId === sessionId);

			if (idx >= 0) {
				// Immutable update: replace the object instead of mutating it,
				// matching saveSession's pattern and keeping state objects stable.
				sessions[idx] = {
					...sessions[idx],
					title: newTitle,
					updatedAt: new Date().toISOString(),
				};
			} else if (createIfMissing) {
				sessions.unshift({
					sessionId,
					agentId: createIfMissing.agentId,
					cwd: createIfMissing.cwd,
					title: newTitle,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				});
			} else {
				return;
			}

			await this.settingsAccess.updateSettings({
				savedSessions: sessions,
			});
		});
		await this.sessionLock;
	}

	/**
	 * Update fields of an existing saved session.
	 * Silently no-op if the session does not exist (no create).
	 * `updatedAt` is set to now unless explicitly provided in `patch`.
	 */
	async updateSession(
		sessionId: string,
		patch: Partial<Omit<SavedSessionInfo, "sessionId" | "createdAt">>,
	): Promise<void> {
		this.sessionLock = this.sessionLock.then(async () => {
			const state = this.settingsAccess.getSnapshot();
			const sessions = [...(state.savedSessions || [])];
			const idx = sessions.findIndex((s) => s.sessionId === sessionId);
			if (idx < 0) return;

			sessions[idx] = {
				...sessions[idx],
				...patch,
				updatedAt: patch.updatedAt ?? new Date().toISOString(),
			};
			await this.settingsAccess.updateSettings({
				savedSessions: sessions,
			});
		});
		await this.sessionLock;
	}

	// ============================================================
	// Session Message History Methods
	// ============================================================

	getSessionsDir(): string {
		return `${this.plugin.app.vault.configDir}/plugins/obsidian-harness/sessions`;
	}

	private async ensureSessionsDir(): Promise<void> {
		const adapter = this.plugin.app.vault.adapter;
		const sessionsDir = this.getSessionsDir();
		if (!(await adapter.exists(sessionsDir))) {
			await adapter.mkdir(sessionsDir);
		}
	}

	private getSessionFilePath(sessionId: string): string {
		const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_");
		return `${this.getSessionsDir()}/${safeId}.json`;
	}

	/**
	 * Save message history for a session.
	 */
	async saveSessionMessages(
		sessionId: string,
		agentId: string,
		messages: ChatMessage[],
	): Promise<void> {
		await this.ensureSessionsDir();

		const serialized = messages.map((msg) => ({
			...msg,
			timestamp: msg.timestamp.toISOString(),
		}));

		const data = {
			version: 1,
			sessionId,
			agentId,
			messages: serialized,
			savedAt: new Date().toISOString(),
		};

		const filePath = this.getSessionFilePath(sessionId);
		await this.plugin.app.vault.adapter.write(
			filePath,
			JSON.stringify(data, null, 2),
		);
	}

	/**
	 * Load message history for a session.
	 * Returns null if file doesn't exist or on error.
	 */
	async loadSessionMessages(
		sessionId: string,
	): Promise<ChatMessage[] | null> {
		const filePath = this.getSessionFilePath(sessionId);
		const adapter = this.plugin.app.vault.adapter;

		if (!(await adapter.exists(filePath))) {
			return null;
		}

		try {
			const content = await adapter.read(filePath);
			const data = JSON.parse(content) as SessionMessagesFile;

			if (
				typeof data.version !== "number" ||
				!Array.isArray(data.messages)
			) {
				getLogger().debug(
					`[SessionStorage] Invalid session file structure: ${filePath}`,
				);
				return null;
			}

			if (data.version !== 1) {
				getLogger().debug(
					`[SessionStorage] Unknown session file version: ${data.version}`,
				);
				return null;
			}

			return data.messages.map((msg) => ({
				...msg,
				timestamp: new Date(msg.timestamp),
			}));
		} catch (error) {
			getLogger().error(
				`[SessionStorage] Failed to load session messages: ${error}`,
			);
			return null;
		}
	}

	/**
	 * Delete message history file for a session.
	 * Silently succeeds if file doesn't exist.
	 */
	async deleteSessionMessages(sessionId: string): Promise<void> {
		const filePath = this.getSessionFilePath(sessionId);
		const adapter = this.plugin.app.vault.adapter;

		if (await adapter.exists(filePath)) {
			await adapter.remove(filePath);
		}
	}

	// ============================================================
	// JSONL History Methods (append-only, AC-0003)
	// ============================================================

	private getSessionHistoryDir(sessionId: string): string {
		return `${this.getSessionsDir()}/${sessionId}`;
	}

	private getSessionHistoryPath(sessionId: string): string {
		return `${this.getSessionHistoryDir(sessionId)}/main.jsonl`;
	}

	async ensureHistoryDir(sessionId: string): Promise<void> {
		const adapter = this.plugin.app.vault.adapter;
		const dir = this.getSessionHistoryDir(sessionId);
		if (!(await adapter.exists(dir))) {
			await adapter.mkdir(dir);
		}
	}

	async writeHistoryMetadata(
		sessionId: string,
		metadata: {
			agentId: string;
			cwd: string;
			title: string;
			createdAt: string;
		},
	): Promise<void> {
		await this.ensureHistoryDir(sessionId);
		const adapter = this.plugin.app.vault.adapter;
		const filePath = this.getSessionHistoryPath(sessionId);

		if (await adapter.exists(filePath)) {
			return;
		}

		const line = JSON.stringify({
			type: "metadata",
			version: 1,
			sessionId,
			...metadata,
			updatedAt: new Date().toISOString(),
		}) + "\n";

		await adapter.write(filePath, line);
	}

	async appendHistoryEvent(
		sessionId: string,
		event: SessionUpdate,
	): Promise<void> {
		await this.ensureHistoryDir(sessionId);
		const adapter = this.plugin.app.vault.adapter;
		const filePath = this.getSessionHistoryPath(sessionId);

		const line = JSON.stringify(event) + "\n";

		if (await adapter.exists(filePath)) {
			await adapter.append(filePath, line);
		} else {
			await adapter.write(filePath, line);
		}
	}

	async readHistory(
		sessionId: string,
		limit = 0,
	): Promise<SessionUpdate[]> {
		const adapter = this.plugin.app.vault.adapter;
		const filePath = this.getSessionHistoryPath(sessionId);

		if (!(await adapter.exists(filePath))) {
			return [];
		}

		const content = await adapter.read(filePath);
		const lines = content.trim().split("\n");
		const events: SessionUpdate[] = [];

		for (const line of lines) {
			try {
				const parsed = JSON.parse(line) as Record<string, unknown>;
				if (parsed["type"] === "metadata") continue;
				events.push(parsed as unknown as SessionUpdate);
			} catch {
				continue;
			}
		}

		if (limit > 0 && events.length > limit) {
			return events.slice(-limit);
		}

		return events;
	}

	async deleteHistory(sessionId: string): Promise<void> {
		const adapter = this.plugin.app.vault.adapter;
		const dir = this.getSessionHistoryDir(sessionId);
		if (await adapter.exists(dir)) {
			const files = await adapter.list(dir);
			for (const file of files.files) {
				await adapter.remove(file);
			}
			await adapter.rmdir(dir, false);
		}
	}

	// ============================================================
	// Session Index Methods (session_index.jsonl)
	// ============================================================

	private getSessionIndexPath(): string {
		return `${this.getSessionsDir()}/session_index.jsonl`;
	}

	/**
	 * Append a session entry to session_index.jsonl.
	 * Called when a new .session file is created.
	 */
	async appendSessionIndex(entry: SessionIndexEntry): Promise<void> {
		await this.ensureSessionsDir();
		const adapter = this.plugin.app.vault.adapter;
		const filePath = this.getSessionIndexPath();
		const line = JSON.stringify(entry) + "\n";

		if (await adapter.exists(filePath)) {
			await adapter.append(filePath, line);
		} else {
			await adapter.write(filePath, line);
		}
	}

	/**
	 * Read all session index entries, optionally filtered by cwd.
	 */
	async getSessionIndex(cwd?: string): Promise<SessionIndexEntry[]> {
		const adapter = this.plugin.app.vault.adapter;
		const filePath = this.getSessionIndexPath();

		if (!(await adapter.exists(filePath))) {
			return [];
		}

		const content = await adapter.read(filePath);
		const lines = content.trim().split("\n");
		const entries: SessionIndexEntry[] = [];

		for (const line of lines) {
			try {
				const parsed = JSON.parse(line) as SessionIndexEntry;
				if (parsed.sessionId && parsed.cwd && parsed.entryFile) {
					if (!cwd || parsed.cwd === cwd) {
						entries.push(parsed);
					}
				}
			} catch {
				continue;
			}
		}

		return entries;
	}

	/**
	 * Remove a session entry from session_index.jsonl.
	 * Rewrites the file without the matching entry.
	 */
	async removeSessionIndex(sessionId: string): Promise<void> {
		const adapter = this.plugin.app.vault.adapter;
		const filePath = this.getSessionIndexPath();

		if (!(await adapter.exists(filePath))) {
			return;
		}

		const content = await adapter.read(filePath);
		const lines = content.trim().split("\n");
		const filtered = lines.filter((line) => {
			try {
				const parsed = JSON.parse(line) as SessionIndexEntry;
				return parsed.sessionId !== sessionId;
			} catch {
				return true; // keep malformed lines
			}
		});

		if (filtered.length === 0) {
			await adapter.remove(filePath);
		} else {
			await adapter.write(filePath, filtered.join("\n") + "\n");
		}
	}
}