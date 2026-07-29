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

async function readSrc(): Promise<string> {
	const sources = await filesUnder(join(root, "src"));
	return (
		await Promise.all(sources.map((file) => readFile(file, "utf8")))
	).join("\n");
}

describe("AR-012 unified agent config architecture boundary", () => {
	it("AR-012-1: settings.agents is the only agent configuration source", async () => {
		const content = await readSrc();
		for (const forbidden of [
			"settings.claude",
			"settings.codex",
			"settings.gemini",
			"settings.customAgents",
			"customAgents:",
			"customAgents.",
			"BaseAgentSettings",
			"ClaudeAgentSettings",
			"CodexAgentSettings",
			"GeminiAgentSettings",
			"CustomAgentSettings",
		]) {
			expect(content).not.toContain(forbidden);
		}
	});

	it("AR-012-3: key injection never branches on agentId", async () => {
		const helpers = await readFile(
			join(root, "src/services/session-helpers.ts"),
			"utf8",
		);
		for (const forbidden of [
			"agentId ===",
			"ANTHROPIC_API_KEY",
			"OPENAI_API_KEY",
			"GEMINI_API_KEY",
		]) {
			expect(helpers).not.toContain(forbidden);
		}
	});

	it("AR-012-4: no per-backend auto-discovery special cases", async () => {
		const content = await readSrc();
		for (const forbidden of [
			"isPiAcpAvailable",
			"getDiscoveredAgents",
			'".pi"',
		]) {
			expect(content).not.toContain(forbidden);
		}
	});

	it("AR-012-5: no migration code for legacy schema fields", async () => {
		const content = await readSrc();
		for (const forbidden of [
			"migrateLegacyApiKey",
			"migrateOldFallbackKeychainId",
			"migratedSecrets",
			"claudeCodeAcpCommandPath",
			"geminiCommandPath",
			"activeAgentId",
		]) {
			expect(content).not.toContain(forbidden);
		}
	});
});
