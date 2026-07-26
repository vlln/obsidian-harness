import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
	SessionCatalogService,
	type SessionCatalogSources,
} from "../src/services/session-catalog";
import type { SessionFileData, SessionIndexEntry } from "../src/types/session";

const root = fileURLToPath(new URL("..", import.meta.url));

function entry(
	entryId: string,
	overrides: Partial<SessionFileData> = {},
): SessionFileData {
	return {
		version: 2,
		entryId,
		historyId: `history-${entryId}`,
		agentId: "codex",
		cwd: `/workspace/${entryId}`,
		title: `Title ${entryId}`,
		createdAt: "2026-07-20T00:00:00.000Z",
		updatedAt: "2026-07-20T01:00:00.000Z",
		forkedFrom: null,
		...overrides,
	};
}

function indexed(value: SessionFileData, entryFile: string): SessionIndexEntry {
	return {
		entryId: value.entryId,
		historyId: value.historyId,
		cwd: value.cwd,
		entryFile,
	};
}

function createSources(
	options: {
		index?: SessionIndexEntry[];
		files?: Record<string, SessionFileData | string>;
		runtime?: Record<
			string,
			"ready" | "busy" | "permission" | "error" | "disconnected"
		>;
		activeEntryFile?: string | null;
	} = {},
) {
	let index = options.index ?? [];
	const files = new Map(Object.entries(options.files ?? {}));
	let runtime = options.runtime ?? {};
	let activeEntryFile = options.activeEntryFile ?? null;
	let reads = 0;
	const listeners = {
		index: new Set<() => void>(),
		entry: new Set<() => void>(),
		runtime: new Set<() => void>(),
		active: new Set<() => void>(),
	};
	const subscribe =
		(kind: keyof typeof listeners) => (listener: () => void) => {
			listeners[kind].add(listener);
			return () => listeners[kind].delete(listener);
		};
	const sources: SessionCatalogSources = {
		getSessionIndex: async () => index,
		readSessionEntry: async (path) => {
			reads++;
			const value = files.get(path);
			if (value === undefined) throw new Error(`Missing ${path}`);
			return typeof value === "string" ? value : JSON.stringify(value);
		},
		getRuntimeSnapshot: () => ({ statuses: runtime }),
		getActiveEntryFile: () => activeEntryFile,
		subscribeIndex: subscribe("index"),
		subscribeSessionEntries: subscribe("entry"),
		subscribeRuntime: subscribe("runtime"),
		subscribeActiveEntry: subscribe("active"),
	};
	return {
		sources,
		get reads() {
			return reads;
		},
		setIndex(next: SessionIndexEntry[]) {
			index = next;
		},
		setRuntime(next: typeof runtime) {
			runtime = next;
		},
		setActive(path: string | null) {
			activeEntryFile = path;
		},
		emit(kind: keyof typeof listeners) {
			for (const listener of listeners[kind]) listener();
		},
	};
}

describe("SessionCatalogService", () => {
	it("AC-0017-N-2/N-2: uses authoritative entries and builds stable sorted projections", async () => {
		const alpha = entry("alpha", {
			cwd: "/clients/alpha/app",
			title: "Alpha work",
			updatedAt: "2026-07-20T03:00:00.000Z",
		});
		const beta = entry("beta", {
			cwd: "/clients/beta/app",
			title: "Beta work",
			updatedAt: "2026-07-20T02:00:00.000Z",
		});
		const tools = entry("tools", {
			cwd: "/workspace/tools",
			updatedAt: "2026-07-20T04:00:00.000Z",
		});
		const source = createSources({
			index: [
				{ ...indexed(beta, "b.session"), cwd: "/stale" },
				indexed(alpha, "a.session"),
				indexed(tools, "tools.session"),
			],
			files: {
				"a.session": alpha,
				"b.session": beta,
				"tools.session": tools,
			},
		});
		const catalog = new SessionCatalogService(source.sources);

		await catalog.refresh();
		const snapshot = catalog.getSnapshot();
		expect(snapshot.phase).toBe("ready");
		expect(snapshot.recents.map((item) => item.entryId)).toEqual([
			"tools",
			"alpha",
			"beta",
		]);
		expect(
			snapshot.items.find((item) => item.entryId === "beta"),
		).toMatchObject({
			title: "Beta work",
			cwd: "/clients/beta/app",
			agentId: "codex",
		});
		expect(snapshot.projects.map((project) => project.displayName)).toEqual(
			["tools", "alpha/app", "beta/app"],
		);
		expect(Object.isFrozen(snapshot)).toBe(true);
		expect(Object.isFrozen(snapshot.items)).toBe(true);
		expect(catalog.getSnapshot()).toBe(snapshot);
	});

	it("AC-0018-E-1: isolates missing, damaged and conflicting candidates", async () => {
		const valid = entry("valid");
		const conflict = entry("conflict");
		const indexedIdentity = entry("indexed");
		const source = createSources({
			index: [
				indexed(valid, "valid.session"),
				indexed(valid, "valid.session"),
				indexed(entry("missing"), "missing.session"),
				indexed(entry("damaged"), "damaged.session"),
				indexed(conflict, "first.session"),
				indexed(conflict, "second.session"),
				indexed(indexedIdentity, "identity.session"),
			],
			files: {
				"valid.session": valid,
				"damaged.session": "not-json",
				"first.session": conflict,
				"second.session": conflict,
				"identity.session": entry("actual"),
			},
		});
		const catalog = new SessionCatalogService(source.sources);

		await catalog.refresh();
		const snapshot = catalog.getSnapshot();
		expect(snapshot.items.map((item) => item.entryId)).toEqual(["valid"]);
		expect(snapshot.issues.map((issue) => issue.code).sort()).toEqual([
			"entry_conflict",
			"identity_conflict",
			"invalid_entry",
			"missing_entry",
		]);
		expect(source.reads).toBe(4);
	});

	it("AC-0018-F-1: retains the last good projection after an index refresh failure", async () => {
		const value = entry("one");
		const source = createSources({
			index: [indexed(value, "one.session")],
			files: { "one.session": value },
		});
		const catalog = new SessionCatalogService(source.sources);
		await catalog.refresh();
		const goodItems = catalog.getSnapshot().items;
		source.sources.getSessionIndex = async () => {
			throw new Error("index unavailable");
		};

		await catalog.refresh();
		expect(catalog.getSnapshot()).toMatchObject({
			phase: "error",
			items: goodItems,
		});
		expect(catalog.getSnapshot().issues.at(-1)).toMatchObject({
			code: "refresh_failed",
			message: "index unavailable",
		});
	});

	it("AR-010-05: limits entry read concurrency", async () => {
		const values = Array.from({ length: 8 }, (_, index) =>
			entry(`e${index}`),
		);
		let active = 0;
		let maximum = 0;
		const source = createSources({
			index: values.map((value) =>
				indexed(value, `${value.entryId}.session`),
			),
		});
		source.sources.readSessionEntry = async (path) => {
			active++;
			maximum = Math.max(maximum, active);
			await Promise.resolve();
			active--;
			return JSON.stringify(
				values.find((value) => path === `${value.entryId}.session`),
			);
		};
		const catalog = new SessionCatalogService(source.sources, {
			readConcurrency: 3,
		});

		await catalog.refresh();
		expect(maximum).toBe(3);
	});

	it("AR-010-05: prevents stale async completion from replacing a newer refresh", async () => {
		const old = entry("one", { title: "Old" });
		const current = entry("one", { title: "Current" });
		const source = createSources({ index: [indexed(old, "one.session")] });
		let releaseOld!: (value: string) => void;
		source.sources.readSessionEntry = vi
			.fn()
			.mockImplementationOnce(
				() => new Promise<string>((resolve) => (releaseOld = resolve)),
			)
			.mockResolvedValueOnce(JSON.stringify(current));
		const catalog = new SessionCatalogService(source.sources);

		const staleRefresh = catalog.refresh();
		await Promise.resolve();
		await catalog.refresh();
		releaseOld(JSON.stringify(old));
		await staleRefresh;
		expect(catalog.getSnapshot().items[0].title).toBe("Current");
	});

	it("AC-0019: reprojects runtime and active file without rereading storage", async () => {
		const value = entry("one");
		const source = createSources({
			index: [indexed(value, "one.session")],
			files: { "one.session": value },
		});
		const catalog = new SessionCatalogService(source.sources);
		await catalog.start();
		const reads = source.reads;

		source.setRuntime({ one: "busy", orphan: "permission" });
		source.emit("runtime");
		source.setActive("one.session");
		source.emit("active");

		expect(source.reads).toBe(reads);
		expect(catalog.getSnapshot().items[0]).toMatchObject({
			runtimeStatus: "busy",
			isSelected: true,
		});
		expect(catalog.getSnapshot().issues).toContainEqual(
			expect.objectContaining({
				code: "orphan_runtime",
				entryId: "orphan",
			}),
		);
		catalog.dispose();
	});

	it("AC-0019-F-1: keeps persistent sessions when runtime snapshot and subscription fail", async () => {
		const value = entry("one");
		const source = createSources({
			index: [indexed(value, "one.session")],
			files: { "one.session": value },
		});
		source.sources.subscribeRuntime = () => {
			throw new Error("runtime subscribe unavailable");
		};
		source.sources.getRuntimeSnapshot = () => {
			throw new Error("runtime snapshot unavailable");
		};
		const catalog = new SessionCatalogService(source.sources);

		await catalog.start();
		expect(catalog.getSnapshot().phase).toBe("ready");
		expect(catalog.getSnapshot().items).toHaveLength(1);
		expect(catalog.getSnapshot().items[0].runtimeStatus).toBeNull();
		expect(
			catalog
				.getSnapshot()
				.issues.filter((issue) => issue.code === "runtime_unavailable"),
		).toHaveLength(2);
		catalog.dispose();
	});

	it("AC-0018-N-1: coalesces entry and index bursts into one delayed refresh", async () => {
		vi.useFakeTimers();
		const source = createSources();
		const catalog = new SessionCatalogService(source.sources, {
			debounceMs: 50,
		});
		await catalog.start();
		const getIndex = vi.spyOn(source.sources, "getSessionIndex");

		source.emit("entry");
		source.emit("index");
		source.emit("entry");
		await vi.advanceTimersByTimeAsync(49);
		expect(getIndex).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(getIndex).toHaveBeenCalledTimes(1);
		catalog.dispose();
		source.emit("entry");
		await vi.advanceTimersByTimeAsync(50);
		expect(getIndex).toHaveBeenCalledTimes(1);
		vi.useRealTimers();
	});

	it("keeps Catalog contracts dependency-free and wires plugin lifecycle sources", async () => {
		const [service, types, plugin] = await Promise.all([
			readFile(join(root, "src/services/session-catalog.ts"), "utf8"),
			readFile(join(root, "src/types/session-catalog.ts"), "utf8"),
			readFile(join(root, "src/plugin.ts"), "utf8"),
		]);
		expect(service).not.toContain('from "react"');
		expect(service).not.toContain("@agentclientprotocol/sdk");
		expect(types).not.toMatch(/^import /m);
		expect(plugin).toContain(
			'this.app.vault.on("modify", notifySessionFile)',
		);
		expect(plugin).toContain("this.sessionCatalog.start()");
		expect(plugin).toContain("this.sessionCatalog?.dispose()");
	});
});
