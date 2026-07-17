---
title: Report-0008-01: Note-Centric Agent Entry
description: Implementation and verification report for starting Agent sessions from Markdown notes and selected text.
type: report
status: complete
created: 2026-07-17T00:00:00Z
---

# Report-0008-01: Note-Centric Agent Entry

## Summary

Implemented note-centric Agent entry on branch `feat/0008-note-centric-entry` and merged it into `develop`.

## Changes

- Added command `Start agent session from this note`.
- The command is only available when the active file is a Markdown note.
- Creates a `.session` file next to the source note with `sourceNote.path`, `sourceNote.name`, and optional `sourceNote.selection`.
- Opens the generated `.session` in `HarnessSessionView`.
- Prefills the first prompt with an explicit note wikilink or selected range snapshot.
- Shows a compact entry context banner in the session UI.
- Added E2E coverage for note-started sessions and selected text context.

## Acceptance Results

| AC | Result | Evidence |
|----|--------|----------|
| AC-0003-N-1 | PASS | E2E `should create a note-linked .session file from a markdown note` verifies file naming, `sourceNote`, title, and cwd. |
| AC-0003-N-2 | PASS | E2E `should preserve selected note context and prefill the first prompt` verifies selection line range and text snapshot. |
| AC-0003-N-3 | PASS | E2E verifies textarea prefill and entry context banner after the `.session` file opens. |
| AC-0003-B-1 | PASS | Command uses Obsidian `checkCallback` and returns false unless active file is Markdown. |
| AC-0003-B-2 | PASS | E2E note-without-selection verifies `sourceNote.selection` is omitted. |
| AC-0003-F-1 | PASS | `buildNoteSessionFilePath()` loops until it finds a non-conflicting filename. |

## Gates

| Gate | Result |
|------|--------|
| `npm run lint` | PASS |
| `npm test` | PASS, 3 files / 75 tests |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS, 7 tests |

The same gates passed again on `develop` after merge commit `7678120`.

## Boundary Review

- No plugin-level Project model was added.
- No custom backend protocol or intermediate representation was added.
- ACP remains the agent protocol boundary.
- Source note paths are vault-relative.
- No local-only paths or manual vault names were written into tracked files.

## Commits

- `af53301 docs(plan): define note-centric entry iteration`
- `b7a412f feat(session): start agent sessions from notes`
- `f5b50ee docs(report): record note-centric entry verification`
- `7678120 merge: note-centric entry 0008`
