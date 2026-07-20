import { describe, expect, it, vi } from "vitest";

import { TranscriptRecorder } from "../src/services/transcript-recorder";
import type { ActiveTurnRecord, TurnRecord } from "../src/types/transcript";

class RecordingStorage {
	checkpoints: ActiveTurnRecord[] = [];
	turns: TurnRecord[] = [];
	failCheckpoint = false;
	failCommit = false;

	async writeCheckpoint(_historyId: string, turn: ActiveTurnRecord) {
		if (this.failCheckpoint) throw new Error("checkpoint unavailable");
		this.checkpoints.push(turn);
	}

	async commitTurn(_historyId: string, turn: TurnRecord) {
		if (this.failCommit) throw new Error("commit unavailable");
		this.turns.push(turn);
	}
}

function createRecorder(storage: RecordingStorage) {
	let id = 0;
	return new TranscriptRecorder(storage, "history-1", {
		createId: () => `id-${++id}`,
		now: () => "2026-07-20T00:00:00.000Z",
		checkpointDelayMs: 0,
	});
}

describe("TranscriptRecorder", () => {
	it("does not persist ACP load replay outside an active prompt", async () => {
		const storage = new RecordingStorage();
		const recorder = createRecorder(storage);
		recorder.apply({
			type: "user_message_chunk",
			sessionId: "acp",
			text: "replayed history",
		});
		await recorder.flushCheckpoint();
		expect(storage.checkpoints).toEqual([]);
		expect(storage.turns).toEqual([]);
	});

	it("AC-0009-N-1: coalesces streaming into semantic checkpoints", async () => {
		const storage = new RecordingStorage();
		const recorder = createRecorder(storage);
		recorder.start([{ type: "text", text: "hello" }]);
		recorder.apply({
			type: "agent_message_chunk",
			sessionId: "acp",
			text: "first ",
		});
		recorder.apply({
			type: "agent_message_chunk",
			sessionId: "acp",
			text: "second",
		});
		await recorder.flushCheckpoint();

		expect(storage.checkpoints).toHaveLength(1);
		expect(storage.checkpoints[0].items).toMatchObject([
			{ type: "assistant_message", text: "first second" },
		]);
	});

	it("AC-0012-F-1: retains an active aggregate after checkpoint failure", async () => {
		const storage = new RecordingStorage();
		storage.failCheckpoint = true;
		const recorder = createRecorder(storage);
		const listener = vi.fn();
		recorder.onPersistenceStateChange(listener);
		recorder.start([{ type: "text", text: "hello" }]);
		recorder.apply({
			type: "agent_message_chunk",
			sessionId: "acp",
			text: "answer",
		});
		await recorder.flushCheckpoint();

		expect(recorder.getPersistenceState()).toMatchObject({
			state: "error",
			message: "checkpoint unavailable",
		});
		storage.failCheckpoint = false;
		await recorder.flushCheckpoint();
		expect(storage.checkpoints[0].items[0]).toMatchObject({
			text: "answer",
		});
		expect(listener).toHaveBeenCalled();
	});

	it("AC-0012-F-1/0013-F-1: retains a completed turn until retry succeeds", async () => {
		const storage = new RecordingStorage();
		storage.failCommit = true;
		const recorder = createRecorder(storage);
		recorder.start([{ type: "text", text: "hello" }]);
		recorder.apply({
			type: "agent_message_chunk",
			sessionId: "acp",
			text: "answer",
		});

		expect(await recorder.complete({ stopReason: "end_turn" })).toBe(false);
		const failedState = recorder.getPersistenceState();
		expect(failedState.state).toBe("error");
		if (failedState.state !== "error")
			throw new Error("Expected error state");
		expect(failedState.pendingTurnId).toMatch(/^id-/);
		expect(storage.turns).toEqual([]);

		storage.failCommit = false;
		expect(await recorder.retry()).toBe(true);
		expect(storage.turns).toHaveLength(1);
		expect(recorder.getPersistenceState()).toEqual({ state: "saved" });
	});

	it("finalizes active work as interrupted without completion metadata", async () => {
		const storage = new RecordingStorage();
		const recorder = createRecorder(storage);
		recorder.start([{ type: "text", text: "hello" }]);
		recorder.apply({
			type: "agent_message_chunk",
			sessionId: "acp",
			text: "partial",
		});

		expect(await recorder.interrupt()).toBe(true);
		expect(storage.turns[0]).toMatchObject({ status: "interrupted" });
		expect(storage.turns[0].endedAt).toBeUndefined();
		expect(storage.turns[0].stopReason).toBeUndefined();
	});
});
