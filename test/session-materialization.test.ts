import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
	materializeSession,
	SessionEntryLifecycleQueue,
	SessionMaterializationError,
	type MaterializationOperations,
} from "../src/services/session-materialization";
import type { SessionFileData } from "../src/types/session";

const root = fileURLToPath(new URL("..", import.meta.url));

const config: SessionFileData = {
	version: 2,
	entryId: "entry-1",
	historyId: "history-1",
	agentId: "",
	cwd: "/work/demo",
	title: "New Session",
	createdAt: "2026-07-27T00:00:00.000Z",
	updatedAt: "2026-07-27T00:00:00.000Z",
	forkedFrom: null,
};

function operations(
	order: string[],
): MaterializationOperations<{ path: string }> {
	return {
		initializeTranscript: vi.fn(async () => void order.push("transcript")),
		createEntry: vi.fn(async () => {
			order.push("entry");
			return { path: "Sessions/entry.session" };
		}),
		confirmIndex: vi.fn(async () => void order.push("index")),
		deleteEntry: vi.fn(async () => void order.push("delete-entry")),
		deleteTranscript: vi.fn(
			async () => void order.push("delete-transcript"),
		),
		removeIndex: vi.fn(async () => void order.push("remove-index")),
		refreshCatalog: vi.fn(async () => void order.push("refresh")),
	};
}

describe("session materialization", () => {
	it("AC-0024-N-1: publishes transcript, entry and exact index in order", async () => {
		const order: string[] = [];
		const ops = operations(order);
		await expect(
			materializeSession(config, "Sessions/entry.session", ops),
		).resolves.toMatchObject({ config });
		expect(order).toEqual(["transcript", "entry", "index"]);
		expect(ops.confirmIndex).toHaveBeenCalledWith({
			entryId: "entry-1",
			historyId: "history-1",
			cwd: "/work/demo",
			entryFile: "Sessions/entry.session",
		});
	});

	it.each(["transcript", "entry", "index"] as const)(
		"AC-0024-F-2: compensates a %s failure without deleting cwd",
		async (failedStage) => {
			const order: string[] = [];
			const ops = operations(order);
			vi.mocked(
				failedStage === "transcript"
					? ops.initializeTranscript
					: failedStage === "entry"
						? ops.createEntry
						: ops.confirmIndex,
			).mockRejectedValueOnce(new Error("injected"));
			await expect(
				materializeSession(config, "Sessions/entry.session", ops),
			).rejects.toMatchObject({ stage: failedStage });
			expect(order.slice(-3)).toEqual([
				"remove-index",
				"delete-transcript",
				"refresh",
			]);
			expect(order).not.toContain("delete-cwd");
		},
	);

	it("AC-0024-F-3: exposes precise cleanup failures", async () => {
		const ops = operations([]);
		vi.mocked(ops.confirmIndex).mockRejectedValueOnce(new Error("index"));
		vi.mocked(ops.deleteEntry).mockRejectedValueOnce(new Error("entry"));
		vi.mocked(ops.deleteTranscript).mockRejectedValueOnce(
			new Error("transcript"),
		);
		await expect(
			materializeSession(config, "Sessions/entry.session", ops),
		).rejects.toEqual(
			expect.objectContaining<Partial<SessionMaterializationError>>({
				cleanupFailures: [
					"Sessions/entry.session",
					"sessions/history-1",
				],
			}),
		);
	});

	it("AC-0024-F-2: serializes reconciliation after compensation", async () => {
		const queue = new SessionEntryLifecycleQueue();
		const order: string[] = [];
		let release!: () => void;
		const blocked = new Promise<void>((resolve) => {
			release = resolve;
		});
		const transaction = queue.run("entry-1", async () => {
			order.push("transaction");
			await blocked;
			order.push("compensation");
		});
		const reconciliation = queue.run("entry-1", async () => {
			order.push("reconciliation");
		});
		release();
		await Promise.all([transaction, reconciliation]);
		expect(order).toEqual([
			"transaction",
			"compensation",
			"reconciliation",
		]);
	});

	it("AC-0024-F-3: suppresses reconciliation for a residual failed entry", async () => {
		const queue = new SessionEntryLifecycleQueue();
		await expect(
			queue.run("entry-1", async () => {
				queue.suppress("entry-1");
				throw new Error("compensation failed");
			}),
		).rejects.toThrow("compensation failed");
		const reconcile = vi.fn();
		await queue.run("entry-1", async () => {
			if (!queue.isSuppressed("entry-1")) reconcile();
		});
		expect(reconcile).not.toHaveBeenCalled();
	});

	it("AC-0024-N-1/B-1: wires Navigator to a side-effect-free modal", async () => {
		const [view, plugin] = await Promise.all([
			readFile(join(root, "src/ui/SessionManagerView.tsx"), "utf8"),
			readFile(join(root, "src/plugin.ts"), "utf8"),
		]);
		expect(view).toContain("plugin.openSessionCreationModal()");
		expect(view).not.toContain(
			"onClick={() => void plugin.createSessionFile()}",
		);
		expect(plugin).toContain("new SessionCreationModal(this.app");
		expect(plugin).toMatch(
			/initializeTranscript:[\s\S]*?createEntry:[\s\S]*?confirmIndex:/,
		);
		expect(plugin).toContain("this.sessionEntryLifecycle.run(");
	});
});
