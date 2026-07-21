---
name: harness-session-importer
description: >
  Use this skill when importing an existing Claude Code, Codex, Pi Agent, or
  Kimi Code session into an Obsidian Harness vault for offline reading and
  project-note linking.
license: Apache-2.0
metadata:
  author: vlln
  version: "0.1.0"
requires:
  bins:
    - python3
---

# Harness Session Importer

Convert one explicitly selected external session into a reviewable Obsidian
Harness import bundle. The plugin remains responsible for materializing the
bundle into its session storage.

## Workflow

1. Resolve the source harness, explicit session path, vault root, and
   vault-relative entry directory from the user's request and project context.
2. Run the proprietary inspector, replacing `$_S` with this skill's absolute
   directory:

   ```bash
   python3 $_S/scripts/import_session.py inspect \
     --harness <claude|codex|pi|kimi> --session <absolute-path> [--branch <id>]
   ```

3. Summarize `output`, `branches`, `complete`, and every diagnostic's semantic
   impact. When the command returns `branch_required`, ask the user to choose
   one reported branch and inspect again. Never infer it.
4. After the user accepts the report, publish the candidate bundle:

   ```bash
   python3 $_S/scripts/import_session.py bundle \
     --harness <kind> --session <absolute-path> --vault <absolute-vault> \
     --entry-dir <vault-relative-directory> [--branch <id>]
   ```

   Add `--accept-incomplete` only after the user explicitly accepts the listed
   semantic degradations.
5. Return the emitted `.harness-import` wikilink. The user reviews and confirms
   materialization inside Obsidian.

## Boundaries

- Never scan all history roots unless the user explicitly requests a bounded
  scan.
- Never write `.session`, transcript history, receipt, or session index files
  directly.
- Never treat an imported source ID as an ACP continuation binding.
- Project routing is an Agent decision. Pass an explicit vault-relative target
  to the converter; do not encode Folder Bridge or `PJ_*` conventions.
- Treat CLI exit code `2` and its stderr JSON as a failed operation. Do not
  parse partial stdout or retry by weakening path/branch validation.
