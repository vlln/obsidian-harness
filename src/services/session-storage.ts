/**
 * Session storage for persisting session metadata and message history.
 *
 * Handles:
 * - Session index file (session_index.jsonl)
 * - JSONL history (append-only, AC-0003)
 */

import type AgentClientPlugin from "../plugin";
import type { SessionUpdate, SessionIndexEntry } from "../types/session";

// ============================================================================
// Implementation
// ============================================================================

export class SessionStorage {
	private plugin: AgentClientPlugin;

	constructor(plugin: AgentClientPlugin) {
		this.plugin = plugin;
	}

	// ============================================================
	// Session Directory
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

	// JSONL History Methods (append-only)
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
