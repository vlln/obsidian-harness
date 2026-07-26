import { parseSessionFileData } from "./session-entry";
import type { SessionIndexEntry } from "../types/session";
import type {
	SessionCatalogIssue,
	SessionCatalogItem,
	SessionCatalogSnapshot,
	SessionProjectGroup,
	SessionRuntimeStatus,
} from "../types/session-catalog";

export interface SessionCatalogSources {
	getSessionIndex(): Promise<SessionIndexEntry[]>;
	readSessionEntry(entryFile: string): Promise<string>;
	getRuntimeSnapshot(): {
		statuses: Readonly<Record<string, SessionRuntimeStatus>>;
	};
	getActiveEntryFile(): string | null;
	subscribeIndex(listener: () => void): () => void;
	subscribeSessionEntries(listener: () => void): () => void;
	subscribeRuntime(listener: () => void): () => void;
	subscribeActiveEntry(listener: () => void): () => void;
	onDebugWarning?(issue: SessionCatalogIssue): void;
}

export interface SessionCatalogOptions {
	readConcurrency?: number;
	debounceMs?: number;
}

const EMPTY_ITEMS = Object.freeze([]) as readonly SessionCatalogItem[];
const EMPTY_PROJECTS = Object.freeze([]) as readonly SessionProjectGroup[];
const EMPTY_ISSUES = Object.freeze([]) as readonly SessionCatalogIssue[];
const INITIAL_SNAPSHOT: SessionCatalogSnapshot = Object.freeze({
	phase: "loading",
	items: EMPTY_ITEMS,
	projects: EMPTY_PROJECTS,
	recents: EMPTY_ITEMS,
	issues: EMPTY_ISSUES,
});

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function compareItems(
	left: SessionCatalogItem,
	right: SessionCatalogItem,
): number {
	const byTime = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
	return byTime || left.entryFile.localeCompare(right.entryFile);
}

function pathParts(path: string): string[] {
	return path.split(/[\\/]+/).filter(Boolean);
}

function projectDisplayNames(cwds: readonly string[]): Map<string, string> {
	const byBasename = new Map<string, string[]>();
	for (const cwd of cwds) {
		const parts = pathParts(cwd);
		const basename = parts.at(-1) ?? cwd;
		const group = byBasename.get(basename) ?? [];
		group.push(cwd);
		byBasename.set(basename, group);
	}

	const names = new Map<string, string>();
	for (const [basename, group] of byBasename) {
		if (group.length === 1) {
			names.set(group[0], basename);
			continue;
		}
		const partsByCwd = new Map(group.map((cwd) => [cwd, pathParts(cwd)]));
		for (const cwd of group) {
			const parts = partsByCwd.get(cwd) ?? [cwd];
			let displayName = cwd;
			for (let depth = 2; depth <= parts.length; depth++) {
				const suffix = parts.slice(-depth).join("/");
				const unique = group.every(
					(other) =>
						other === cwd ||
						(partsByCwd.get(other) ?? [other])
							.slice(-depth)
							.join("/") !== suffix,
				);
				if (unique) {
					displayName = suffix;
					break;
				}
			}
			names.set(cwd, displayName);
		}
	}
	return names;
}

async function mapWithConcurrency<T, R>(
	values: readonly T[],
	limit: number,
	mapper: (value: T) => Promise<R>,
): Promise<R[]> {
	const results = new Array<R>(values.length);
	let next = 0;
	const workers = Array.from(
		{ length: Math.min(limit, values.length) },
		async () => {
			while (next < values.length) {
				const index = next++;
				results[index] = await mapper(values[index]);
			}
		},
	);
	await Promise.all(workers);
	return results;
}

export class SessionCatalogService {
	private readonly readConcurrency: number;
	private readonly debounceMs: number;
	private readonly listeners = new Set<() => void>();
	private readonly unsubscribers: Array<() => void> = [];
	private snapshot: SessionCatalogSnapshot = INITIAL_SNAPSHOT;
	private baseItems: readonly SessionCatalogItem[] = EMPTY_ITEMS;
	private baseIssues: readonly SessionCatalogIssue[] = EMPTY_ISSUES;
	private subscriptionIssues: readonly SessionCatalogIssue[] = EMPTY_ISSUES;
	private generation = 0;
	private refreshTimer: ReturnType<typeof setTimeout> | null = null;
	private started = false;

	constructor(
		private readonly sources: SessionCatalogSources,
		options: SessionCatalogOptions = {},
	) {
		this.readConcurrency = Math.max(1, options.readConcurrency ?? 16);
		this.debounceMs = Math.max(0, options.debounceMs ?? 50);
	}

	subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	getSnapshot = (): SessionCatalogSnapshot => this.snapshot;

	async start(): Promise<void> {
		if (this.started) return;
		this.started = true;
		const issues: SessionCatalogIssue[] = [];
		this.trySubscribe(
			() => this.sources.subscribeIndex(this.scheduleRefresh),
			"refresh_failed",
			issues,
		);
		this.trySubscribe(
			() => this.sources.subscribeSessionEntries(this.scheduleRefresh),
			"refresh_failed",
			issues,
		);
		this.trySubscribe(
			() => this.sources.subscribeRuntime(this.reproject),
			"runtime_unavailable",
			issues,
		);
		this.trySubscribe(
			() => this.sources.subscribeActiveEntry(this.reproject),
			"selection_unavailable",
			issues,
		);
		this.subscriptionIssues = Object.freeze(
			issues.map((issue) => Object.freeze(issue)),
		);
		await this.refresh();
	}

	dispose(): void {
		this.generation++;
		if (this.refreshTimer !== null) clearTimeout(this.refreshTimer);
		this.refreshTimer = null;
		for (const unsubscribe of this.unsubscribers.splice(0)) unsubscribe();
		this.listeners.clear();
		this.started = false;
	}

	refresh = async (): Promise<void> => {
		const generation = ++this.generation;
		try {
			const index = await this.sources.getSessionIndex();
			const { candidates, issues } = this.normalizeCandidates(index);
			const loaded = await mapWithConcurrency(
				candidates,
				this.readConcurrency,
				(candidate) => this.loadCandidate(candidate),
			);
			if (generation !== this.generation) return;
			const items: SessionCatalogItem[] = [];
			for (const result of loaded) {
				if ("item" in result) items.push(result.item);
				else issues.push(result.issue);
			}
			this.baseItems = Object.freeze(items.sort(compareItems));
			this.baseIssues = Object.freeze(
				[...this.subscriptionIssues, ...issues].map((issue) =>
					Object.freeze(issue),
				),
			);
			this.publishProjection("ready", this.baseIssues);
		} catch (error) {
			if (generation !== this.generation) return;
			const issue = Object.freeze({
				code: "refresh_failed" as const,
				message: errorMessage(error),
			});
			this.publishProjection("error", [...this.baseIssues, issue]);
		}
	};

	private scheduleRefresh = (): void => {
		if (this.refreshTimer !== null) return;
		this.refreshTimer = setTimeout(() => {
			this.refreshTimer = null;
			void this.refresh();
		}, this.debounceMs);
	};

	private trySubscribe(
		subscribe: () => () => void,
		code:
			| "refresh_failed"
			| "runtime_unavailable"
			| "selection_unavailable",
		issues: SessionCatalogIssue[],
	): void {
		try {
			this.unsubscribers.push(subscribe());
		} catch (error) {
			issues.push({ code, message: errorMessage(error) });
		}
	}

	private reproject = (): void => {
		this.publishProjection(this.snapshot.phase, this.baseIssues);
	};

	private normalizeCandidates(index: readonly SessionIndexEntry[]): {
		candidates: SessionIndexEntry[];
		issues: SessionCatalogIssue[];
	} {
		const byEntry = new Map<string, Map<string, SessionIndexEntry>>();
		for (const candidate of index) {
			let byFile = byEntry.get(candidate.entryId);
			if (!byFile) {
				byFile = new Map();
				byEntry.set(candidate.entryId, byFile);
			}
			if (!byFile.has(candidate.entryFile)) {
				byFile.set(candidate.entryFile, candidate);
			}
		}
		const candidates: SessionIndexEntry[] = [];
		const issues: SessionCatalogIssue[] = [];
		for (const [entryId, byFile] of byEntry) {
			if (byFile.size > 1) {
				issues.push({
					code: "entry_conflict",
					entryId,
					message: `Session entry ${entryId} maps to multiple files`,
				});
				continue;
			}
			candidates.push([...byFile.values()][0]);
		}
		return { candidates, issues };
	}

	private async loadCandidate(
		candidate: SessionIndexEntry,
	): Promise<{ item: SessionCatalogItem } | { issue: SessionCatalogIssue }> {
		let content: string;
		try {
			content = await this.sources.readSessionEntry(candidate.entryFile);
		} catch (error) {
			return {
				issue: {
					code: "missing_entry",
					entryId: candidate.entryId,
					entryFile: candidate.entryFile,
					message: errorMessage(error),
				},
			};
		}

		try {
			const entry = parseSessionFileData(content);
			if (
				entry.entryId !== candidate.entryId ||
				entry.historyId !== candidate.historyId
			) {
				return {
					issue: {
						code: "identity_conflict",
						entryId: candidate.entryId,
						entryFile: candidate.entryFile,
						message:
							"Session entry identity does not match its index row",
					},
				};
			}
			if (
				!entry.entryId ||
				!entry.historyId ||
				!entry.cwd ||
				!entry.title ||
				!Number.isFinite(Date.parse(entry.createdAt)) ||
				!Number.isFinite(Date.parse(entry.updatedAt))
			) {
				throw new Error("Session entry metadata is invalid");
			}
			return {
				item: Object.freeze({
					entryId: entry.entryId,
					historyId: entry.historyId,
					entryFile: candidate.entryFile,
					title: entry.title,
					agentId: entry.agentId,
					cwd: entry.cwd,
					createdAt: entry.createdAt,
					updatedAt: entry.updatedAt,
					runtimeStatus: null,
					isSelected: false,
				}),
			};
		} catch (error) {
			return {
				issue: {
					code: "invalid_entry",
					entryId: candidate.entryId,
					entryFile: candidate.entryFile,
					message: errorMessage(error),
				},
			};
		}
	}

	private publishProjection(
		phase: SessionCatalogSnapshot["phase"],
		baseIssues: readonly SessionCatalogIssue[],
	): void {
		const issues = [...baseIssues];
		let statuses: Readonly<Record<string, SessionRuntimeStatus>> = {};
		try {
			statuses = this.sources.getRuntimeSnapshot().statuses;
		} catch (error) {
			issues.push({
				code: "runtime_unavailable",
				message: errorMessage(error),
			});
		}
		let activeEntryFile: string | null = null;
		try {
			activeEntryFile = this.sources.getActiveEntryFile();
		} catch (error) {
			issues.push({
				code: "selection_unavailable",
				message: errorMessage(error),
			});
		}

		const entryIds = new Set(this.baseItems.map((item) => item.entryId));
		for (const entryId of Object.keys(statuses)) {
			if (entryIds.has(entryId)) continue;
			const issue: SessionCatalogIssue = {
				code: "orphan_runtime",
				entryId,
				message: `Runtime status has no Catalog entry for ${entryId}`,
			};
			issues.push(issue);
			this.sources.onDebugWarning?.(issue);
		}

		const items = Object.freeze(
			this.baseItems.map((item) =>
				Object.freeze({
					...item,
					runtimeStatus: statuses[item.entryId] ?? null,
					isSelected: item.entryFile === activeEntryFile,
				}),
			),
		);
		const recents = Object.freeze([...items].sort(compareItems));
		const projects = this.buildProjects(items);
		this.snapshot = Object.freeze({
			phase,
			items,
			projects,
			recents,
			issues: Object.freeze(issues.map((issue) => Object.freeze(issue))),
		});
		for (const listener of this.listeners) listener();
	}

	private buildProjects(
		items: readonly SessionCatalogItem[],
	): readonly SessionProjectGroup[] {
		const grouped = new Map<string, SessionCatalogItem[]>();
		for (const item of items) {
			const group = grouped.get(item.cwd) ?? [];
			group.push(item);
			grouped.set(item.cwd, group);
		}
		const names = projectDisplayNames([...grouped.keys()]);
		return Object.freeze(
			[...grouped]
				.map(([cwd, sessions]) => {
					const sorted = Object.freeze(
						[...sessions].sort(compareItems),
					);
					return Object.freeze({
						cwd,
						displayName: names.get(cwd) ?? cwd,
						sessions: sorted,
						updatedAt: sorted[0].updatedAt,
					});
				})
				.sort((left, right) => {
					const byTime =
						Date.parse(right.updatedAt) -
						Date.parse(left.updatedAt);
					return byTime || left.cwd.localeCompare(right.cwd);
				}),
		);
	}
}
