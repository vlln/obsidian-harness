---
title: Plan-0014-01: Workbench Interactions
description: Add thought duration labels and collapsible tool call parameter/result details.
type: plan
status: done
created: 2026-07-18T16:35:46Z
---

# Plan-0014-01: Workbench Interactions

## Context

The UI polish pass established the workbench visual direction. The next step is to make thought and tool blocks behave like compact inspection controls.

## Scope

1. Thought blocks show a duration label and can expand to reveal received thought content.
2. Tool calls are clickable collapsible controls.
3. Collapsed tool calls show a bounded parameter summary.
4. Expanded tool calls show full parameters plus returned content.
5. Helper behavior is covered by focused unit tests.

## Verification

- Unit tests for thought duration and tool parameter summaries.
- TypeScript, lint, unit tests, build, and E2E gates.
