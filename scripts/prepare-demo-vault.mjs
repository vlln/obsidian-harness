#!/usr/bin/env node
// Prepares a self-contained demo vault at ./demo-vault (or arg[2]) with the
// Obsidian Harness plugin installed and 3 pre-populated sessions so you can
// open it in Obsidian and screen-record the cockpit story manually:
//   - Session Manager shows three projects (harness-alpha, harness-beta, harness-gamma)
//   - a long 8-turn conversation with an ACP backend binding (acpBinding)
//   - short sessions for project variety
//
// Usage: node scripts/prepare-demo-vault.mjs [target-dir]
// Then in Obsidian: Open folder as vault → <repo>/demo-vault
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const target = path.resolve(process.argv[2] || path.join(repoRoot, "demo-vault"));
const pluginDir = path.join(target, ".obsidian", "plugins", "obsidian-harness");
const sessionsCfgDir = path.join(pluginDir, "sessions");
const vaultSessionsDir = path.join(target, "Sessions");

// --- demo content (mirrors e2e/marketing-demo.spec.ts) ---
const ALPHA_CWD = "/Users/vlln/projects/harness-alpha";
const BETA_CWD = "/Users/vlln/projects/harness-beta";
const GAMMA_CWD = "/Users/vlln/projects/harness-gamma";

const CONVERSATION = [
	{
		prompt: "How do I import a Claude Code session into my vault with the Session Importer skill?",
		answer: "Run the **Session Importer** skill against the native session file. It writes a `.session` entry plus the transcript into your vault and prints a wikilink you can click.\n\nSupported sources:\n\n- **Claude Code** — `~/.claude/projects/<dir>/<uuid>.jsonl`\n- **Codex** — `~/.codex/sessions/.../rollout-*.jsonl`\n- **Pi Agent** — `~/.pi/agent/sessions/<dir>/*.jsonl`\n- **Kimi Code** — `~/.kimi-code/sessions/.../session_*/`\n\nOne session at a time, explicitly selected. Re-importing the same source is a no-op.",
	},
	{
		prompt: "What does the imported .session file contain?",
		answer: "Each `.session` file is a v2 manifest with:\n\n- `entryId`, `historyId`, `agentId`\n- `title`, `cwd`, `createdAt`, `updatedAt`\n- `acpBinding` — `{ agentId, sessionId }` linking back to the original agent process\n\nThe companion `turns.jsonl` lives under `sessions/<historyId>/` in the plugin config dir.",
	},
	{
		prompt: "Can I resume the original conversation after importing?",
		answer: "Yes — if the binding agent is configured locally, the transcript view shows a **Ready to continue** indicator.\n\nClicking it calls `resumeSession` with the opaque `acpBinding.sessionId`. If the agent is unavailable, the history stays read-only and a `Backend unavailable` banner appears.\n\nNo new session is ever created on resume — the opaque binding is restored as-is.",
	},
	{
		prompt: "How does the Turn Navigator help with long conversations?",
		answer: "The **Turn Navigator** renders a vertical rail of turn nodes alongside the message list. Each node is labeled `Turn N: <first prompt line>`.\n\nClicking a non-active node smooth-scrolls the message viewport to that turn and marks the node `aria-current=\"step\"`. The rail itself auto-follows the active turn during manual scroll.\n\nOn narrow viewports (<520px) the rail collapses to reclaim space for messages.",
	},
	{
		prompt: "How are sessions grouped in the Session Manager?",
		answer: "The Session Manager groups sessions by **project** (the `cwd` field). Each project row is collapsible.\n\nA **Recents** section shows the most recently updated sessions across all projects. A search box flattens both into a single filtered list.\n\nStatus slots (busy/idle/error) are rendered per session row with fixed-width geometry.",
	},
	{
		prompt: "What happens when I fork a session?",
		answer: "Forking copies the `historyId` transcript to a new `historyId` and sets `forkedFrom` on the new `.session` entry.\n\nThe fork starts read-only; you can resume it independently under a different agent. The original session is untouched.",
	},
	{
		prompt: "How does the plugin isolate the ACP SDK?",
		answer: "All `@agentclientprotocol/sdk` imports are confined to the `acp/` directory. `AcpClient` owns the process lifecycle (spawn → initialize → newSession → sendPrompt → cancel → disconnect).\n\n`AcpHandler` receives SDK events, filters by `currentSessionId`, converts ACP types to domain types, and broadcasts through a single `onSessionUpdate` channel.\n\nServices in `services/` have zero React imports — they are pure functions and classes consumed by hooks.",
	},
	{
		prompt: "What is the single-event-channel philosophy?",
		answer: "All agent events — message chunks, tool calls, plan updates, usage, config options — flow through one `onSessionUpdate` subscription.\n\n`useAgent` is the facade hook: it composes `useAgentSession` (session-level) and `useAgentMessages` (message-level) behind a single subscription, memoized for return stability.\n\nThis keeps the React tree quiet: one listener, one re-entry point, RAF-batched streaming updates.",
	},
];

const SESSIONS = [
	{
		entryFile: "Sessions/marketing-alpha-long.session",
		entryId: "aaaa1111-1111-4111-8111-111111111111",
		historyId: "bbbb2222-2222-4222-8222-222222222222",
		agentId: "claude-code-acp",
		title: "Importing & navigating Claude Code sessions",
		cwd: ALPHA_CWD,
		acpBinding: { agentId: "claude-code-acp", sessionId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
		turns: CONVERSATION,
	},
	{
		entryFile: "Sessions/marketing-alpha-short.session",
		entryId: "cccc3333-3333-4333-8333-333333333333",
		historyId: "dddd4444-4444-4444-8444-444444444444",
		agentId: "",
		title: "Quick refactoring notes",
		cwd: ALPHA_CWD,
		acpBinding: null,
		turns: [
			{ prompt: "Extract a helper for the retry loop.", answer: "Created `retryWithBackoff` in `utils/retry.ts` and replaced the three inline loops." },
		],
	},
	{
		entryFile: "Sessions/marketing-beta.session",
		entryId: "eeee5555-5555-4555-8555-555555555555",
		historyId: "ffff6666-6666-4666-8666-666666666666",
		agentId: "codex-acp",
		title: "Beta release checklist",
		cwd: BETA_CWD,
		acpBinding: null,
		turns: [
			{ prompt: "Generate the v0.6 beta release checklist.", answer: "1. Bump version to 0.6.0\n2. Update CHANGELOG\n3. Run `npm run gate:mr`\n4. Tag `v0.6.0` and publish release." },
		],
	},
	{
		entryFile: "Sessions/marketing-gamma-pi.session",
		entryId: "7777aaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
		historyId: "8888bbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
		agentId: "pi-acp",
		title: "Pi Agent backend connection",
		cwd: GAMMA_CWD,
		acpBinding: { agentId: "pi-acp", sessionId: "feedface-0000-1111-2222-333333333333" },
		turns: [
			{
				prompt: "How does Obsidian Harness connect to the Pi Agent backend?",
				answer: "Pi Agent is **auto-discovered**: the plugin checks for `~/.pi/pi-acp/` on load and, if present, exposes `pi-acp` as an available agent — no manual path or API key configuration needed.\n\nA session carrying an `acpBinding` to `pi-acp` can be resumed in place: the plugin calls `session/load` with the opaque `acpBinding.sessionId` and the Pi backend replays the context.",
			},
			{
				prompt: "What if the Pi backend isn't installed on this machine?",
				answer: "The transcript stays fully readable offline, and the continuation indicator degrades gracefully to **Backend unavailable** instead of failing.\n\nInstall Pi Agent + the `pi-acp` plugin under `~/.pi/` and the binding becomes resumable again — no session data is lost.",
			},
			{
				prompt: "Can I import a Pi Agent session into this vault?",
				answer: "Yes — the **Session Importer** skill converts `~/.pi/agent/sessions/<dir>/*.jsonl` into a standard v2 `.session` with an `acpBinding` to the original `pi-acp` backend.\n\nIt's idempotent: re-importing the same source is a no-op, and existing content is never overwritten on conflict.",
			},
		],
	},
];

function buildTurnsJsonl(turns) {
	const now = "2026-07-27T09:00:00.000Z";
	return (
		turns
			.map((t, i) =>
				JSON.stringify({
					schemaVersion: 2,
					turnId: `turn-${i + 1}`,
					startedAt: now,
					endedAt: now,
					status: "completed",
					prompt: [{ type: "text", text: t.prompt }],
					items: [{ type: "assistant_message", itemId: `item-${i + 1}`, text: t.answer }],
					stopReason: "end_turn",
				}),
			)
			.join("\n") + "\n"
	);
}

// --- build ---
console.log(`Preparing demo vault at: ${target}`);
mkdirSync(vaultSessionsDir, { recursive: true });
mkdirSync(sessionsCfgDir, { recursive: true });

// plugin files
for (const f of ["main.js", "manifest.json", "styles.css"]) {
	const src = path.join(repoRoot, f);
	if (!existsSync(src)) throw new Error(`missing ${src} — run \`npm run build\` first`);
	copyFileSync(src, path.join(pluginDir, f));
}

// enable plugin
writeFileSync(path.join(target, ".obsidian", "community-plugins.json"), JSON.stringify(["obsidian-harness"], null, 2));
writeFileSync(path.join(target, ".obsidian", "app.json"), JSON.stringify({}));
writeFileSync(path.join(target, ".obsidian", "appearance.json"), JSON.stringify({ theme: "obsidian" }));

// sessions + transcripts + index
const indexLines = [];
for (const s of SESSIONS) {
	// .session entry
	writeFileSync(
		path.join(target, s.entryFile),
		JSON.stringify({
			version: 2,
			entryId: s.entryId,
			historyId: s.historyId,
			agentId: s.agentId,
			title: s.title,
			cwd: s.cwd,
			createdAt: "2026-07-27T09:00:00.000Z",
			updatedAt: "2026-07-27T09:05:00.000Z",
			forkedFrom: null,
			...(s.acpBinding ? { acpBinding: s.acpBinding } : {}),
		}, null, 2),
	);
	// transcript history dir
	const histDir = path.join(sessionsCfgDir, s.historyId);
	mkdirSync(histDir, { recursive: true });
	writeFileSync(
		path.join(histDir, "manifest.json"),
		JSON.stringify({
			schemaVersion: 2,
			historyId: s.historyId,
			createdAt: "2026-07-27T09:00:00.000Z",
			updatedAt: "2026-07-27T09:05:00.000Z",
			metadata: { agentId: s.agentId, cwd: s.cwd, title: s.title },
		}, null, 2),
	);
	writeFileSync(path.join(histDir, "turns.jsonl"), buildTurnsJsonl(s.turns));
	indexLines.push(JSON.stringify({ entryId: s.entryId, historyId: s.historyId, cwd: s.cwd, entryFile: s.entryFile }));
}
writeFileSync(path.join(sessionsCfgDir, "session_index.jsonl"), indexLines.join("\n") + "\n");

// README in vault
writeFileSync(
	path.join(target, "README.md"),
	`# Obsidian Harness — demo vault

Open this folder as a vault in Obsidian (**Open folder as vault**). The
Obsidian Harness plugin is pre-installed and enabled.

## What's here
- **Session Manager** (ribbon robot icon or command palette → "Obsidian Harness: Open session manager") — shows sessions grouped by **project**:
  - \`harness-alpha\` — 2 sessions, incl. a long 8-turn conversation (Claude Code)
  - \`harness-beta\` — 1 session (Codex)
  - \`harness-gamma\` — 1 session bound to the **Pi Agent** backend (auto-discovered from \`~/.pi/pi-acp/\`)
- Open any \`.session\` file (e.g. \`Sessions/marketing-alpha-long.session\`) to read the transcript — note these are **vault files** you can move, link, and search.
- Sessions carry an **acpBinding** (backend connection). Pi Agent is auto-discovered (no config needed); for Claude Code, configure it under **Settings → Obsidian Harness → Claude Code** to see "Ready to continue". Otherwise the indicator degrades gracefully to "backend unavailable".

## Suggested recording beats
1. Session Manager — three projects, expand/collapse rows.
2. Open the long \`.session\` — conversation renders; scroll through 8 turns.
3. Turn Navigator rail (left of messages) — click a turn node to jump.
4. Backend connection — open the \`marketing-gamma-pi.session\` to show the Pi Agent \`acpBinding\` and continuation indicator (auto-discovered).
`,
);

console.log(`\nDone. Open in Obsidian: ${target}`);
console.log(`Sessions: ${SESSIONS.length} (${SESSIONS.map((s) => s.title).join(" | ")})`);
