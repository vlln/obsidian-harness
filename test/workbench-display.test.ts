import { describe, expect, it } from "vitest";

import {
	formatThoughtDuration,
	formatToolPayload,
	summarizeToolInput,
	truncateMiddle,
} from "../src/services/workbench-display";

describe("workbench display helpers", () => {
	it("formats thought duration in seconds", () => {
		expect(
			formatThoughtDuration(
				"2026-07-18T16:00:00.000Z",
				"2026-07-18T16:00:02.400Z",
			),
		).toBe("2s");
		expect(formatThoughtDuration(undefined, undefined)).toBe("0s");
	});

	it("truncates long summaries with a bounded length", () => {
		const result = truncateMiddle("a ".repeat(100), 24);
		expect(result.length).toBeLessThanOrEqual(24);
		expect(result).toContain("…");
	});

	it("summarizes command input before falling back to JSON", () => {
		expect(
			summarizeToolInput({
				rawInput: { command: "ls", args: ["-la", "."] },
				vaultPath: "/tmp/vault",
			}),
		).toBe("$ ls -la .");
	});

	it("formats full tool payload with stable key order", () => {
		expect(formatToolPayload({ z: 1, a: { b: true } })).toBe(
			'{\n  "a": {\n    "b": true\n  },\n  "z": 1\n}',
		);
	});
});
