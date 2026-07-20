import { describe, expect, it } from "vitest";

import { SessionStorage } from "../src/services/session-storage";
import { TurnAggregator } from "../src/services/transcript-aggregator";
import type { TurnRecord } from "../src/types/transcript";
import { MemoryDataAdapter } from "./support/memory-data-adapter";

const sessionsDir = "sessions";

function createStorage(
	adapter: MemoryDataAdapter,
	options: { blobThresholdBytes?: number } = {},
) {
	return new SessionStorage({
		adapter,
		sessionsDir,
		now: () => "2026-07-20T01:00:00.000Z",
		...options,
	});
}

function createTurn(
	turnId: string,
	rawOutput?: Record<string, unknown>,
): TurnRecord {
	const aggregator = new TurnAggregator({
		createId: () => `${turnId}-item`,
		now: () => "2026-07-20T00:00:00.000Z",
	});
	aggregator.start({
		turnId,
		prompt: [{ type: "text", text: `prompt ${turnId}` }],
	});
	aggregator.apply({
		type: "tool_call",
		sessionId: "acp",
		toolCallId: `${turnId}-tool`,
		status: "completed",
		rawOutput,
	});
	return aggregator.complete({ stopReason: "end_turn" });
}

function asActive(turn: TurnRecord) {
	const active: Partial<TurnRecord> = { ...turn };
	delete active.endedAt;
	delete active.stopReason;
	return { ...active, status: "active" as const };
}

describe("SessionStorage transcript v2", () => {
	it("AC-0012-N-1: initializes a v2 manifest and round-trips a turn", async () => {
		const adapter = new MemoryDataAdapter();
		const storage = createStorage(adapter);
		await storage.initializeTranscript("history-1", {
			agentId: "pi-acp",
			cwd: "/project",
			title: "Project session",
			createdAt: "2026-07-20T00:00:00.000Z",
		});
		const turn = createTurn("turn-1", { text: "small" });
		await storage.writeCheckpoint("history-1", asActive(turn));
		await storage.commitTurn("history-1", turn);

		const result = await storage.readTranscript("history-1");
		expect(result.warnings).toEqual([]);
		expect(result.manifest).toMatchObject({
			schemaVersion: 2,
			historyId: "history-1",
		});
		expect(result.turns).toEqual([turn]);
		expect(adapter.hasFile("sessions/history-1/active-turn.json")).toBe(
			false,
		);
	});

	it("AC-0009-N-1/F-1: atomically replaces checkpoints and preserves the last good file", async () => {
		const adapter = new MemoryDataAdapter();
		const storage = createStorage(adapter);
		const first = asActive(createTurn("turn-active"));
		await storage.writeCheckpoint("history-1", first);
		const original = adapter.getFile("sessions/history-1/active-turn.json");

		const second = {
			...first,
			items: [
				...first.items,
				{
					type: "assistant_message" as const,
					itemId: "later",
					text: "later",
				},
			],
		};
		adapter.failNext("rename", {
			path: "sessions/history-1/active-turn.tmp",
		});
		await expect(
			storage.writeCheckpoint("history-1", second),
		).rejects.toThrow("Injected rename failure");

		expect(adapter.getFile("sessions/history-1/active-turn.json")).toBe(
			original,
		);
		expect(adapter.hasFile("sessions/history-1/active-turn.tmp")).toBe(
			true,
		);
	});

	it("AC-0009-B-1/E-1: deduplicates a stale checkpoint and exposes an orphan as interrupted", async () => {
		const adapter = new MemoryDataAdapter();
		const storage = createStorage(adapter);
		const completed = createTurn("turn-completed");
		await storage.commitTurn("history-1", completed);
		await storage.writeCheckpoint("history-1", asActive(completed));

		let result = await storage.readTranscript("history-1");
		expect(result.turns).toHaveLength(1);

		const orphan = createTurn("turn-orphan");
		await storage.writeCheckpoint("history-1", asActive(orphan));
		result = await storage.readTranscript("history-1");
		expect(result.turns.at(-1)).toMatchObject({
			turnId: "turn-orphan",
			status: "interrupted",
		});
		expect(result.turns.at(-1)?.endedAt).toBeUndefined();
		expect(result.turns.at(-1)?.stopReason).toBeUndefined();
	});

	it("AC-0012-B-1/E-1: skips corrupt records and reports each damaged file", async () => {
		const adapter = new MemoryDataAdapter();
		const storage = createStorage(adapter);
		const turn = createTurn("turn-good");
		adapter.seedFile("sessions/history-1/manifest.json", "{");
		adapter.seedFile(
			"sessions/history-1/turns.jsonl",
			`${JSON.stringify(turn)}\nnot-json\n${JSON.stringify(turn)}\n`,
		);
		adapter.seedFile("sessions/history-1/active-turn.json", "{");

		const result = await storage.readTranscript("history-1");
		expect(result.turns).toEqual([turn]);
		expect(result.warnings.map((warning) => warning.code)).toEqual([
			"corrupt_manifest",
			"corrupt_turn",
			"duplicate_turn",
			"corrupt_checkpoint",
		]);
	});

	it("AC-0007-E-1: normalizes future stored item types into visible placeholders", async () => {
		const adapter = new MemoryDataAdapter();
		const storage = createStorage(adapter);
		const turn = createTurn("turn-future");
		(turn.items as unknown[]).push({
			type: "future_item",
			itemId: "future-1",
			privatePayload: "not retained",
		});
		adapter.seedFile(
			"sessions/history-1/turns.jsonl",
			`${JSON.stringify(turn)}\n`,
		);

		const result = await storage.readTranscript("history-1");
		expect(result.turns[0].items.at(-1)).toEqual({
			type: "unknown",
			itemId: "future-1",
			updateType: "future_item",
		});
	});

	it("rejects v1 without reading or rewriting it", async () => {
		const adapter = new MemoryDataAdapter();
		const storage = createStorage(adapter);
		const path = "sessions/history-1/manifest.json";
		const original = JSON.stringify({ schemaVersion: 1 });
		adapter.seedFile(path, original);

		await expect(storage.readTranscript("history-1")).rejects.toThrow(
			"Unsupported history version 1; requires version 2",
		);
		expect(adapter.getFile(path)).toBe(original);
	});

	it("AC-0013-N-1/B-1: writes large output before turns and deduplicates blobs", async () => {
		const adapter = new MemoryDataAdapter();
		const storage = createStorage(adapter, { blobThresholdBytes: 20 });
		const output = { text: "a sufficiently large tool output" };
		await storage.commitTurn("history-1", createTurn("turn-1", output));
		await storage.commitTurn("history-1", createTurn("turn-2", output));

		const blobs = (await adapter.list("sessions/history-1/blobs")).files;
		expect(blobs).toHaveLength(1);
		const blobWrite = adapter.operations.findIndex(
			(operation) =>
				operation.operation === "write" &&
				operation.path.includes("/blobs/"),
		);
		const turnAppend = adapter.operations.findIndex(
			(operation) =>
				operation.operation === "append" &&
				operation.path.endsWith("turns.jsonl"),
		);
		expect(blobWrite).toBeLessThan(turnAppend);

		const result = await storage.readTranscript("history-1");
		expect(result.turns[0]).toEqual(createTurn("turn-1", output));
		expect(result.turns[1]).toEqual(createTurn("turn-2", output));
	});

	it("AC-0013-E-1: localizes missing blob failures with the expected hash", async () => {
		const adapter = new MemoryDataAdapter();
		const storage = createStorage(adapter, { blobThresholdBytes: 20 });
		await storage.commitTurn(
			"history-1",
			createTurn("turn-1", { text: "a sufficiently large output" }),
		);
		const [blob] = (await adapter.list("sessions/history-1/blobs")).files;
		await adapter.remove(blob);

		const result = await storage.readTranscript("history-1");
		expect(result.warnings[0].code).toBe("missing_blob");
		expect(result.warnings[0].expectedSha256).toMatch(/^[a-f0-9]{64}$/);
		expect(result.turns[0].items[0]).toMatchObject({
			type: "tool",
			rawOutput: {
				unavailable: true,
			},
		});
		const item = result.turns[0].items[0];
		if (item.type !== "tool") throw new Error("Expected tool item");
		expect(item.rawOutput?.expectedSha256).toMatch(/^[a-f0-9]{64}$/);
	});

	it("AC-0013-F-1: does not append a turn when blob persistence fails", async () => {
		const adapter = new MemoryDataAdapter();
		const storage = createStorage(adapter, { blobThresholdBytes: 20 });
		adapter.failNext("write", {
			path: undefined,
			error: new Error("blob unavailable"),
		});

		await expect(
			storage.commitTurn(
				"history-1",
				createTurn("turn-1", { text: "a sufficiently large output" }),
			),
		).rejects.toThrow("blob unavailable");
		expect(adapter.hasFile("sessions/history-1/turns.jsonl")).toBe(false);
	});

	it("AC-0013-E-1: localizes corrupt blob content without hiding the turn", async () => {
		const adapter = new MemoryDataAdapter();
		const storage = createStorage(adapter, { blobThresholdBytes: 20 });
		await storage.commitTurn(
			"history-1",
			createTurn("turn-1", { text: "a sufficiently large output" }),
		);
		const [blob] = (await adapter.list("sessions/history-1/blobs")).files;
		await adapter.write(blob, "corrupt");

		const result = await storage.readTranscript("history-1");
		expect(result.turns).toHaveLength(1);
		expect(result.warnings[0].code).toBe("corrupt_blob");
	});

	it("commits each turnId once and removes its stale checkpoint on retry", async () => {
		const adapter = new MemoryDataAdapter();
		const storage = createStorage(adapter);
		const turn = createTurn("turn-once");
		await storage.commitTurn("history-1", turn);
		await storage.writeCheckpoint("history-1", asActive(turn));
		await storage.commitTurn("history-1", turn);

		const lines = adapter
			.getFile("sessions/history-1/turns.jsonl")
			?.trim()
			.split("\n");
		expect(lines).toHaveLength(1);
		expect(adapter.hasFile("sessions/history-1/active-turn.json")).toBe(
			false,
		);
	});

	it("preserves session index filtering, malformed-line tolerance and cleanup", async () => {
		const adapter = new MemoryDataAdapter();
		const storage = createStorage(adapter);
		await storage.appendSessionIndex({
			sessionId: "one",
			cwd: "/one",
			entryFile: "one.session",
		});
		await storage.appendSessionIndex({
			sessionId: "two",
			cwd: "/two",
			entryFile: "two.session",
		});
		await adapter.append("sessions/session_index.jsonl", "bad-json\n");

		expect(await storage.getSessionIndex("/two")).toEqual([
			{
				sessionId: "two",
				cwd: "/two",
				entryFile: "two.session",
			},
		]);
		await storage.removeSessionIndex("one");
		expect(
			(await storage.getSessionIndex()).map((entry) => entry.sessionId),
		).toEqual(["two"]);
		await storage.removeSessionIndex("two");
		expect(await storage.getSessionIndex()).toEqual([]);
	});

	it("deletes a transcript directory recursively", async () => {
		const adapter = new MemoryDataAdapter();
		const storage = createStorage(adapter);
		await storage.commitTurn("history-1", createTurn("turn-1"));
		await storage.deleteTranscript("history-1");
		expect(await adapter.exists("sessions/history-1")).toBe(false);
	});
});
