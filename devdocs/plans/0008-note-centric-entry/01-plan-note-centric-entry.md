---
title: Plan-0008-01: Note-Centric Agent Entry
description: Implement and verify starting Harness sessions from Markdown notes and selections.
type: plan
status: done
created: 2026-07-17T00:00:00Z
---

# Plan-0008-01: Note-Centric Agent Entry

## Goal

Make the note-started Agent path explicit and verifiable:

- Start a `.session` entry from the active Markdown note.
- Preserve note path and selected text metadata.
- Open the generated session entry in Harness session view.
- Prefill the prompt with source note context so the Agent receives an explicit path/range reference when the user sends the first turn.
- Add E2E coverage for the new command and metadata.

## Acceptance Mapping

| AC | Implementation |
|----|----------------|
| AC-0003-N-1 | Add `start-agent-session-from-note` command and source note metadata. |
| AC-0003-N-2 | Capture editor selection range and selected text snapshot. |
| AC-0003-N-3 | Pass source note context from `.session` into ChatPanel prompt prefill. |
| AC-0003-B-1 | Use Obsidian `checkCallback` to expose the command only for Markdown notes. |
| AC-0003-B-2 | Omit selection when selected text is empty. |
| AC-0003-F-1 | Generate conflict-free filenames near the note. |

## Gates

- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e`

## Non-Goals

- No plugin Project model.
- No workflow orchestration/control plane.
- No custom agent protocol beyond ACP.
- No automatic note write-back channel.
