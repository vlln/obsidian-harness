# Session Importer (Companion Skill)

Obsidian Harness ships a companion skill — **`harness-session-importer`** — that converts an existing AI coding-agent session into a standard Obsidian Harness session inside your vault, so you can read it offline and link it to your project notes.

It is **not** an in-plugin button. It is a standalone CLI skill (Python + a tiny Node helper) shipped under `skills/harness-session-importer/` in this repo.

## What it does

Take one session from a supported agent's native on-disk format and project it into your vault as a fully readable — and, if the agent is still configured, **resumable** — Harness session:

- Produces a `.session` entry note (with a clickable wikilink) plus the transcript and any blobs, written atomically.
- The imported session carries an `acpBinding` to the original backend session, so the plugin can **resume the original conversation** when the agent is available locally. If the backend is gone, the history stays readable and degrades gracefully.
- **Idempotent**: re-importing the same source is a no-op; existing content is never overwritten on conflict.

## Supported sources

| Harness | Source path |
|---------|-------------|
| Claude Code | `~/.claude/projects/<dir>/<uuid>.jsonl` |
| Codex | `~/.codex/sessions/.../rollout-<ts>-<uuid>.jsonl` |
| Pi Agent | `~/.pi/agent/sessions/<dir>/<iso>_<ulid>.jsonl` |
| Kimi Code | `~/.kimi-code/sessions/.../session_<uuid>/` |

One session is converted at a time, explicitly selected — it deliberately does **not** scan or bulk-import all history.

## Prerequisites

- `python3` (stdlib only)
- `node` / `npx`
- The **harness-adapter** repo checked out locally, passed via `--adapter` (it provides the `ahs-export` CLI that turns a native session into the intermediate Agent History Standard format). This requirement will disappear once `harness-adapter` publishes to npm.

## Usage

```bash
python3 skills/harness-session-importer/scripts/import_session.py \
  --harness <claude-code|codex|pi|kimi-code|claude|kimi> \
  --session <absolute-source-path> \
  --vault <absolute-vault-path> \
  --entry-dir <vault-relative-directory> \
  --adapter <absolute-harness-adapter-path> \
  [--branch <source-branch-id>] [--title <display-title>] [--cwd <working-dir>]
```

On success it prints a JSON object with an `entryFile` and a `wikilink` you can click in Obsidian:

```json
{"schemaVersion":1,"status":"created","entryId":"…","historyId":"…","entryFile":"…","turns":12,"wikilink":"[[session-abcd1234.session]]"}
```

On failure it exits with code `2` and writes a structured error to stderr (codes like `source_not_found`, `vault_invalid`, `target_conflict`, `adapter_not_found`, …).

## Design boundaries

- Converts only explicitly selected sources — no bulk scanning.
- Project routing is an Agent decision at import time; no Folder-Bridge or `PJ_*` markers are baked in.
- Only the transcript is migrated into the vault — the native backend session data stays where it is; continuation relies on the backend's own `session/load`.

::: tip
Imported sessions appear in the Session Navigator like any other. Open one to read the full transcript; if the bound agent is configured and the backend session still exists, you can continue the conversation in place.
:::
