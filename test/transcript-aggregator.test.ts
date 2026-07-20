import { describe, expect, it } from "vitest";

import { TurnAggregator } from "../src/services/transcript-aggregator";
import { projectTranscript } from "../src/services/transcript-projection";
import { createCompletedTurnFixture } from "./support/acp-turn-fixtures";

function createAggregator() {
	let id = 0;
	let time = 0;
	return new TurnAggregator({
		createId: () => `item-${++id}`,
		now: () => `2026-07-20T00:00:0${time++}.000Z`,
	});
}

describe("TurnAggregator", () => {
	it("AC-0008-N-1: aggregates chunks and final tool state into one turn", () => {
		const fixture = createCompletedTurnFixture();
		const aggregator = createAggregator();
		aggregator.start({ turnId: "turn-1", prompt: fixture.prompt });
		for (const update of fixture.updates) aggregator.apply(update);

		const turn = aggregator.complete({ stopReason: fixture.stopReason });

		expect(turn.status).toBe("completed");
		expect(turn.prompt).toEqual(fixture.prompt);
		expect(turn.items.map((item) => item.type)).toEqual([
			"thought",
			"assistant_message",
			"tool",
			"plan",
			"assistant_message",
		]);
		expect(turn.items[0]).toMatchObject({
			type: "thought",
			text: "I will inspect it.",
		});
		expect(turn.items[1]).toMatchObject({
			type: "assistant_message",
			text: "Reading the files.",
		});
		expect(turn.items[2]).toMatchObject({
			type: "tool",
			toolCallId: "tool-1",
			status: "completed",
			rawInput: { path: "README.md" },
			rawOutput: { text: "# Project" },
		});
		expect(turn.usage).toEqual({ used: 180, size: 1000 });
		expect(turn.stopReason).toBe("end_turn");
	});

	it("AC-0008-B-1: drops empty chunks and keeps only final usage", () => {
		const aggregator = createAggregator();
		aggregator.start({
			turnId: "turn-empty",
			prompt: [{ type: "text", text: "hello" }],
		});
		aggregator.apply({
			type: "agent_message_chunk",
			sessionId: "s",
			text: "",
		});
		aggregator.apply({
			type: "usage_update",
			sessionId: "s",
			used: 1,
			size: 10,
		});
		aggregator.apply({
			type: "usage_update",
			sessionId: "s",
			used: 2,
			size: 10,
		});

		const turn = aggregator.complete({ stopReason: "end_turn" });
		expect(turn.items).toEqual([]);
		expect(turn.usage).toEqual({ used: 2, size: 10 });
	});

	it.each(["cancelled", "error"] as const)(
		"AC-0008-E-1: preserves partial content for %s turns",
		(status) => {
			const aggregator = createAggregator();
			aggregator.start({
				turnId: `turn-${status}`,
				prompt: [{ type: "text", text: "hello" }],
			});
			aggregator.apply({
				type: "agent_message_chunk",
				sessionId: "s",
				text: "partial",
			});

			const turn = aggregator.complete({ status, stopReason: status });
			expect(turn.status).toBe(status);
			expect(turn.items[0]).toMatchObject({ text: "partial" });
		},
	);

	it("AC-0009-N-1: returns isolated semantic checkpoints", () => {
		const aggregator = createAggregator();
		aggregator.start({
			turnId: "turn-checkpoint",
			prompt: [{ type: "text", text: "hello" }],
		});
		aggregator.apply({
			type: "agent_message_chunk",
			sessionId: "s",
			text: "first",
		});
		const checkpoint = aggregator.checkpoint();
		aggregator.apply({
			type: "agent_message_chunk",
			sessionId: "s",
			text: " second",
		});

		expect(checkpoint.status).toBe("active");
		expect(checkpoint.items[0]).toMatchObject({ text: "first" });
		expect(aggregator.checkpoint().items[0]).toMatchObject({
			text: "first second",
		});
	});

	it("AC-0009-E-1: finalizes a checkpoint as interrupted without fake completion", () => {
		const aggregator = createAggregator();
		aggregator.start({
			turnId: "turn-interrupted",
			prompt: [{ type: "text", text: "hello" }],
		});
		aggregator.apply({
			type: "agent_message_chunk",
			sessionId: "s",
			text: "partial",
		});

		const turn = aggregator.interrupt();
		expect(turn.status).toBe("interrupted");
		expect(turn.endedAt).toBeUndefined();
		expect(turn.stopReason).toBeUndefined();
	});

	it("AC-0007-E-1: retains unknown semantic types as visible placeholders", () => {
		const aggregator = createAggregator();
		aggregator.start({
			turnId: "turn-unknown",
			prompt: [{ type: "text", text: "hello" }],
		});
		aggregator.apply({
			type: "future_semantic_item",
			sessionId: "s",
		});
		const turn = aggregator.complete({ stopReason: "end_turn" });

		expect(turn.items[0]).toMatchObject({
			type: "unknown",
			updateType: "future_semantic_item",
		});
		const messages = projectTranscript([turn]);
		expect(messages[1].content).toContainEqual({
			type: "text",
			text: "[Unsupported transcript item: future_semantic_item]",
		});
		expect(JSON.stringify(turn)).not.toContain("sessionId");
	});

	it("keeps checkpoints and completed records isolated from caller mutation", () => {
		const prompt = [{ type: "text" as const, text: "hello" }];
		const aggregator = createAggregator();
		aggregator.start({ turnId: "turn-clone", prompt });
		prompt[0].text = "mutated prompt";
		aggregator.apply({
			type: "agent_message_chunk",
			sessionId: "s",
			text: "answer",
		});

		const checkpoint = aggregator.checkpoint();
		checkpoint.prompt[0] = { type: "text", text: "mutated checkpoint" };
		if (checkpoint.items[0].type === "assistant_message") {
			checkpoint.items[0].text = "mutated answer";
		}

		const turn = aggregator.complete({ stopReason: "end_turn" });
		expect(turn.prompt).toEqual([{ type: "text", text: "hello" }]);
		expect(turn.items[0]).toMatchObject({ text: "answer" });
	});

	it("rejects invalid turn lifecycle operations", () => {
		const aggregator = createAggregator();
		expect(() => aggregator.checkpoint()).toThrow(
			"No transcript turn is active",
		);

		aggregator.start({
			turnId: "turn-active",
			prompt: [{ type: "text", text: "hello" }],
		});
		expect(() =>
			aggregator.start({
				turnId: "turn-second",
				prompt: [{ type: "text", text: "second" }],
			}),
		).toThrow("A transcript turn is already active");

		aggregator.complete();
		expect(() => aggregator.complete()).toThrow(
			"No transcript turn is active",
		);
	});

	it("captures final session context and visible process errors", () => {
		const aggregator = createAggregator();
		aggregator.start({
			turnId: "turn-context",
			prompt: [{ type: "text", text: "hello" }],
		});
		aggregator.apply({
			type: "current_mode_update",
			sessionId: "s",
			currentModeId: "plan",
		});
		aggregator.apply({
			type: "config_option_update",
			sessionId: "s",
			configOptions: [
				{
					type: "boolean",
					id: "verbose",
					name: "Verbose",
					currentValue: true,
				},
			],
		});
		aggregator.apply({
			type: "process_error",
			sessionId: "s",
			error: {
				type: "process_crashed",
				agentId: "agent",
				title: "Agent stopped",
				message: "Process exited",
			},
		});

		const turn = aggregator.complete({ status: "error" });
		expect(turn.context).toEqual({
			modeId: "plan",
			configOptions: [
				{
					type: "boolean",
					id: "verbose",
					name: "Verbose",
					currentValue: true,
				},
			],
		});
		expect(projectTranscript([turn])[1].content).toContainEqual({
			type: "text",
			text: "[Agent error: Process exited]",
		});
	});
});

describe("projectTranscript", () => {
	it("projects prompts and assistant semantic items in stable order", () => {
		const fixture = createCompletedTurnFixture();
		const aggregator = createAggregator();
		aggregator.start({ turnId: "turn-project", prompt: fixture.prompt });
		for (const update of fixture.updates) aggregator.apply(update);
		const turn = aggregator.complete({ stopReason: fixture.stopReason });

		const messages = projectTranscript([turn]);
		expect(messages).toHaveLength(2);
		expect(messages[0]).toMatchObject({
			id: "turn-project:prompt",
			role: "user",
		});
		expect(messages[1]).toMatchObject({
			id: "turn-project:response",
			role: "assistant",
		});
		expect(messages[1].content.map((content) => content.type)).toEqual([
			"agent_thought",
			"text",
			"tool_call",
			"plan",
			"text",
		]);
	});

	it("projects embedded prompt text and blob-backed tool output visibly", () => {
		const aggregator = createAggregator();
		aggregator.start({
			turnId: "turn-rich",
			prompt: [
				{
					type: "resource",
					resource: {
						uri: "file:///note.md",
						mimeType: "text/markdown",
						text: "note body",
					},
				},
			],
		});
		aggregator.apply({
			type: "tool_call",
			sessionId: "s",
			toolCallId: "tool-blob",
			status: "completed",
			rawOutput: {
				schemaVersion: 2,
				sha256: "abc",
				mediaType: "text/plain",
				byteLength: 100,
				preview: "preview",
			},
		});
		const messages = projectTranscript([aggregator.complete()]);

		expect(messages[0].content).toEqual([
			{ type: "text", text: "note body" },
		]);
		expect(messages[1].content[0]).toMatchObject({
			type: "tool_call",
			rawOutput: { sha256: "abc", preview: "preview" },
		});
	});
});
