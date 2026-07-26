import { createHash } from "crypto";

import type AgentClientPlugin from "../plugin";
import type { SessionFileData, SessionIndexEntry } from "../types/session";
import {
	TRANSCRIPT_SCHEMA_VERSION,
	type ActiveTurnRecord,
	type BlobRef,
	type TranscriptManifest,
	type TranscriptReadResult,
	type TranscriptItem,
	type TranscriptWarning,
	type TurnRecord,
} from "../types/transcript";

interface TranscriptDataAdapter {
	exists(path: string): Promise<boolean>;
	mkdir(path: string): Promise<void>;
	write(path: string, content: string): Promise<void>;
	append(path: string, content: string): Promise<void>;
	read(path: string): Promise<string>;
	rename(from: string, to: string): Promise<void>;
	remove(path: string): Promise<void>;
	rmdir(path: string, recursive: boolean): Promise<void>;
	list(path: string): Promise<{ files: string[]; folders: string[] }>;
}

export interface TranscriptStorageOptions {
	adapter: TranscriptDataAdapter;
	sessionsDir: string;
	now?: () => string;
	blobThresholdBytes?: number;
	entryFileExists?: (entryFile: string) => boolean | Promise<boolean>;
}

export type SessionIndexMutation = Readonly<{
	type: "upsert" | "remove";
	entryId: string;
}>;

export type SessionIndexReconciliationResult =
	| Readonly<{
			status: "changed" | "unchanged";
			entry: SessionIndexEntry;
	  }>
	| Readonly<{
			status: "conflict";
			entry: SessionIndexEntry;
			conflictingEntryFiles: readonly string[];
	  }>;

export type SessionIndexListener = (mutation: SessionIndexMutation) => void;

interface ParsedSessionIndex {
	entries: SessionIndexEntry[];
	malformedLines: string[];
}

export interface TranscriptMetadata {
	agentId: string;
	cwd: string;
	title: string;
	createdAt: string;
}

const DEFAULT_BLOB_THRESHOLD_BYTES = 64 * 1024;

export class UnsupportedTranscriptVersionError extends Error {
	constructor(readonly actualVersion: number) {
		super(
			`Unsupported history version ${actualVersion}; requires version ${TRANSCRIPT_SCHEMA_VERSION}`,
		);
		this.name = "UnsupportedTranscriptVersionError";
	}
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJson).join(",")}]`;
	}
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.filter((key) => record[key] !== undefined)
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
		.join(",")}}`;
}

function sha256(content: string): string {
	return createHash("sha256").update(content, "utf8").digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertSupportedVersion(value: Record<string, unknown>): void {
	if (
		typeof value.schemaVersion === "number" &&
		value.schemaVersion !== TRANSCRIPT_SCHEMA_VERSION
	) {
		throw new UnsupportedTranscriptVersionError(value.schemaVersion);
	}
}

function isBlobRef(value: unknown): value is BlobRef {
	return (
		isRecord(value) &&
		value.type === "blob_ref" &&
		value.schemaVersion === TRANSCRIPT_SCHEMA_VERSION &&
		typeof value.sha256 === "string" &&
		typeof value.mediaType === "string" &&
		typeof value.byteLength === "number" &&
		typeof value.preview === "string"
	);
}

function normalizeItems(items: unknown[]): TranscriptItem[] {
	return items.map((value, index) => {
		if (!isRecord(value)) {
			return {
				type: "unknown",
				itemId: `unsupported-${index}`,
				updateType: typeof value,
			};
		}
		const itemId =
			typeof value.itemId === "string"
				? value.itemId
				: `unsupported-${index}`;
		const knownTypes = [
			"assistant_message",
			"thought",
			"tool",
			"plan",
			"error",
			"unknown",
		];
		if (!knownTypes.includes(String(value.type))) {
			return {
				type: "unknown",
				itemId,
				updateType:
					typeof value.type === "string" ? value.type : "missing",
			};
		}
		return clone(value) as unknown as TranscriptItem;
	});
}

function parseTurn(
	value: unknown,
	expectedStatus?: "active",
): TurnRecord | ActiveTurnRecord {
	if (!isRecord(value)) throw new Error("Turn must be an object");
	assertSupportedVersion(value);
	if (value.schemaVersion !== TRANSCRIPT_SCHEMA_VERSION) {
		throw new Error("Turn is missing schema version 2");
	}
	if (
		typeof value.turnId !== "string" ||
		typeof value.startedAt !== "string"
	) {
		throw new Error("Turn identity is invalid");
	}
	if (!Array.isArray(value.prompt) || !Array.isArray(value.items)) {
		throw new Error("Turn content is invalid");
	}
	if (expectedStatus && value.status !== expectedStatus) {
		throw new Error(`Turn status must be ${expectedStatus}`);
	}
	if (
		expectedStatus === "active" &&
		(value.endedAt !== undefined || value.stopReason !== undefined)
	) {
		throw new Error("Active turn cannot contain completion metadata");
	}
	if (
		!expectedStatus &&
		!["completed", "cancelled", "interrupted", "error"].includes(
			String(value.status),
		)
	) {
		throw new Error("Completed turn status is invalid");
	}
	const parsed = clone(value);
	parsed.items = normalizeItems(value.items);
	return parsed as unknown as TurnRecord | ActiveTurnRecord;
}

export class SessionStorage {
	private readonly adapter: TranscriptDataAdapter;
	private readonly sessionsDir: string;
	private readonly now: () => string;
	private readonly blobThresholdBytes: number;
	private readonly entryFileExists: (
		entryFile: string,
	) => boolean | Promise<boolean>;
	private readonly sessionIndexListeners = new Set<SessionIndexListener>();
	private sessionIndexMutationTail: Promise<void> = Promise.resolve();

	constructor(pluginOrOptions: AgentClientPlugin | TranscriptStorageOptions) {
		if ("adapter" in pluginOrOptions) {
			this.adapter = pluginOrOptions.adapter;
			this.sessionsDir = pluginOrOptions.sessionsDir;
			this.now = pluginOrOptions.now ?? (() => new Date().toISOString());
			this.blobThresholdBytes =
				pluginOrOptions.blobThresholdBytes ??
				DEFAULT_BLOB_THRESHOLD_BYTES;
			this.entryFileExists =
				pluginOrOptions.entryFileExists ?? (() => false);
		} else {
			this.adapter = pluginOrOptions.app.vault.adapter;
			this.sessionsDir = `${pluginOrOptions.app.vault.configDir}/plugins/obsidian-harness/sessions`;
			this.now = () => new Date().toISOString();
			this.blobThresholdBytes = DEFAULT_BLOB_THRESHOLD_BYTES;
			this.entryFileExists = (entryFile) =>
				pluginOrOptions.app.vault.getAbstractFileByPath(entryFile) !==
				null;
		}
	}

	getSessionsDir(): string {
		return this.sessionsDir;
	}

	private historyDir(historyId: string): string {
		return `${this.sessionsDir}/${historyId}`;
	}

	private manifestPath(historyId: string): string {
		return `${this.historyDir(historyId)}/manifest.json`;
	}

	private turnsPath(historyId: string): string {
		return `${this.historyDir(historyId)}/turns.jsonl`;
	}

	private checkpointPath(historyId: string): string {
		return `${this.historyDir(historyId)}/active-turn.json`;
	}

	private checkpointTempPath(historyId: string): string {
		return `${this.historyDir(historyId)}/active-turn.tmp`;
	}

	private blobsDir(historyId: string): string {
		return `${this.historyDir(historyId)}/blobs`;
	}

	private async ensureSessionsDir(): Promise<void> {
		if (!(await this.adapter.exists(this.sessionsDir))) {
			await this.adapter.mkdir(this.sessionsDir);
		}
	}

	private async ensureHistoryDir(historyId: string): Promise<void> {
		await this.ensureSessionsDir();
		const path = this.historyDir(historyId);
		if (!(await this.adapter.exists(path))) await this.adapter.mkdir(path);
	}

	private async ensureBlobsDir(historyId: string): Promise<void> {
		await this.ensureHistoryDir(historyId);
		const path = this.blobsDir(historyId);
		if (!(await this.adapter.exists(path))) await this.adapter.mkdir(path);
	}

	async initializeTranscript(
		historyId: string,
		metadata: TranscriptMetadata,
	): Promise<TranscriptManifest> {
		await this.ensureHistoryDir(historyId);
		const path = this.manifestPath(historyId);
		if (await this.adapter.exists(path)) {
			const existing = JSON.parse(
				await this.adapter.read(path),
			) as unknown;
			if (!isRecord(existing)) throw new Error("Manifest is invalid");
			assertSupportedVersion(existing);
			if (existing.schemaVersion !== TRANSCRIPT_SCHEMA_VERSION) {
				throw new Error("Manifest is missing schema version 2");
			}
			return clone(existing) as unknown as TranscriptManifest;
		}

		const manifest: TranscriptManifest = {
			schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
			historyId,
			createdAt: metadata.createdAt,
			updatedAt: this.now(),
			metadata: {
				agentId: metadata.agentId,
				cwd: metadata.cwd,
				title: metadata.title,
			},
		};
		await this.adapter.write(path, JSON.stringify(manifest, null, 2));
		return clone(manifest);
	}

	async writeCheckpoint(
		historyId: string,
		checkpoint: ActiveTurnRecord,
	): Promise<void> {
		await this.ensureHistoryDir(historyId);
		parseTurn(checkpoint, "active");
		const temporary = this.checkpointTempPath(historyId);
		await this.adapter.write(temporary, JSON.stringify(checkpoint));
		await this.adapter.rename(temporary, this.checkpointPath(historyId));
	}

	async commitTurn(historyId: string, turn: TurnRecord): Promise<void> {
		await this.ensureHistoryDir(historyId);
		parseTurn(turn);
		const existingIds = await this.readCommittedTurnIds(historyId);
		if (existingIds.has(turn.turnId)) {
			await this.removeMatchingCheckpoint(historyId, turn.turnId);
			return;
		}

		const storedTurn = await this.externalizeLargeOutputs(historyId, turn);
		const path = this.turnsPath(historyId);
		const line = `${JSON.stringify(storedTurn)}\n`;
		if (await this.adapter.exists(path)) {
			await this.adapter.append(path, line);
		} else {
			await this.adapter.write(path, line);
		}

		const committedIds = await this.readCommittedTurnIds(historyId);
		if (!committedIds.has(turn.turnId)) {
			throw new Error(`Committed turn ${turn.turnId} is not readable`);
		}
		await this.touchManifest(historyId);
		await this.removeMatchingCheckpoint(historyId, turn.turnId);
	}

	async readTranscript(historyId: string): Promise<TranscriptReadResult> {
		const warnings: TranscriptWarning[] = [];
		if (!(await this.adapter.exists(this.historyDir(historyId)))) {
			return {
				turns: [],
				warnings: [
					{
						code: "missing_transcript",
						path: this.historyDir(historyId),
						message: `Local history is unavailable: ${historyId}`,
					},
				],
			};
		}
		const manifest = await this.readManifest(historyId, warnings);
		const turns = await this.readTurns(historyId, warnings);
		const seen = new Set(turns.map((turn) => turn.turnId));
		const checkpoint = await this.readCheckpoint(historyId, warnings);
		if (checkpoint && !seen.has(checkpoint.turnId)) {
			const interrupted: TurnRecord = {
				...checkpoint,
				status: "interrupted",
			};
			turns.push(interrupted);
		}

		for (let index = 0; index < turns.length; index++) {
			turns[index] = await this.resolveBlobOutputs(
				historyId,
				turns[index],
				warnings,
			);
		}
		return { manifest, turns, warnings };
	}

	async deleteTranscript(historyId: string): Promise<void> {
		const dir = this.historyDir(historyId);
		if (await this.adapter.exists(dir)) {
			await this.adapter.rmdir(dir, true);
		}
	}

	private async externalizeLargeOutputs(
		historyId: string,
		turn: TurnRecord,
	): Promise<TurnRecord> {
		const stored = clone(turn);
		for (const item of stored.items) {
			if (item.type !== "tool" || item.rawOutput === undefined) continue;
			if (isBlobRef(item.rawOutput)) continue;
			const content = canonicalJson(item.rawOutput);
			const byteLength = Buffer.byteLength(content, "utf8");
			if (byteLength <= this.blobThresholdBytes) continue;

			const digest = sha256(content);
			await this.ensureBlobsDir(historyId);
			const path = `${this.blobsDir(historyId)}/sha256-${digest}`;
			if (
				!(await this.adapter.exists(path)) ||
				sha256(await this.adapter.read(path)) !== digest
			) {
				await this.adapter.write(path, content);
			}
			item.rawOutput = {
				type: "blob_ref",
				schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
				sha256: digest,
				mediaType: "application/json",
				byteLength,
				preview: content.slice(0, 200),
			};
		}
		return stored;
	}

	private async resolveBlobOutputs(
		historyId: string,
		turn: TurnRecord,
		warnings: TranscriptWarning[],
	): Promise<TurnRecord> {
		const resolved = clone(turn);
		for (const item of resolved.items) {
			if (item.type !== "tool" || !isBlobRef(item.rawOutput)) continue;
			const reference = item.rawOutput;
			const path = `${this.blobsDir(historyId)}/sha256-${reference.sha256}`;
			const unavailable = (reason: "missing" | "corrupt") => {
				warnings.push({
					code:
						reason === "missing" ? "missing_blob" : "corrupt_blob",
					path,
					message: `Tool output blob ${reference.sha256} is ${reason}`,
					expectedSha256: reference.sha256,
				});
				item.rawOutput = {
					unavailable: true,
					expectedSha256: reference.sha256,
					reason,
					preview: reference.preview,
				};
			};
			if (!(await this.adapter.exists(path))) {
				unavailable("missing");
				continue;
			}
			const content = await this.adapter.read(path);
			if (sha256(content) !== reference.sha256) {
				unavailable("corrupt");
				continue;
			}
			try {
				item.rawOutput = JSON.parse(content) as Record<string, unknown>;
			} catch {
				unavailable("corrupt");
			}
		}
		return resolved;
	}

	private async readManifest(
		historyId: string,
		warnings: TranscriptWarning[],
	): Promise<TranscriptManifest | undefined> {
		const path = this.manifestPath(historyId);
		if (!(await this.adapter.exists(path))) return undefined;
		try {
			const value = JSON.parse(await this.adapter.read(path)) as unknown;
			if (!isRecord(value)) throw new Error("Manifest must be an object");
			assertSupportedVersion(value);
			if (
				value.schemaVersion !== TRANSCRIPT_SCHEMA_VERSION ||
				value.historyId !== historyId ||
				typeof value.createdAt !== "string" ||
				typeof value.updatedAt !== "string" ||
				!isRecord(value.metadata)
			) {
				throw new Error("Manifest fields are invalid");
			}
			return clone(value) as unknown as TranscriptManifest;
		} catch (error) {
			if (error instanceof UnsupportedTranscriptVersionError) throw error;
			warnings.push({
				code: "corrupt_manifest",
				path,
				message: `Cannot read transcript manifest: ${String(error)}`,
			});
			return undefined;
		}
	}

	private async readTurns(
		historyId: string,
		warnings: TranscriptWarning[],
	): Promise<TurnRecord[]> {
		const path = this.turnsPath(historyId);
		if (!(await this.adapter.exists(path))) return [];
		const turns: TurnRecord[] = [];
		const seen = new Set<string>();
		const lines = (await this.adapter.read(path)).split("\n");
		for (let index = 0; index < lines.length; index++) {
			if (lines[index].trim().length === 0) continue;
			try {
				const turn = parseTurn(JSON.parse(lines[index])) as TurnRecord;
				if (seen.has(turn.turnId)) {
					warnings.push({
						code: "duplicate_turn",
						path,
						message: `Duplicate turn ${turn.turnId} at line ${index + 1}`,
					});
					continue;
				}
				seen.add(turn.turnId);
				turns.push(turn);
			} catch (error) {
				if (error instanceof UnsupportedTranscriptVersionError)
					throw error;
				warnings.push({
					code: "corrupt_turn",
					path,
					message: `Cannot read turn at line ${index + 1}: ${String(error)}`,
				});
			}
		}
		return turns;
	}

	private async readCheckpoint(
		historyId: string,
		warnings: TranscriptWarning[],
	): Promise<ActiveTurnRecord | undefined> {
		const path = this.checkpointPath(historyId);
		if (!(await this.adapter.exists(path))) return undefined;
		try {
			return parseTurn(
				JSON.parse(await this.adapter.read(path)),
				"active",
			) as ActiveTurnRecord;
		} catch (error) {
			if (error instanceof UnsupportedTranscriptVersionError) throw error;
			warnings.push({
				code: "corrupt_checkpoint",
				path,
				message: `Cannot read active checkpoint: ${String(error)}`,
			});
			return undefined;
		}
	}

	private async readCommittedTurnIds(
		historyId: string,
	): Promise<Set<string>> {
		const warnings: TranscriptWarning[] = [];
		return new Set(
			(await this.readTurns(historyId, warnings)).map(
				(turn) => turn.turnId,
			),
		);
	}

	private async removeMatchingCheckpoint(
		historyId: string,
		turnId: string,
	): Promise<void> {
		const path = this.checkpointPath(historyId);
		if (!(await this.adapter.exists(path))) return;
		try {
			const checkpoint = parseTurn(
				JSON.parse(await this.adapter.read(path)),
				"active",
			) as ActiveTurnRecord;
			if (checkpoint.turnId === turnId) await this.adapter.remove(path);
		} catch {
			// A corrupt checkpoint is retained for reader diagnostics.
		}
	}

	private async touchManifest(historyId: string): Promise<void> {
		const path = this.manifestPath(historyId);
		if (!(await this.adapter.exists(path))) return;
		const value = JSON.parse(await this.adapter.read(path)) as unknown;
		if (!isRecord(value)) return;
		assertSupportedVersion(value);
		if (value.schemaVersion !== TRANSCRIPT_SCHEMA_VERSION) return;
		value.updatedAt = this.now();
		await this.adapter.write(path, JSON.stringify(value, null, 2));
	}

	private sessionIndexPath(): string {
		return `${this.sessionsDir}/session_index.jsonl`;
	}

	async appendSessionIndex(entry: SessionIndexEntry): Promise<void> {
		const result = await this.enqueueSessionIndexMutation(() =>
			this.reconcileSessionIndexEntry(entry),
		);
		if (result.status === "conflict") {
			throw new Error(
				`Session index conflict for ${entry.entryId}: ${result.conflictingEntryFiles.join(", ")}`,
			);
		}
	}

	async getSessionIndex(cwd?: string): Promise<SessionIndexEntry[]> {
		await this.sessionIndexMutationTail;
		const { entries } = await this.readSessionIndex();
		return cwd ? entries.filter((entry) => entry.cwd === cwd) : entries;
	}

	reconcileSessionIndex(
		entry: SessionFileData,
		entryFile: string,
	): Promise<SessionIndexReconciliationResult> {
		return this.enqueueSessionIndexMutation(() =>
			this.reconcileSessionIndexEntry({
				entryId: entry.entryId,
				historyId: entry.historyId,
				cwd: entry.cwd,
				entryFile,
			}),
		);
	}

	subscribeSessionIndex(listener: SessionIndexListener): () => void {
		this.sessionIndexListeners.add(listener);
		return () => this.sessionIndexListeners.delete(listener);
	}

	async removeSessionIndex(entryId: string): Promise<void> {
		return this.enqueueSessionIndexMutation(async () => {
			const path = this.sessionIndexPath();
			if (!(await this.adapter.exists(path))) return;
			const parsed = await this.readSessionIndex();
			const entries = parsed.entries.filter(
				(entry) => entry.entryId !== entryId,
			);
			if (entries.length === parsed.entries.length) return;
			await this.writeSessionIndex(entries, parsed.malformedLines);
			this.publishSessionIndexMutation({ type: "remove", entryId });
		});
	}

	private enqueueSessionIndexMutation<T>(
		operation: () => Promise<T>,
	): Promise<T> {
		const result = this.sessionIndexMutationTail.then(operation, operation);
		this.sessionIndexMutationTail = result.then(
			() => undefined,
			() => undefined,
		);
		return result;
	}

	private async reconcileSessionIndexEntry(
		entry: SessionIndexEntry,
	): Promise<SessionIndexReconciliationResult> {
		const parsed = await this.readSessionIndex();
		const matching = parsed.entries.filter(
			(candidate) => candidate.entryId === entry.entryId,
		);
		const alternatePaths = [
			...new Set(
				matching
					.map((candidate) => candidate.entryFile)
					.filter((entryFile) => entryFile !== entry.entryFile),
			),
		];
		const liveAlternatePaths: string[] = [];
		for (const entryFile of alternatePaths) {
			if (await this.entryFileExists(entryFile)) {
				liveAlternatePaths.push(entryFile);
			}
		}
		if (liveAlternatePaths.length > 0) {
			return {
				status: "conflict",
				entry,
				conflictingEntryFiles: [
					...liveAlternatePaths,
					entry.entryFile,
				].sort(),
			};
		}

		const unchanged =
			matching.length === 1 &&
			this.sessionIndexEntriesEqual(matching[0], entry);
		if (unchanged) return { status: "unchanged", entry };

		const entries = parsed.entries.filter(
			(candidate) => candidate.entryId !== entry.entryId,
		);
		entries.push(entry);
		await this.writeSessionIndex(entries, parsed.malformedLines);
		this.publishSessionIndexMutation({
			type: "upsert",
			entryId: entry.entryId,
		});
		return { status: "changed", entry };
	}

	private async readSessionIndex(): Promise<ParsedSessionIndex> {
		const path = this.sessionIndexPath();
		if (!(await this.adapter.exists(path))) {
			return { entries: [], malformedLines: [] };
		}
		const entries: SessionIndexEntry[] = [];
		const malformedLines: string[] = [];
		for (const line of (await this.adapter.read(path)).split("\n")) {
			if (!line.trim()) continue;
			try {
				const entry = JSON.parse(line) as SessionIndexEntry;
				if (this.isSessionIndexEntry(entry)) entries.push(entry);
				else malformedLines.push(line);
			} catch {
				malformedLines.push(line);
			}
		}
		return { entries, malformedLines };
	}

	private async writeSessionIndex(
		entries: readonly SessionIndexEntry[],
		malformedLines: readonly string[],
	): Promise<void> {
		const path = this.sessionIndexPath();
		const lines = [
			...entries.map((entry) => JSON.stringify(entry)),
			...malformedLines,
		];
		if (lines.length === 0) {
			if (await this.adapter.exists(path))
				await this.adapter.remove(path);
			return;
		}
		await this.ensureSessionsDir();
		await this.adapter.write(path, `${lines.join("\n")}\n`);
	}

	private isSessionIndexEntry(value: unknown): value is SessionIndexEntry {
		if (!isRecord(value)) return false;
		return ["entryId", "historyId", "cwd", "entryFile"].every(
			(field) =>
				typeof value[field] === "string" && value[field].length > 0,
		);
	}

	private sessionIndexEntriesEqual(
		left: SessionIndexEntry,
		right: SessionIndexEntry,
	): boolean {
		return (
			left.entryId === right.entryId &&
			left.historyId === right.historyId &&
			left.cwd === right.cwd &&
			left.entryFile === right.entryFile
		);
	}

	private publishSessionIndexMutation(mutation: SessionIndexMutation): void {
		for (const listener of this.sessionIndexListeners) {
			try {
				listener(mutation);
			} catch {
				// A subscriber cannot roll back a completed index mutation.
			}
		}
	}
}
