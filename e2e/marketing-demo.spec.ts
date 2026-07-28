import { browser } from "@wdio/globals";
import { writeFileSync, rmSync } from "node:fs";
import path from "node:path";

/**
 * Paced walkthrough for the marketing demo video.
 *
 * Drives the headed Obsidian: opens a transcript (real conversation), waits
 * for it to render, signals the shell recorder via /tmp/harness-demo-ready,
 * then performs a slow light→dark→light theme walk so the recorder captures
 * ~12s of content. Reuses the offline-transcript fixture pattern.
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

async function setWindowSize(w: number, h: number) {
	await browser.execute((width, height) => {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { remote } = require("electron") as {
			remote: { getCurrentWindow(): { setSize(width: number, height: number): void } };
		};
		remote.getCurrentWindow().setSize(width, height);
	}, w, h);
	await browser.pause(400);
}

async function setTheme(theme: "light" | "dark") {
	await browser.execute((t) => {
		document.body.classList.toggle("theme-dark", t === "dark");
		document.body.classList.toggle("theme-light", t === "light");
	}, theme);
	await browser.pause(400);
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
				agentId: "", title: "Offline fixture", cwd: "/missing/offline/project",
				createdAt: "2026-07-20T00:00:00.000Z", updatedAt: "2026-07-20T00:01:00.000Z", forkedFrom: null,
			}),
		);
		await plugin.settingsService.initializeTranscript("offline-history", {
			agentId: "", cwd: "/missing/offline/project", title: "Offline fixture", createdAt: "2026-07-20T00:00:00.000Z",
		});
		const base = `${app.vault.configDir}/plugins/obsidian-harness/sessions/offline-history`;
		await app.vault.adapter.write(
			`${base}/turns.jsonl`,
			`${JSON.stringify({
				schemaVersion: 2, turnId: "offline-turn",
				startedAt: "2026-07-20T00:00:00.000Z", endedAt: "2026-07-20T00:01:00.000Z",
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
		await setWindowSize(1200, 820);
		await materializeFixture();
	});
	after(async () => {
		rmSync(READY, { force: true });
		await cleanupFixture();
	});

	it("walks the transcript for the recorder", async () => {
		// open transcript
		await browser.execute(async () => {
			const app = (window as any).app;
			for (const leaf of app.workspace.getLeavesOfType("harness-session-view")) leaf.detach();
			const file = app.vault.getAbstractFileByPath("Sessions/offline-fixture.session");
			await app.workspace.getLeaf(true).openFile(file);
		});
		await waitForTranscriptText("Session Importer");
		// signal the shell recorder to start now
		writeFileSync(READY, "1");
		// paced walkthrough (~12s)
		await setTheme("light");
		await browser.pause(3500);
		await setTheme("dark");
		await browser.pause(3500);
		await setTheme("light");
		await browser.pause(3000);
		// keep a still frame too
		await browser.saveScreenshot(path.join(ARTIFACTS, "demo-poster-light.png"));
	});
});
