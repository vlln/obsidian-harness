import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
	isSessionEntryPath,
	reconcileSessionEntryIndex,
} from "../src/services/session-index-lifecycle";
import type { SessionFileData } from "../src/types/session";

const root = fileURLToPath(new URL("..", import.meta.url));

function createSessionEntry(): SessionFileData {
	return {
		version: 2,
		entryId: "entry-1",
		historyId: "history-1",
		agentId: "codex",
		cwd: "/workspace/project",
		title: "Project session",
		createdAt: "2026-07-20T00:00:00.000Z",
		updatedAt: "2026-07-20T01:00:00.000Z",
		forkedFrom: null,
	};
}

describe("session index lifecycle", () => {
	it("AC-0018-N-1: parses a valid entry and delegates its current path", async () => {
		const entry = createSessionEntry();
		const reconcile = vi.fn().mockResolvedValue({
			status: "changed",
			entry: {
				entryId: entry.entryId,
				historyId: entry.historyId,
				cwd: entry.cwd,
				entryFile: "Archive/project.session",
			},
		});

		await expect(
			reconcileSessionEntryIndex(
				"Archive/project.session",
				JSON.stringify(entry),
				reconcile,
			),
		).resolves.toMatchObject({ status: "changed" });
		expect(reconcile).toHaveBeenCalledWith(
			entry,
			"Archive/project.session",
		);
	});

	it("rejects damaged entry content without invoking storage", async () => {
		const reconcile = vi.fn();

		await expect(
			reconcileSessionEntryIndex(
				"Sessions/damaged.session",
				'{"version":2}',
				reconcile,
			),
		).rejects.toThrow("entryId");
		expect(reconcile).not.toHaveBeenCalled();
	});

	it("filters ordinary vault files and case-mismatched suffixes", () => {
		expect(isSessionEntryPath("Sessions/project.session")).toBe(true);
		expect(isSessionEntryPath("Sessions/project.md")).toBe(false);
		expect(isSessionEntryPath("Sessions/project.SESSION")).toBe(false);
	});

	it("wires create and rename reconciliation beside existing delete cleanup", async () => {
		const plugin = await readFile(join(root, "src/plugin.ts"), "utf8");

		expect(plugin).toContain(
			'this.app.vault.on("create", reconcileSessionFile)',
		);
		expect(plugin).toContain('this.app.vault.on("rename"');
		expect(plugin).toContain('this.app.vault.on("delete"');
		expect(plugin).toContain("!isSessionEntryPath(file.path)");
		expect(plugin).toContain("this.reconcileSessionFileIndex(file)");
	});
});
