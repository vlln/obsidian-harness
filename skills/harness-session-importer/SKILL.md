---
name: harness-session-importer
description: >
  Use this skill when converting an existing Claude Code, Codex, Pi Agent, or
  Kimi Code session into an Obsidian Harness vault for offline reading and
  project-note linking.
license: Apache-2.0
metadata:
  author: vlln
  version: "0.4.0"
requires:
  bins:
    - python3
    - node
---

# Harness Session Importer

Convert one explicitly selected external session directly into a standard
Obsidian Harness session. Native-format parsing is delegated to the
**harness-adapter** library's `ahs-export` CLI; this skill handles
AHS → Obsidian transcript projection and atomic session writing.

## Architecture

```
Source session path (user-specified, in standard harness directory)
  ↓ Python: extract sessionId from path (harness-specific)
sessionId
  ↓ ahs-export <harness> <sessionId> <tmp-outdir>  (harness-adapter CLI)
AHS archive on disk (manifest.json + records/*.jsonl + blobs/)
  ↓ import_session.py (Python, this skill)
Obsidian Harness session (.session + turns.jsonl + blobs/)
```

Source files always live in their harness's standard directory
(`~/.claude/projects/`, `~/.codex/sessions/`, etc.), so the adapter's
default base path discovers them without any symlink or temp-dir tricks.

## Workflow

1. Resolve the source harness, explicit session path, vault root, and
   vault-relative destination directory from the user's project context.
2. Run the converter, replacing `$_S` with this skill's absolute directory
   and `$_A` with the harness-adapter repo root:

   ```bash
   python3 $_S/scripts/import_session.py \
     --harness <claude-code|codex|pi|kimi-code> \
     --session <absolute-source-path> \
     --vault <absolute-vault-path> \
     --entry-dir <vault-relative-directory> \
     --adapter <absolute-harness-adapter-path> \
     [--branch <source-branch-id>]
   ```

3. If the command returns `branch_required`, present the reported branches
   and ask the user to choose one. Do not merge mutually exclusive branches.
4. Return the emitted session wikilink. The session is immediately readable
   in Obsidian. Imported sessions carry an `acpBinding` that allows the
   plugin to resume the native backend session if the corresponding agent
   is configured; unconfigured agents degrade gracefully.

## sessionId extraction

The converter extracts the sessionId from the source path so it can pass
it to `ahs-export`:

| Harness | Source path pattern | sessionId |
|---------|-------------------|-----------|
| claude-code | `~/.claude/projects/<dir>/<uuid>.jsonl` | filename stem |
| codex | `~/.codex/sessions/.../rollout-<ts>-<uuid>.jsonl` | last 36 chars of filename |
| pi | `~/.pi/agent/sessions/<dir>/<iso>_<ulid>.jsonl` | part after `_` |
| kimi-code | `~/.kimi-code/sessions/.../session_<uuid>/` | dir name without `session_` prefix |

## Boundaries

- Convert only explicitly selected sources; do not scan all history roots
  by default.
- Project routing is an Agent decision. Do not encode Folder Bridge or
  `PJ_*` conventions in the converter.
- Treat exit code `2` and stderr JSON as failure. Never resolve a target
  conflict by overwriting the existing session.
- The harness-adapter repo must be available on the local filesystem
  (passed via `--adapter`). It is a source-level dependency run via
  `npx vite-node`; when harness-adapter publishes to npm, the `--adapter`
  argument will be replaced by an `npx ahs-export` invocation.
