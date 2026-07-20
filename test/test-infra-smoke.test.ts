import { describe, expect, it } from "vitest";

import { createCompletedTurnFixture } from "./support/acp-turn-fixtures";
import { MemoryDataAdapter } from "./support/memory-data-adapter";

describe("turn transcript test infrastructure", () => {
	it("provides deterministic ACP-normalized updates", () => {
		const first = createCompletedTurnFixture();
		const second = createCompletedTurnFixture();
		expect(second).toEqual(first);
		expect(
			first.updates.some((update) => update.type === "tool_call"),
		).toBe(true);
		expect(
			first.updates.filter((update) => update.type === "usage_update"),
		).toHaveLength(2);
	});

	it("injects a one-shot atomic rename failure", async () => {
		const adapter = new MemoryDataAdapter();
		await adapter.write("sessions/h/active-turn.tmp", "checkpoint");
		adapter.failNext("rename", { path: "sessions/h/active-turn.tmp" });

		await expect(
			adapter.rename(
				"sessions/h/active-turn.tmp",
				"sessions/h/active-turn.json",
			),
		).rejects.toThrow("Injected rename failure");
		expect(adapter.hasFile("sessions/h/active-turn.tmp")).toBe(true);

		await adapter.rename(
			"sessions/h/active-turn.tmp",
			"sessions/h/active-turn.json",
		);
		expect(adapter.getFile("sessions/h/active-turn.json")).toBe(
			"checkpoint",
		);
	});
});
