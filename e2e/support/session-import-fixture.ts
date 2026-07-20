import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { browser } from "@wdio/globals";

export interface SessionImportFixture {
	descriptorPath: string;
	bundleDirectory: string;
}

export interface SessionImportWorkspaceSnapshot {
	text: string;
	hasConfirmAction: boolean;
	hasAgentInput: boolean;
}

const IMPORT_ID = "aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa";
const ENTRY_ID = "bbbbbbbb-bbbb-5bbb-8bbb-bbbbbbbbbbbb";
const HISTORY_ID = "cccccccc-cccc-5ccc-8ccc-cccccccccccc";

function sha256(content: string): string {
	return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Creates a source-agnostic bundle without invoking production import code. */
export async function materializeSessionImportFixture(
	vaultPath: string,
): Promise<SessionImportFixture> {
	const descriptorPath = path.join(
		vaultPath,
		"Sessions",
		`session-import-${IMPORT_ID}.harness-import`,
	);
	const bundleDirectory = `${descriptorPath}.bundle`;
	await mkdir(path.join(bundleDirectory, "blobs"), { recursive: true });

	const turns = `${JSON.stringify({
		schemaVersion: 2,
		turnId: "dddddddd-dddd-5ddd-8ddd-dddddddddddd",
		status: "completed",
		startedAt: "2026-07-20T00:00:00.000Z",
		endedAt: "2026-07-20T00:00:01.000Z",
		prompt: [{ type: "text", text: "Imported fixture prompt" }],
		items: [
			{
				type: "assistant_message",
				itemId: "fixture-message",
				text: "Imported fixture answer",
			},
		],
		stopReason: "end_turn",
	})}\n`;
	const report = JSON.stringify(
		{
			schemaVersion: 1,
			converterVersion: "fixture",
			source: {
				kind: "fixture",
				identity: "fixture-session",
				branchIdentity: null,
				digest: "1".repeat(64),
				files: [],
			},
			metadata: {
				title: "Import fixture",
				cwd: "/fixture/project",
				createdAt: "2026-07-20T00:00:00.000Z",
			},
			input: { records: 2, recordTypes: { fixture: 2 } },
			output: {
				turns: 1,
				prompts: 1,
				assistantMessages: 1,
				thoughts: 0,
				toolCalls: 0,
				toolResults: 0,
				blobs: 0,
			},
			diagnostics: [],
			complete: true,
			branches: [],
			candidate: {
				importId: IMPORT_ID,
				entryId: ENTRY_ID,
				historyId: HISTORY_ID,
				entryFile: `Sessions/session-${ENTRY_ID}.session`,
			},
			result: { status: "bundle_created", descriptor: null },
		},
		null,
		2,
	);
	const manifest = JSON.stringify(
		{
			schemaVersion: 1,
			importId: IMPORT_ID,
			sourceKind: "fixture",
			sourceIdentity: "fixture-session",
			branchIdentity: null,
			sourceDigest: "1".repeat(64),
			conversionDigest: "2".repeat(64),
			converterVersion: "fixture",
			createdAt: "2026-07-20T00:00:00.000Z",
			target: {
				entryDir: "Sessions",
				title: "Import fixture",
				cwd: "/fixture/project",
			},
			transcript: {
				schemaVersion: 2,
				turnsPath: "turns.jsonl",
				blobsPath: "blobs",
			},
			reportPath: "report.json",
		},
		null,
		2,
	);

	await Promise.all([
		writeFile(path.join(bundleDirectory, "turns.jsonl"), turns),
		writeFile(path.join(bundleDirectory, "report.json"), report),
		writeFile(path.join(bundleDirectory, "manifest.json"), manifest),
	]);
	await writeFile(
		descriptorPath,
		JSON.stringify(
			{
				schemaVersion: 1,
				bundlePath: `Sessions/${path.basename(bundleDirectory)}`,
				manifestSha256: sha256(manifest),
			},
			null,
			2,
		),
	);
	return { descriptorPath, bundleDirectory };
}

export async function removeSessionImportFixture(
	fixture: SessionImportFixture,
): Promise<void> {
	await rm(fixture.descriptorPath, { force: true });
	await rm(fixture.bundleDirectory, { recursive: true, force: true });
}

export async function getInitializedAgentCount(): Promise<number> {
	return browser.execute(() => {
		const plugin = (window as any).app?.plugins?.plugins?.[
			"obsidian-harness"
		];
		return [...(plugin?._acpClients?.values() ?? [])].filter(
			(client: any) => client.isInitialized(),
		).length;
	});
}

export async function getSessionImportWorkspaceSnapshot(
	descriptorPath: string,
): Promise<SessionImportWorkspaceSnapshot | null> {
	return browser.execute((targetPath) => {
		const app = (window as any).app;
		const leaf = app?.workspace
			?.getLeavesOfType("harness-session-import-view")
			.find((candidate: any) => candidate.view.file?.path === targetPath);
		if (!leaf) return null;
		return {
			text: leaf.view.containerEl.innerText as string,
			hasConfirmAction: Boolean(
				leaf.view.containerEl.querySelector(
					".harness-session-import-confirm",
				),
			),
			hasAgentInput: Boolean(
				leaf.view.containerEl.querySelector(
					".agent-client-chat-input-container",
				),
			),
		};
	}, descriptorPath);
}
