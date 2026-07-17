---
title: AC-0003: Note-Centric Agent Entry
description: Acceptance criteria for starting and restoring Agent sessions from Markdown notes and selected text.
type: ac
status: active
created: 2026-07-17T00:00:00Z
---

# AC-0003: Note-Centric Agent Entry

## Normal Scenarios

| ID | Preconditions | Steps | Expected Result | Verification |
|----|---------------|-------|-----------------|--------------|
| AC-0003-N-1 | Active file is a Markdown note | Run `Start agent session from this note` | A `.session` file is created next to the note and contains `sourceNote.path`, `cwd`, `sessionId`, `createdAt`, and `updatedAt` | E2E |
| AC-0003-N-2 | Active Markdown note has non-empty selected text | Run `Start agent session from this note` | The `.session` file stores `sourceNote.selection.fromLine`, `toLine`, and selected text snapshot | E2E |
| AC-0003-N-3 | A note-started `.session` file exists | Open the `.session` file | Harness session view opens with the same `sourceNote` metadata and a prefilled prompt that references the note path or selected range | E2E |

## Boundary Scenarios

| ID | Preconditions | Steps | Expected Result | Verification |
|----|---------------|-------|-----------------|--------------|
| AC-0003-B-1 | Active file is not Markdown | Run `Start agent session from this note` | Command is unavailable | E2E |
| AC-0003-B-2 | No text is selected | Run `Start agent session from this note` | `sourceNote.selection` is omitted and the prompt references the whole note | E2E |

## Exception Scenarios

| ID | Preconditions | Steps | Expected Result | Verification |
|----|---------------|-------|-----------------|--------------|
| AC-0003-E-1 | Vault write fails | Run `Start agent session from this note` | A Notice reports failure and the plugin remains usable | Agent judgement |

## Failure Scenarios

| ID | Preconditions | Steps | Expected Result | Verification |
|----|---------------|-------|-----------------|--------------|
| AC-0003-F-1 | Generated session filename already exists | Run `Start agent session from this note` | The plugin chooses a non-conflicting filename or reports the conflict without overwriting | E2E |
