import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface OfflineTranscriptFixture {
	entryId: string;
	historyId: string;
	entryPath: string;
	historyDir: string;
}

export async function materializeOfflineTranscriptFixture(
	vaultPath: string,
): Promise<OfflineTranscriptFixture> {
	const entryId = "11111111-1111-4111-8111-111111111111";
	const historyId = "22222222-2222-4222-8222-222222222222";
	const entryPath = path.join(
		vaultPath,
		"Sessions",
		"offline-fixture.session",
	);
	const historyDir = path.join(
		vaultPath,
		".obsidian",
		"plugins",
		"obsidian-harness",
		"sessions",
		historyId,
	);

	await mkdir(path.dirname(entryPath), { recursive: true });
	await mkdir(historyDir, { recursive: true });
	await writeFile(
		entryPath,
		JSON.stringify(
			{
				version: 2,
				entryId,
				historyId,
				title: "Offline fixture",
				cwd: "/missing/offline/project",
				createdAt: "2026-07-20T00:00:00.000Z",
				updatedAt: "2026-07-20T00:01:00.000Z",
			},
			null,
			2,
		),
	);
	await writeFile(
		path.join(historyDir, "manifest.json"),
		JSON.stringify({
			version: 2,
			historyId,
			createdAt: "2026-07-20T00:00:00.000Z",
			updatedAt: "2026-07-20T00:01:00.000Z",
		}),
	);
	await writeFile(
		path.join(historyDir, "turns.jsonl"),
		`${JSON.stringify({
			version: 2,
			turnId: "33333333-3333-4333-8333-333333333333",
			startedAt: "2026-07-20T00:00:00.000Z",
			endedAt: "2026-07-20T00:01:00.000Z",
			status: "completed",
			prompt: [{ type: "text", text: "Offline prompt" }],
			items: [
				{
					id: "item-1",
					type: "assistant_message",
					text: "Offline answer",
				},
			],
			stopReason: "end_turn",
		})}\n`,
	);

	return { entryId, historyId, entryPath, historyDir };
}

export async function removeOfflineTranscriptFixture(
	fixture: OfflineTranscriptFixture,
): Promise<void> {
	await rm(fixture.entryPath, { force: true });
	await rm(fixture.historyDir, { recursive: true, force: true });
}
