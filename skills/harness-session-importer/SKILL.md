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

1. Resolve the source harness, session path, vault root, and vault-relative
   entry directory from the user's request and current project context.
2. Inspect the session before writing. Report semantic degradation and branch
   ambiguity; do not infer a branch or completion state.
3. Generate a bundle only after the user accepts the inspection result.
4. Return the `.harness-import` wikilink. The user reviews and confirms the
   final import inside Obsidian.

## Boundaries

- Never scan all history roots unless the user explicitly requests a bounded
  scan.
- Never write `.session`, transcript history, receipt, or session index files
  directly.
- Never treat an imported source ID as an ACP continuation binding.
- Project routing is an Agent decision. Pass an explicit vault-relative target
  to the converter; do not encode Folder Bridge or `PJ_*` conventions.
