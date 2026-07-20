import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const script = fileURLToPath(
	new URL("../scripts/check-session-import-fixtures.mjs", import.meta.url),
);
const temporaryDirectories: string[] = [];

async function fixtureDirectory(): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), "harness-fixtures-"));
	temporaryDirectories.push(directory);
	return directory;
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) =>
				rm(directory, { recursive: true, force: true }),
			),
	);
});

describe("session import fixture lint", () => {
	it("accepts sanitized fixture content", async () => {
		const directory = await fixtureDirectory();
		await writeFile(
			join(directory, "session.jsonl"),
			'{"cwd":"/fixture/project"}\n',
		);
		const result = spawnSync(process.execPath, [script, directory], {
			encoding: "utf8",
		});
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("[fixture-lint] PASS");
	});

	it("rejects home paths and token-shaped secrets", async () => {
		const directory = await fixtureDirectory();
		await mkdir(join(directory, "nested"));
		await writeFile(
			join(directory, "nested", "session.jsonl"),
			'{"cwd":"/Users/example/private","token":"sk-abcdefghijklmnop"}\n',
		);
		const result = spawnSync(process.execPath, [script, directory], {
			encoding: "utf8",
		});
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("[fixture-lint]");
	});
});
