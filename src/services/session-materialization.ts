import type { SessionFileData, SessionIndexEntry } from "../types/session";

export type MaterializationStage = "transcript" | "entry" | "index";

export interface MaterializationArtifacts<TEntry> {
	entry: TEntry;
	config: SessionFileData;
}

export interface MaterializationOperations<TEntry> {
	initializeTranscript: (config: SessionFileData) => Promise<void>;
	createEntry: (config: SessionFileData) => Promise<TEntry>;
	confirmIndex: (entry: SessionIndexEntry) => Promise<void>;
	deleteEntry: (entry: TEntry) => Promise<void>;
	deleteTranscript: (historyId: string) => Promise<void>;
	removeIndex: (entryId: string) => Promise<void>;
	refreshCatalog: () => Promise<void>;
}

export class SessionMaterializationError extends Error {
	constructor(
		readonly stage: MaterializationStage,
		readonly cause: unknown,
		readonly cleanupFailures: readonly string[],
	) {
		const reason = cause instanceof Error ? `: ${cause.message}` : "";
		super(
			`Session creation failed during ${stage}${reason}${
				cleanupFailures.length > 0
					? `; cleanup failed for ${cleanupFailures.join(", ")}`
					: ""
			}`,
		);
	}
}

export class SessionEntryLifecycleQueue {
	private readonly tails = new Map<string, Promise<void>>();
	private readonly suppressed = new Set<string>();

	suppress(entryId: string): void {
		this.suppressed.add(entryId);
	}

	isSuppressed(entryId: string): boolean {
		return this.suppressed.has(entryId);
	}

	run<T>(entryId: string, operation: () => Promise<T>): Promise<T> {
		const previous = this.tails.get(entryId) ?? Promise.resolve();
		const result = previous.then(operation, operation);
		const tail = result.then(
			() => undefined,
			() => undefined,
		);
		this.tails.set(entryId, tail);
		void tail.finally(() => {
			if (this.tails.get(entryId) === tail) this.tails.delete(entryId);
		});
		return result;
	}
}

export async function materializeSession<TEntry>(
	config: SessionFileData,
	entryFile: string,
	operations: MaterializationOperations<TEntry>,
): Promise<MaterializationArtifacts<TEntry>> {
	let stage: MaterializationStage = "transcript";
	let entry: TEntry | undefined;
	try {
		await operations.initializeTranscript(config);
		stage = "entry";
		entry = await operations.createEntry(config);
		stage = "index";
		await operations.confirmIndex({
			entryId: config.entryId,
			historyId: config.historyId,
			cwd: config.cwd,
			entryFile,
		});
		return { entry, config };
	} catch (error) {
		const cleanupFailures: string[] = [];
		if (entry !== undefined) {
			try {
				await operations.deleteEntry(entry);
			} catch {
				cleanupFailures.push(entryFile);
			}
		}
		try {
			await operations.removeIndex(config.entryId);
		} catch {
			cleanupFailures.push(`index:${config.entryId}`);
		}
		try {
			await operations.deleteTranscript(config.historyId);
		} catch {
			cleanupFailures.push(`sessions/${config.historyId}`);
		}
		try {
			await operations.refreshCatalog();
		} catch {
			cleanupFailures.push("Catalog refresh");
		}
		throw new SessionMaterializationError(stage, error, cleanupFailures);
	}
}
