import { performance } from "node:perf_hooks";

import { describe, expect, it } from "vitest";

import { SessionCatalogService } from "../src/services/session-catalog";
import { searchSessionCatalog } from "../src/services/session-navigator";
import type { SessionFileData, SessionIndexEntry } from "../src/types/session";

describe("Session Navigator SYSTEM_TEST performance", () => {
	it("AC-0022-N-2: loads and searches 500 generated Sessions within budget without writes", async () => {
		const entries = new Map<string, SessionFileData>();
		const index: SessionIndexEntry[] = [];
		for (let value = 0; value < 500; value++) {
			const entryId = `performance-${value}`;
			const entryFile = `Generated/${entryId}.session`;
			const entry: SessionFileData = {
				version: 2,
				entryId,
				historyId: `history-${value}`,
				agentId: value % 2 === 0 ? "codex-acp" : "claude-code-acp",
				cwd: `/generated/project-${value % 25}`,
				title: `Generated Session ${value}`,
				createdAt: "2026-07-20T00:00:00.000Z",
				updatedAt: new Date(
					Date.UTC(2026, 6, 20, 0, value),
				).toISOString(),
				forkedFrom: null,
			};
			entries.set(entryFile, entry);
			index.push({
				entryId,
				historyId: entry.historyId,
				cwd: entry.cwd,
				entryFile,
			});
		}
		let writes = 0;
		const catalog = new SessionCatalogService({
			getSessionIndex: async () => index,
			readSessionEntry: async (entryFile) =>
				JSON.stringify(entries.get(entryFile)),
			getRuntimeSnapshot: () => ({ statuses: {} }),
			getActiveEntryFile: () => null,
			subscribeIndex: () => () => {},
			subscribeSessionEntries: () => () => {},
			subscribeRuntime: () => () => {},
			subscribeActiveEntry: () => () => {},
			onDebugWarning: () => {
				writes++;
			},
		});

		const loadStart = performance.now();
		await catalog.refresh();
		const loadDuration = performance.now() - loadStart;
		const searchStart = performance.now();
		const results = searchSessionCatalog(
			catalog.getSnapshot().items,
			catalog.getSnapshot().projects,
			"Generated Session 499",
		);
		const searchDuration = performance.now() - searchStart;

		expect(catalog.getSnapshot().items).toHaveLength(500);
		expect(results.map((item) => item.entryId)).toEqual([
			"performance-499",
		]);
		expect(loadDuration).toBeLessThan(500);
		expect(searchDuration).toBeLessThan(100);
		expect(writes).toBe(0);
	});
});
