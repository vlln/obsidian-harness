import { browser } from "@wdio/globals";
import { mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Marketing screenshots for the docs site.
 *
 * Reuses the headed wdio-obsidian harness (real Obsidian Electron window).
 * The transcript fixture mirrors e2e/offline-transcript.spec.ts verbatim
 * (app.vault.create + settingsService.initializeTranscript + adapter.write
 * of turns.jsonl) — the proven path that renders real content.
 *
 *   npx wdio run wdio.conf.mts --spec e2e/marketing-shots.spec.ts
 */

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

async function setWindowSize(width: number, height: number): Promise<void> {
	await browser.execute((w, h) => {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { remote } = require("electron") as {
			remote: {
				getCurrentWindow(): { setSize(width: number, height: number): void };
			};
		};
		remote.getCurrentWindow().setSize(w, h);
	}, width, height);
	await browser.pause(400);
}

async function setTheme(theme: "light" | "dark"): Promise<void> {
	await browser.execute((nextTheme) => {
		document.body.classList.toggle("theme-dark", nextTheme === "dark");
		document.body.classList.toggle("theme-light", nextTheme === "light");
	}, theme);
	await browser.pause(350);
}

async function closeAllViews(): Promise<void> {
	await browser.execute(() => {
		const app = (window as any).app;
		for (const type of [
			"harness-chat-view",
			"harness-session-manager",
			"harness-session-view",
		]) {
			for (const leaf of app.workspace.getLeavesOfType(type)) {
				leaf.detach();
			}
		}
	});
	await browser.pause(200);
}

async function materializeFixture(): Promise<void> {
	await browser.execute(async (assistantText) => {
		const app = (window as any).app;
		const plugin = app.plugins.plugins["obsidian-harness"];
		if (!app.vault.getAbstractFileByPath("Sessions")) {
			await app.vault.createFolder("Sessions");
		}
		const old = app.vault.getAbstractFileByPath(
			"Sessions/offline-fixture.session",
		);
		if (old) await app.vault.delete(old);
		await app.vault.create(
			"Sessions/offline-fixture.session",
			JSON.stringify({
				version: 2,
				entryId: "offline-entry",
				historyId: "offline-history",
				agentId: "",
				title: "Offline fixture",
				cwd: "/missing/offline/project",
				createdAt: "2026-07-20T00:00:00.000Z",
				updatedAt: "2026-07-20T00:01:00.000Z",
				forkedFrom: null,
			}),
		);
		await plugin.settingsService.initializeTranscript("offline-history", {
			agentId: "",
			cwd: "/missing/offline/project",
			title: "Offline fixture",
			createdAt: "2026-07-20T00:00:00.000Z",
		});
		const base = `${app.vault.configDir}/plugins/obsidian-harness/sessions/offline-history`;
		await app.vault.adapter.write(
			`${base}/turns.jsonl`,
			`${JSON.stringify({
				schemaVersion: 2,
				turnId: "offline-turn",
				startedAt: "2026-07-20T00:00:00.000Z",
				endedAt: "2026-07-20T00:01:00.000Z",
				status: "completed",
				prompt: [
					{ type: "text", text: "How do I import a Claude Code session into my vault?" },
				],
				items: [
					{
						type: "assistant_message",
						itemId: "offline-item",
						text: assistantText,
					},
				],
				stopReason: "end_turn",
			})}\n`,
		);
	}, ASSISTANT_TEXT);
	await browser.pause(300);
}

async function cleanupFixture(): Promise<void> {
	await browser.execute(async () => {
		const app = (window as any).app;
		const plugin = app.plugins.plugins["obsidian-harness"];
		const file = app.vault.getAbstractFileByPath(
			"Sessions/offline-fixture.session",
		);
		if (file) await app.vault.delete(file);
		await plugin.settingsService.deleteTranscript("offline-history");
	});
}

async function waitForTranscriptText(needle: string): Promise<void> {
	await browser.waitUntil(
		async () => {
			const snap = await browser.execute((entryPath) => {
				const app = (window as any).app;
				const leaf = app.workspace
					.getLeavesOfType("harness-session-view")
					.find((c: any) => c.view?.file?.path === entryPath);
				return leaf
					? { text: leaf.view.containerEl.innerText as string }
					: null;
			}, "Sessions/offline-fixture.session");
			return Boolean(snap && snap.text && snap.text.includes(needle));
		},
		{ timeout: 8000, interval: 200 },
	);
}

describe("marketing screenshots", () => {
	before(async () => {
		await mkdir(ARTIFACTS, { recursive: true });
		await setWindowSize(1200, 820);
		await materializeFixture();
	});

	after(async () => {
		await cleanupFixture();
	});

	it("captures a transcript view (light + dark)", async () => {
		await closeAllViews();
		await setTheme("light");
		await browser.execute(async () => {
			const app = (window as any).app;
			const file = app.vault.getAbstractFileByPath(
				"Sessions/offline-fixture.session",
			);
			await app.workspace.getLeaf(true).openFile(file);
		});
		await waitForTranscriptText("Session Importer");
		await browser.pause(600);
		await browser.saveScreenshot(
			path.join(ARTIFACTS, "transcript-light.png"),
		);
		await setTheme("dark");
		await browser.pause(500);
		await browser.saveScreenshot(
			path.join(ARTIFACTS, "transcript-dark.png"),
		);
	});

	it("captures the session manager (light)", async () => {
		await closeAllViews();
		await setTheme("light");
		await browser.execute(() => {
			(window as any).app?.commands?.executeCommandById(
				"obsidian-harness:open-session-manager",
			);
		});
		await browser.pause(2000);
		await browser.saveScreenshot(
			path.join(ARTIFACTS, "session-manager-light.png"),
		);
	});

	it("captures the chat view (light)", async () => {
		await closeAllViews();
		await setTheme("light");
		await browser.execute(() => {
			(window as any).app?.commands?.executeCommandById(
				"obsidian-harness:open-chat-view",
			);
		});
		await browser.pause(1500);
		await browser.saveScreenshot(path.join(ARTIFACTS, "chat-view-light.png"));
	});

	it("captures the floating chat (light)", async () => {
		await closeAllViews();
		await setTheme("light");
		await browser.execute(() => {
			const plugin = (window as any).app?.plugins?.plugins?.[
				"obsidian-harness"
			];
			plugin?.openNewFloatingChat(true);
		});
		await browser.pause(1500);
		await browser.saveScreenshot(
			path.join(ARTIFACTS, "floating-chat-light.png"),
		);
	});
});
