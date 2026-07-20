#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root =
	process.argv[2] ?? "skills/harness-session-importer/tests/fixtures";
const forbidden = [
	/\/Users\//,
	/\/home\/[A-Za-z0-9._-]+\//,
	/[A-Za-z]:\\Users\\/i,
	/\b(?:api[_-]?key|access[_-]?token|secret)\s*[:=]/i,
	/\bsk-[A-Za-z0-9_-]{12,}/,
];

async function filesUnder(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const item = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await filesUnder(item)));
		else if (!entry.name.startsWith(".")) files.push(item);
	}
	return files;
}

const violations = [];
for (const file of await filesUnder(root)) {
	const content = await readFile(file, "utf8");
	for (const pattern of forbidden) {
		if (pattern.test(content)) violations.push(`${file}: ${pattern}`);
	}
}

if (violations.length > 0) {
	for (const violation of violations)
		console.error(`[fixture-lint] ${violation}`);
	process.exitCode = 1;
} else {
	console.log("[fixture-lint] PASS");
}
