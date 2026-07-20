#!/usr/bin/env node

import { readFile } from "node:fs/promises";

function parseArgs(argv) {
	const values = new Map();
	for (let index = 0; index < argv.length; index += 2) {
		const key = argv[index];
		const value = argv[index + 1];
		if (!key?.startsWith("--") || value === undefined) {
			throw new Error(`Invalid argument near: ${key ?? "<end>"}`);
		}
		values.set(key.slice(2), value);
	}
	return values;
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const reportPath = args.get("report");
	const coveragePath =
		args.get("coverage") ?? "coverage/coverage-summary.json";
	const acFilePath = args.get("ac-file");
	let requiredAc = (args.get("ac") ?? "")
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	const minimum = Number(args.get("min-lines") ?? "80");

	if (!reportPath) throw new Error("--report is required");
	if (!Number.isFinite(minimum) || minimum < 0 || minimum > 100) {
		throw new Error("--min-lines must be between 0 and 100");
	}

	const [report, coverageText, acFile] = await Promise.all([
		readFile(reportPath, "utf8"),
		readFile(coveragePath, "utf8"),
		acFilePath ? readFile(acFilePath, "utf8") : Promise.resolve(""),
	]);
	if (acFilePath) {
		requiredAc = [...new Set(acFile.match(/AC-\d{4}-[NBEF]-\d+/g) ?? [])];
		if (requiredAc.length === 0) {
			throw new Error(`no AC scenarios found in ${acFilePath}`);
		}
	}
	const coverage = JSON.parse(coverageText);
	const lineCoverage = coverage?.total?.lines?.pct;
	const errors = [];

	if (!/^status:\s*complete\s*$/m.test(report)) {
		errors.push("report status must be complete");
	}
	for (const ac of requiredAc) {
		const escaped = ac.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		if (!new RegExp(`${escaped}[^\\n]*\\[PASS\\]`, "i").test(report)) {
			errors.push(`missing PASS evidence for ${ac}`);
		}
	}
	if (typeof lineCoverage !== "number") {
		errors.push("coverage summary does not contain total.lines.pct");
	} else if (lineCoverage < minimum) {
		errors.push(`line coverage ${lineCoverage}% is below ${minimum}%`);
	}

	if (errors.length > 0) {
		for (const error of errors) console.error(`[submission-gate] ${error}`);
		process.exitCode = 1;
		return;
	}

	console.log(
		`[submission-gate] PASS (${requiredAc.length} AC scenarios, ${lineCoverage}% lines)`,
	);
}

main().catch((error) => {
	console.error(`[submission-gate] ${error.message}`);
	process.exitCode = 1;
});
