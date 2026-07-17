---
title: Plan-0009-01: Append Agent Output
description: Implement explicit appending of latest Agent response to the active Markdown note.
type: plan
status: pending
created: 2026-07-17T00:00:00Z
---

# Plan-0009-01: Append Agent Output

## Context

Spec-0004 established note-centric session entry. The remaining loop is user-controlled output capture: append useful Agent output back into a note without creating a Project model or write-back protocol.

## Request

Implement `Append last agent response to current note`.

## Output Format

- Code change: command, chat menu action, and append helper.
- Tests: pure unit coverage for extraction/formatting and E2E coverage for command path.
- Report: AC result table and gate results.

## Constraints

- Do not add a plugin-level Project model.
- Do not add an automatic Agent write-back channel.
- Do not append tool calls, images, or resource links in this iteration.
- Keep logic outside React where practical.

## Checkpoint

- AC-0004 normal, boundary, and exception cases have automated evidence.
- `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` pass.

## Steps

1. Add pure helpers for finding and formatting the latest assistant text response.
2. Add a ChatPanel action and plugin workspace command.
3. Add chat menu entry.
4. Add unit and E2E tests.
5. Run gates and write report.
