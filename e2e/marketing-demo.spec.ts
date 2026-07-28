import { browser } from "@wdio/globals";
import { writeFileSync, rmSync } from "node:fs";
import path from "node:path";

/**
 * Marketing demo walkthrough — focused "script".
 *
 * Shows the cockpit story only:
 *   1. Session Manager (browse sessions by project)
 *   2. Open a transcript → conversation + turn navigator render
 * No minor features (e.g. theme switching).
 *
 * Timing contract with scripts/record-marketing-demo.sh:
 *   - writes /tmp/harness-demo-ready once the first content (Session Manager)
 *     is on screen → the shell starts `screencapture -v -V9`.
 *   - after the transcript content, holds a trailing pause longer than the
 *     recording window so Obsidian is still open when recording stops — the
 *     close happens after capture ends, never recorded.
 *
 *   npx wdio run wdio.conf.mts --spec e2e/marketing-demo.spec.ts
 */

const READY = "/tmp/harness-demo-ready";
const ARTIFACTS = path.resolve("e2e/artifacts/marketing");

const ASSISTANT_TEXT = [
	"Run the **Session Importer** skill against the native session file. It writes a `.session` entry plus the transcript into your vault and prints a wikilink you can click.",
	"",
	"Supported sources:",
	"",
	"- **Claude Code** — `~/.claude/projects/<dir>/<uuid>.jsonl`",
	"- **Codex** — `~/.codex/sessions/.../rollout-*.jsonl`",
	"- **Pi Agent** — `~/.pi/agent/sessions/<dir>/*.jsonl`",
	"- **Kimi Code** — `~/.kimi-code/sessions/.../session_*/`",
	"",
	"One session at a time, explicitly selected. Re-importing the same source is a no-op. Imported sessions carry an `acpBinding` so you can resume the original conversation when the agent is configured locally.",
].join("\n");

async function fullscreen() {
	await browser.execute(() => {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { remote } = require("electron") as {
			remote: {
				getCurrentWindow(): {
					setFullScreen(flag: boolean): void;
					isFullScreen(): boolean;
				};
			};
		};
		const win = remote.getCurrentWindow();
		if (!win.isFullScreen()) win.setFullScreen(true);
	});
	await browser.pause(800);
}

async function materializeFixture() {
	await browser.execute(async (assistantText) => {
		const app = (window as any).app;
		const plugin = app.plugins.plugins["obsidian-harness"];
		if (!app.vault.getAbstractFileByPath("Sessions")) await app.vault.createFolder("Sessions");
		const old = app.vault.getAbstractFileByPath("Sessions/offline-fixture.session");
		if (old) await app.vault.delete(old);
		await app.vault.create(
			"Sessions/offline-fixture.session",
			JSON.stringify({
				version: 2, entryId: "offline-entry", historyId: "offline-history",
				agentId: "", title: "Importing a Claude Code session", cwd: "/Users/vlln/projects/harness-demo",
				createdAt: "2026-07-27T09:00:00.000Z", updatedAt: "2026-07-27T09:02:04.000Z", forkedFrom: null,
			}),
		);
		await plugin.settingsService.initializeTranscript("offline-history", {
			agentId: "", cwd: "/Users/vlln/projects/harness-demo",
			title: "Importing a Claude Code session", createdAt: "2026-07-27T09:00:00.000Z",
		});
		const base = `${app.vault.configDir}/plugins/obsidian-harness/sessions/offline-history`;
		await app.vault.adapter.write(
			`${base}/turns.jsonl`,
			`${JSON.stringify({
				schemaVersion: 2, turnId: "offline-turn",
				startedAt: "2026-07-27T09:00:00.000Z", endedAt: "2026-07-27T09:01:00.000Z",
				status: "completed",
				prompt: [{ type: "text", text: "How do I import a Claude Code session into my vault?" }],
				items: [{ type: "assistant_message", itemId: "offline-item", text: assistantText }],
				stopReason: "end_turn",
			})}\n`,
		);
	}, ASSISTANT_TEXT);
	await browser.pause(300);
}

async function cleanupFixture() {
	await browser.execute(async () => {
		const app = (window as any).app;
		const plugin = app.plugins.plugins["obsidian-harness"];
		const file = app.vault.getAbstractFileByPath("Sessions/offline-fixture.session");
		if (file) await app.vault.delete(file);
		await plugin.settingsService.deleteTranscript("offline-history");
	});
}

async function waitForTranscriptText(needle: string) {
	await browser.waitUntil(async () => {
		const snap = await browser.execute((entryPath: string) => {
			const app = (window as any).app;
			const leaf = app.workspace.getLeavesOfType("harness-session-view").find((c: any) => c.view?.file?.path === entryPath);
			return leaf ? { text: leaf.view.containerEl.innerText as string } : null;
		}, "Sessions/offline-fixture.session");
		return Boolean(snap && snap.text && snap.text.includes(needle));
	}, { timeout: 10000, interval: 200 });
}

describe("marketing demo walkthrough", () => {
	before(async () => {
		rmSync(READY, { force: true });
		await fullscreen();
		await materializeFixture();
	});
	after(async () => {
		rmSync(READY, { force: true });
		await cleanupFixture();
	});

	it("walks the cockpit story for the recorder", async () => {
		// 1) Session Manager — browse sessions by project.
		await browser.execute(() => {
			for (const leaf of (window as any).app.workspace.getLeavesOfType("harness-session-manager")) leaf.detach();
			(window as any).app?.commands?.executeCommandById("obsidian-harness:open-session-manager");
		});
		await browser.pause(2500);

		// Signal the shell recorder to start now (first content is on screen).
		writeFileSync(READY, "1");

		// 2) Open a transcript — conversation + turn navigator render.
		await browser.execute(async () => {
			const app = (window as any).app;
			for (const leaf of app.workspace.getLeavesOfType("harness-session-view")) leaf.detach();
			const file = app.vault.getAbstractFileByPath("Sessions/offline-fixture.session");
			await app.workspace.getLeaf(true).openFile(file);
		});
		await waitForTranscriptText("Session Importer");
		await browser.pause(4000);

		// Trailing hold: keep Obsidian on screen past the -V9 recording window
		// so the recorder stops before Obsidian closes (no closing captured).
		await browser.pause(5000);

		await browser.saveScreenshot(path.join(ARTIFACTS, "demo-poster.png"));
	});
});
