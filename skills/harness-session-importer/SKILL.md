---
name: harness-session-importer
description: >
  Use this skill when converting an existing Claude Code, Codex, Pi Agent, or
  Kimi Code session into an Obsidian Harness vault for offline reading and
  project-note linking.
license: Apache-2.0
metadata:
  author: vlln
  version: "0.2.0"
requires:
  bins:
    - python3
---

# Harness Session Importer

Convert one explicitly selected external session directly into a standard
read-only Obsidian Harness session.

## Workflow

1. Resolve the source harness, explicit session path, vault root, and
   vault-relative destination directory from the user's project context.
2. Run the converter, replacing `$_S` with this skill's absolute directory:

   ```bash
   python3 $_S/scripts/import_session.py \
     --harness <claude|codex|pi|kimi> \
     --session <absolute-source-path> \
     --vault <absolute-vault-path> \
     --entry-dir <vault-relative-directory> \
     [--branch <source-branch-id>]
   ```

3. If the command returns `branch_required`, present the reported branches and
   ask the user to choose one. Do not merge mutually exclusive branches.
4. Return the emitted session wikilink. The session is immediately readable in
   Obsidian and has no ACP continuation binding.

## Boundaries

- Convert only explicitly selected sources; do not scan all history roots by
  default.
- Project routing is an Agent decision. Do not encode Folder Bridge or `PJ_*`
  conventions in the converter.
- Treat exit code `2` and stderr JSON as failure. Never resolve a target
  conflict by overwriting the existing session.
