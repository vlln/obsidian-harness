import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = fileURLToPath(
	new URL("../scripts/check-submission-gate.mjs", import.meta.url),
);
const requiredAc = [
	"AC-0007",
	"AC-0008",
	"AC-0009",
	"AC-0010",
	"AC-0011",
	"AC-0012",
	"AC-0013",
].join(",");

function runGate(report: string, coverage: string) {
	return spawnSync(
		process.execPath,
		[
			script,
			"--report",
			`${root}/test/fixtures/gates/${report}`,
			"--coverage",
			`${root}/test/fixtures/gates/${coverage}`,
			"--ac",
			requiredAc,
			"--min-lines",
			"80",
		],
		{ encoding: "utf8" },
	);
}

describe("submission gate", () => {
	it("accepts complete AC evidence with sufficient coverage", () => {
		const result = runGate("complete-report.txt", "coverage-pass.json");
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("PASS (7 AC groups, 91% lines)");
	});

	it("rejects incomplete AC evidence", () => {
		const result = runGate("incomplete-report.txt", "coverage-pass.json");
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("report status must be complete");
		expect(result.stderr).toContain("missing PASS evidence for AC-0008");
	});

	it("rejects insufficient coverage", () => {
		const result = runGate("complete-report.txt", "coverage-fail.json");
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("line coverage 42% is below 80%");
	});
});
