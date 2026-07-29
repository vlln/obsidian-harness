import { browser } from "@wdio/globals";
import { writeFileSync, rmSync } from "node:fs";
import path from "node:path";

/**
 * Marketing demo walkthrough — focused 9-second "剧本" (script).
 *
 * Fills the entire screencapture -V9 window with continuous Obsidian
 * interaction so the recording never drifts to other windows during an
 * idle tail:
 *
 *   0.0–2.5s  Session Manager — sessions grouped under two projects.
 *   2.5–3.5s  Open the long .session transcript (vault-file sessions).
 *   3.5–6.0s  Transcript renders; scroll DOWN through the 8-turn
 *             conversation so multiple turns are visible.
 *   6.0–8.0s  Turn Navigator — click a non-active turn node to jump.
 *   8.0–9.5s  Hold on the jumped-to turn; Obsidian stays foregrounded
 *             past the 9s capture cutoff (no idle trailing tail).
 *
 * No theme toggling (minor, non-highlight).
 *
 * Timing contract with scripts/record-marketing-demo.sh:
 *   - writes /tmp/harness-demo-ready AFTER the Session Manager's first
 *     content frame is on screen → the shell starts `screencapture -v -V9`.
 *   - the `it` body runs continuously from ready-signal to ~9.5s so
 *     Obsidian is foregrounded for the entire recording window.
 *
 *   npx wdio run wdio.conf.mts --spec e2e/marketing-demo.spec.ts
 */

const READY = "/tmp/harness-demo-ready";
const ARTIFACTS = path.resolve("e2e/artifacts/marketing");

// --- Fixture: two projects, one long 8-turn conversation -----------

const ALPHA_LONG_ENTRY = "Sessions/marketing-alpha-long.session";
const ALPHA_SHORT_ENTRY = "Sessions/marketing-alpha-short.session";
const BETA_ENTRY = "Sessions/marketing-beta.session";

const ALPHA_LONG_HISTORY = "marketing-alpha-long-history";
const ALPHA_SHORT_HISTORY = "marketing-alpha-short-history";
const BETA_HISTORY = "marketing-beta-history";

const ALPHA_CWD = "/Users/vlln/projects/harness-alpha";
const BETA_CWD = "/Users/vlln/projects/harness-beta";

const LONG_BINDING_SESSION = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

interface TurnPair {
	prompt: string;
	answer: string;
}

const CONVERSATION: TurnPair[] = [
	{
		prompt:
			"How do I import a Claude Code session into my vault with the Session Importer skill?",
		answer: [
			"Run the **Session Importer** skill against the native session file. It writes a `.session` entry plus the transcript into your vault and prints a wikilink you can click.",
			"",
			"Supported sources:",
			"",
			"- **Claude Code** — `~/.claude/projects/<dir>/<uuid>.jsonl`",
			"- **Codex** — `~/.codex/sessions/.../rollout-*.jsonl`",
			"- **Pi Agent** — `~/.pi/agent/sessions/<dir>/*.jsonl`",
			"- **Kimi Code** — `~/.kimi-code/sessions/.../session_*/`",
			"",
			"One session at a time, explicitly selected. Re-importing the same source is a no-op.",
		].join("\n"),
	},
	{
		prompt: "What does the imported .session file contain?",
		answer: [
			"Each `.session` file is a v2 manifest with:",
			"",
			"- `entryId`, `historyId`, `agentId`",
			"- `title`, `cwd`, `createdAt`, `updatedAt`",
			"- `acpBinding` — `{ agentId, sessionId }` linking back to the original agent process",
			"",
			"The companion `turns.jsonl` lives under `sessions/<historyId>/` in the plugin config dir.",
		].join("\n"),
	},
	{
		prompt: "Can I resume the original conversation after importing?",
		answer: [
			"Yes — if the binding agent is configured locally, the transcript view shows a **Ready to continue** indicator.",
			"",
			"Clicking it calls `resumeSession` with the opaque `acpBinding.sessionId`. If the agent is unavailable, the history stays read-only and a `Backend unavailable` banner appears.",
			"",
			"No new session is ever created on resume — the opaque binding is restored as-is.",
		].join("\n"),
	},
	{
		prompt: "How does the Turn Navigator help with long conversations?",
		answer: [
			"The **Turn Navigator** renders a vertical rail of turn nodes alongside the message list. Each node is labeled `Turn N: <first prompt line>`.",
			"",
			"Clicking a non-active node smooth-scrolls the message viewport to that turn and marks the node `aria-current=\"step\"`. The rail itself auto-follows the active turn during manual scroll.",
			"",
			"On narrow viewports (<520px) the rail collapses to reclaim space for messages.",
		].join("\n"),
	},
	{
		prompt: "How are sessions grouped in the Session Manager?",
		answer: [
			"The Session Manager groups sessions by **project** (the `cwd` field). Each project row is collapsible.",
			"",
			"A **Recents** section shows the most recently updated sessions across all projects. A search box flattens both into a single filtered list.",
			"",
			"Status slots (busy/idle/error) are rendered per session row with fixed-width geometry.",
		].join("\n"),
	},
	{
		prompt: "What happens when I fork a session?",
		answer: [
			"Forking copies the `historyId` transcript to a new `historyId` and sets `forkedFrom` on the new `.session` entry.",
			"",
			"The fork starts read-only; you can resume it independently under a different agent. The original session is untouched.",
		].join("\n"),
	},
	{
		prompt: "How does the plugin isolate the ACP SDK?",
		answer: [
			"All `@agentclientprotocol/sdk` imports are confined to the `acp/` directory. `AcpClient` owns the process lifecycle (spawn → initialize → newSession → sendPrompt → cancel → disconnect).",
			"",
			"`AcpHandler` receives SDK events, filters by `currentSessionId`, converts ACP types to domain types, and broadcasts through a single `onSessionUpdate` channel.",
			"",
			"Services in `services/` have zero React imports — they are pure functions and classes consumed by hooks.",
		].join("\n"),
	},
	{
		prompt: "What is the single-event-channel philosophy?",
		answer: [
			"All agent events — message chunks, tool calls, plan updates, usage, config options — flow through one `onSessionUpdate` subscription.",
			"",
			"`useAgent` is the facade hook: it composes `useAgentSession` (session-level) and `useAgentMessages` (message-level) behind a single subscription, memoized for return stability.",
			"",
			"This keeps the React tree quiet: one listener, one re-entry point, RAF-batched streaming updates.",
		].join("\n"),
	},
];

// --- Helpers -------------------------------------------------------

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
	await browser.execute(
		async (
			alphaLongPath: string,
			alphaShortPath: string,
			betaPath: string,
			alphaLongHistory: string,
			alphaShortHistory: string,
			betaHistory: string,
			alphaCwd: string,
			betaCwd: string,
			bindingSession: string,
			conversation: TurnPair[],
		) => {
			const app = (window as any).app;
			const plugin = app.plugins.plugins["obsidian-harness"];

			if (!app.vault.getAbstractFileByPath("Sessions"))
				await app.vault.createFolder("Sessions");

			// Clean any stale fixture files + transcripts.
			for (const entryPath of [alphaLongPath, alphaShortPath, betaPath]) {
				const old = app.vault.getAbstractFileByPath(entryPath);
				if (old) await app.vault.delete(old, true);
			}
			for (const transcriptId of [
				alphaLongHistory,
				alphaShortHistory,
				betaHistory,
			]) {
				await plugin.settingsService.deleteTranscript(transcriptId);
			}

			const createdAt = "2026-07-27T09:00:00.000Z";

			// --- Project harness-alpha: long 8-turn conversation ----------
			const alphaLongEntry = {
				version: 2,
				entryId: "marketing-alpha-long",
				historyId: alphaLongHistory,
				agentId: "claude-code-acp",
				acpBinding: {
					agentId: "claude-code-acp",
					sessionId: bindingSession,
				},
				title: "Importing & navigating Claude Code sessions",
				cwd: alphaCwd,
				createdAt,
				updatedAt: "2026-07-27T09:12:00.000Z",
				forkedFrom: null,
			};
			await app.vault.create(
				alphaLongPath,
				JSON.stringify(alphaLongEntry, null, 2),
			);
			await plugin.settingsService.initializeTranscript(
				alphaLongHistory,
				{
					agentId: "claude-code-acp",
					cwd: alphaCwd,
					title: alphaLongEntry.title,
					createdAt,
				},
			);
			const alphaLongTurns = conversation.map((turn, index) =>
				JSON.stringify({
					schemaVersion: 2,
					turnId: `marketing-long-turn-${index + 1}`,
					startedAt: `2026-07-27T09:0${index}:00.000Z`,
					endedAt: `2026-07-27T09:0${index}:45.000Z`,
					status: "completed",
					prompt: [{ type: "text", text: turn.prompt }],
					items: [
						{
							type: "assistant_message",
							itemId: `marketing-long-answer-${index + 1}`,
							text: turn.answer,
						},
					],
					stopReason: "end_turn",
				}),
			);
			const alphaLongBase = `${app.vault.configDir}/plugins/obsidian-harness/sessions/${alphaLongHistory}`;
			await app.vault.adapter.write(
				`${alphaLongBase}/turns.jsonl`,
				`${alphaLongTurns.join("\n")}\n`,
			);

			// --- Project harness-alpha: short session ---------------------
			const alphaShortEntry = {
				version: 2,
				entryId: "marketing-alpha-short",
				historyId: alphaShortHistory,
				agentId: "",
				title: "Quick refactoring notes",
				cwd: alphaCwd,
				createdAt: "2026-07-27T10:00:00.000Z",
				updatedAt: "2026-07-27T10:02:00.000Z",
				forkedFrom: null,
			};
			await app.vault.create(
				alphaShortPath,
				JSON.stringify(alphaShortEntry, null, 2),
			);
			await plugin.settingsService.initializeTranscript(
				alphaShortHistory,
				{
					agentId: "",
					cwd: alphaCwd,
					title: alphaShortEntry.title,
					createdAt: "2026-07-27T10:00:00.000Z",
				},
			);
			const alphaShortBase = `${app.vault.configDir}/plugins/obsidian-harness/sessions/${alphaShortHistory}`;
			await app.vault.adapter.write(
				`${alphaShortBase}/turns.jsonl`,
				`${JSON.stringify({
					schemaVersion: 2,
					turnId: "marketing-short-turn-1",
					startedAt: "2026-07-27T10:00:00.000Z",
					endedAt: "2026-07-27T10:01:00.000Z",
					status: "completed",
					prompt: [{ type: "text", text: "Extract a helper for the retry loop." }],
					items: [
						{
							type: "assistant_message",
							itemId: "marketing-short-answer-1",
							text: "Created `retryWithBackoff` in `utils/retry.ts` and replaced the three inline loops.",
						},
					],
					stopReason: "end_turn",
				})}\n`,
			);

			// --- Project harness-beta: short session ----------------------
			const betaEntry = {
				version: 2,
				entryId: "marketing-beta",
				historyId: betaHistory,
				agentId: "codex-acp",
				title: "Beta release checklist",
				cwd: betaCwd,
				createdAt: "2026-07-27T11:00:00.000Z",
				updatedAt: "2026-07-27T11:03:00.000Z",
				forkedFrom: null,
			};
			await app.vault.create(
				betaPath,
				JSON.stringify(betaEntry, null, 2),
			);
			await plugin.settingsService.initializeTranscript(betaHistory, {
				agentId: "codex-acp",
				cwd: betaCwd,
				title: betaEntry.title,
				createdAt: "2026-07-27T11:00:00.000Z",
			});
			const betaBase = `${app.vault.configDir}/plugins/obsidian-harness/sessions/${betaHistory}`;
			await app.vault.adapter.write(
				`${betaBase}/turns.jsonl`,
				`${JSON.stringify({
					schemaVersion: 2,
					turnId: "marketing-beta-turn-1",
					startedAt: "2026-07-27T11:00:00.000Z",
					endedAt: "2026-07-27T11:02:00.000Z",
					status: "completed",
					prompt: [{ type: "text", text: "Generate the v0.6 beta release checklist." }],
					items: [
						{
							type: "assistant_message",
							itemId: "marketing-beta-answer-1",
							text: "1. Bump version to 0.6.0\n2. Update CHANGELOG\n3. Run `npm run gate:mr`\n4. Tag `v0.6.0` and publish release.",
						},
					],
					stopReason: "end_turn",
				})}\n`,
			);

			// Reconcile the session index so the manager lists them.
			await plugin.settingsService.reconcileSessionIndex(
				alphaLongEntry,
				alphaLongPath,
			);
			await plugin.settingsService.reconcileSessionIndex(
				alphaShortEntry,
				alphaShortPath,
			);
			await plugin.settingsService.reconcileSessionIndex(
				betaEntry,
				betaPath,
			);
			await plugin.sessionCatalog.refresh();
		},
		ALPHA_LONG_ENTRY,
		ALPHA_SHORT_ENTRY,
		BETA_ENTRY,
		ALPHA_LONG_HISTORY,
		ALPHA_SHORT_HISTORY,
		BETA_HISTORY,
		ALPHA_CWD,
		BETA_CWD,
		LONG_BINDING_SESSION,
		CONVERSATION,
	);
	await browser.pause(300);
}

async function cleanupFixture() {
	await browser.execute(
		async (
			alphaLongPath: string,
			alphaShortPath: string,
			betaPath: string,
			alphaLongHistory: string,
			alphaShortHistory: string,
			betaHistory: string,
		) => {
			const app = (window as any).app;
			const plugin = app.plugins.plugins["obsidian-harness"];
			for (const entryPath of [alphaLongPath, alphaShortPath, betaPath]) {
				const file = app.vault.getAbstractFileByPath(entryPath);
				if (file) await app.vault.delete(file, true);
			}
			for (const transcriptId of [
				alphaLongHistory,
				alphaShortHistory,
				betaHistory,
			]) {
				await plugin.settingsService.deleteTranscript(transcriptId);
			}
			await plugin.sessionCatalog.refresh();
		},
		ALPHA_LONG_ENTRY,
		ALPHA_SHORT_ENTRY,
		BETA_ENTRY,
		ALPHA_LONG_HISTORY,
		ALPHA_SHORT_HISTORY,
		BETA_HISTORY,
	);
}

/**
 * Waits for the transcript view to render. The chat view auto-scrolls to
 * the bottom, so early turns are virtualized out — search for a needle from
 * a LATE turn (near the bottom) that is guaranteed visible.
 */
async function waitForTranscriptRendered() {
	// "All agent events" appears in the last turn's answer — always visible.
	const NEEDLE = "All agent events";
	await browser.waitUntil(
		async () => {
			const snap = await browser.execute((entryPath: string) => {
				const app = (window as any).app;
				const leaf = app.workspace
					.getLeavesOfType("harness-session-view")
					.find((c: any) => c.view?.file?.path === entryPath);
				return leaf
					? { text: leaf.view.containerEl.innerText as string }
					: null;
			}, ALPHA_LONG_ENTRY);
			return Boolean(snap && snap.text && snap.text.includes(NEEDLE));
		},
		{ timeout: 10000, interval: 200 },
	);
}

/**
 * Waits for the Turn Navigator to render more than one turn node before
 * interacting. Returns the count for logging.
 */
async function waitForTurnNodes(): Promise<number> {
	let count = 0;
	await browser.waitUntil(
		async () => {
			count = await browser.execute(() => {
				const rail = document.querySelector<HTMLElement>(
					".harness-turn-navigator",
				);
				if (!rail) return 0;
				return rail.querySelectorAll(".harness-turn-node").length;
			});
			return count > 1;
		},
		{ timeout: 8000, interval: 100 },
	);
	return count;
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
		// ── 0.0–2.5s: Session Manager — sessions grouped under two projects ──
		await browser.execute(() => {
			for (const leaf of (window as any).app.workspace.getLeavesOfType(
				"harness-session-manager",
			))
				leaf.detach();
			(window as any).app?.commands?.executeCommandById(
				"obsidian-harness:open-session-manager",
			);
		});
		await browser.$(".harness-session-manager").waitForDisplayed();
		// Expand all project rows so the grouped sessions are readable.
		await browser.execute(() => {
			const rows = document.querySelectorAll<HTMLElement>(
				".harness-navigator-project-row[aria-expanded='false']",
			);
			rows.forEach((row) => row.click());
		});
		await browser.pause(1500);

		// Signal the shell recorder to start NOW — first content frame is up.
		writeFileSync(READY, "1");

		// Hold the manager for the remainder of the 0–2.5s beat.
		await browser.pause(1000);

		// ── 2.5–3.5s: open the long .session transcript ──────────────────────
		await browser.execute(async (entryPath: string) => {
			const app = (window as any).app;
			for (const leaf of app.workspace.getLeavesOfType(
				"harness-session-view",
			))
				leaf.detach();
			const file = app.vault.getAbstractFileByPath(entryPath);
			await app.workspace.getLeaf(true).openFile(file);
		}, ALPHA_LONG_ENTRY);
		await waitForTranscriptRendered();

		// ── 3.5–6.0s: scroll DOWN through the long conversation ─────────────
		await browser.execute(() => {
			const viewport = document.querySelector<HTMLElement>(
				".harness-chat-view-messages",
			);
			if (viewport) viewport.scrollTop = 0;
		});
		await browser.pause(400);
		// Smooth incremental scrolls so the motion is visible on camera.
		for (let step = 1; step <= 8; step++) {
			await browser.execute((fraction: number) => {
				const viewport = document.querySelector<HTMLElement>(
					".harness-chat-view-messages",
				);
				if (viewport)
					viewport.scrollTo({
						top: Math.round(viewport.scrollHeight * fraction),
						behavior: "smooth",
					});
			}, step / 8);
			await browser.pause(350);
		}

		// ── 6.0–8.0s: Turn Navigator — click a non-active turn node ────────
		await waitForTurnNodes();
		await browser.execute(() => {
			const nodes = document.querySelectorAll<HTMLElement>(
				".harness-turn-navigator .harness-turn-node",
			);
			// Pick a node near the middle that is NOT the active one.
			const target = Array.from(nodes).find(
				(node) => !node.classList.contains("is-active"),
			);
			if (target) target.click();
		});
		// Let the smooth-jump settle on camera.
		await browser.pause(1800);

		// ── 8.0–10.5s: hold on the jumped-to turn — fill past the 9s cutoff.
		// Keep the frame alive with small smooth scrolls so it is never idle.
		for (const delta of [60, 40, -40, 30]) {
			await browser.execute((d: number) => {
				const viewport = document.querySelector<HTMLElement>(
					".harness-chat-view-messages",
				);
				if (viewport)
					viewport.scrollBy({ top: d, behavior: "smooth" });
			}, delta);
			await browser.pause(600);
		}

		await browser.saveScreenshot(
			path.join(ARTIFACTS, "demo-poster.png"),
		);
	});
});
