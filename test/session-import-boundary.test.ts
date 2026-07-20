import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));

async function filesUnder(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const item = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...(await filesUnder(item)));
		else if (/\.(ts|tsx)$/.test(entry.name)) files.push(item);
	}
	return files;
}

describe("session import architecture boundary", () => {
	it("keeps private harness schemas and storage paths out of plugin src", async () => {
		const sources = await filesUnder(join(root, "src"));
		const content = (
			await Promise.all(sources.map((file) => readFile(file, "utf8")))
		).join("\n");
		for (const privateMarker of [
			"parentUuid",
			"context.append_loop_event",
			"custom_tool_call_output",
			"/.claude/projects",
			"/.codex/sessions",
		]) {
			expect(content).not.toContain(privateMarker);
		}
	});

	it("keeps project routing and formal storage writes out of converter", async () => {
		const converter = await readFile(
			join(
				root,
				"skills/harness-session-importer/scripts/importer.py",
			),
			"utf8",
		);
		for (const forbidden of [
			"folderbridge",
			"PJ_",
			"session_index.jsonl",
			"import-receipt.json",
		]) {
			expect(converter).not.toContain(forbidden);
		}
	});
});
