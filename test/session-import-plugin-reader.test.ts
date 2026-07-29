/* eslint-disable obsidianmd/hardcoded-config-path -- This test builds a real on-disk vault to feed the Python importer, which writes fixed `.obsidian` plugin-relative paths; the literal is intentional test scaffolding, not plugin runtime code. */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { deriveContinuationState } from "../src/services/session-continuation";
import { parseSessionFileData } from "../src/services/session-entry";
import { SessionStorage } from "../src/services/session-storage";
import { NodeDataAdapter } from "./support/node-data-adapter";

const skillRoot = fileURLToPath(
	new URL("../skills/harness-session-importer", import.meta.url),
);
const importScript = join(skillRoot, "scripts", "import_session.py");
const fixtures = join(skillRoot, "tests", "fixtures");
const sessionsDir = ".obsidian/plugins/obsidian-harness/sessions";

// This suite drives the real importer CLI end-to-end: native-format session →
// ahs-export (via the external harness-adapter repo) → AHS → Obsidian session.
// It needs (a) the native fixtures that were removed during the in-progress
// importer rewrite, and (b) a local harness-adapter checkout passed via
// HARNESS_ADAPTER_PATH. When either is absent the suite skips rather than
// fail, so CI stays green without faking coverage. Restore the fixtures and
// point HARNESS_ADAPTER_PATH at a harness-adapter checkout to re-enable.
const adapterPath = process.env.HARNESS_ADAPTER_PATH ?? "";
const nativeFixturesPresent =
	existsSync(join(fixtures, "claude", "session.jsonl")) &&
	existsSync(join(fixtures, "codex", "session.jsonl")) &&
	existsSync(join(fixtures, "pi", "session.jsonl")) &&
	existsSync(join(fixtures, "kimi"));
const canRunImporter = nativeFixturesPresent && adapterPath.length > 0;
const runner = canRunImporter ? describe : describe.skip;

const temporaryDirectories: string[] = [];

interface ImportResult {
	status: string;
	entryId: string;
	historyId: string;
	entryFile: string;
	turns: number;
}

async function vaultDirectory(): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), "harness-vault-"));
	temporaryDirectories.push(directory);
	await mkdir(join(directory, ".obsidian"), { recursive: true });
	return directory;
}

function runImport(
	vault: string,
	harness: string,
	source: string,
	branch?: string,
): ImportResult {
	const args = [
		importScript,
		"--harness",
		harness,
		"--session",
		source,
		"--vault",
		vault,
		"--entry-dir",
		"Sessions",
		"--adapter",
		adapterPath,
	];
	if (branch) args.push("--branch", branch);
	const result = spawnSync("python3", args, { encoding: "utf8" });
	expect(result.status, result.stderr).toBe(0);
	return JSON.parse(result.stdout) as ImportResult;
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

runner("importer produces sessions the plugin reader consumes", () => {
	const cases: Array<{
		harness: string;
		source: string;
		branch?: string;
		agentId: string;
	}> = [
		{
			harness: "claude",
			source: join(fixtures, "claude/session.jsonl"),
			branch: "c-main-leaf",
			agentId: "claude-code-acp",
		},
		{
			harness: "pi",
			source: join(fixtures, "pi/session.jsonl"),
			branch: "p-main-leaf",
			agentId: "pi-acp",
		},
		{
			harness: "codex",
			source: join(fixtures, "codex/session.jsonl"),
			agentId: "codex-acp",
		},
		{ harness: "kimi", source: join(fixtures, "kimi"), agentId: "kimi-acp" },
	];

	for (const { harness, source, branch, agentId } of cases) {
		it(`${harness}: plugin reads the imported entry and continuation binding`, async () => {
			const vault = await vaultDirectory();
			const result = runImport(vault, harness, source, branch);
			expect(result.status).toBe("created");
			expect(result.turns).toBeGreaterThan(0);

			const adapter = new NodeDataAdapter(vault);

			const entry = parseSessionFileData(
				await adapter.read(result.entryFile),
			);
			expect(entry.entryId).toBe(result.entryId);
			expect(entry.historyId).toBe(result.historyId);
			expect(entry.agentId).toBe(agentId);
			expect(entry.acpBinding?.agentId).toBe(agentId);
			expect(entry.acpBinding?.sessionId).toBeTruthy();

			// The binding must make the imported session continuable, not
			// read_only. With the agent configured and cwd present the plugin
			// derives an "available" continuation that drives session/load.
			expect(
				deriveContinuationState({
					entry,
					agentConfigured: true,
					cwdAvailable: true,
				}),
			).toEqual({ type: "available" });

			const storage = new SessionStorage({ adapter, sessionsDir });
			const transcript = await storage.readTranscript(result.historyId);
			expect(transcript.warnings).toEqual([]);
			expect(transcript.manifest?.historyId).toBe(result.historyId);
			expect(transcript.turns).toHaveLength(result.turns);
			expect(
				transcript.turns.every((turn) => turn.schemaVersion === 2),
			).toBe(true);
		});
	}

	it("re-running the same import is idempotent for the reader", async () => {
		const vault = await vaultDirectory();
		const source = join(fixtures, "codex/session.jsonl");
		const first = runImport(vault, "codex", source);
		const second = runImport(vault, "codex", source);
		expect(second.status).toBe("already_exists");
		expect(second.historyId).toBe(first.historyId);

		const adapter = new NodeDataAdapter(vault);
		const storage = new SessionStorage({ adapter, sessionsDir });
		const transcript = await storage.readTranscript(first.historyId);
		expect(transcript.warnings).toEqual([]);
		expect(transcript.turns).toHaveLength(first.turns);
	});
});
