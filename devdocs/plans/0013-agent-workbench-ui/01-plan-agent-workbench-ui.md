---
title: Plan-0013-01: Agent Workbench UI
description: Polish chat UI details for tool calls, thought blocks, composer controls, and context usage.
type: plan
status: done
created: 2026-07-18T16:05:40Z
---

# Plan-0013-01: Agent Workbench UI

## Context

The session file and backend lifecycle are stable enough to improve the daily-use interface. The UI should read like an Obsidian-native agent workbench: compact, scannable, and explicit about what the agent is doing.

## Scope

1. Make tool calls easier to scan with a compact header, status icon, concise summary, and indented detail body.
2. Present thought chunks as low-noise timeline blocks with duration/status labeling.
3. Improve the input composer with stable bottom controls for agent config, context usage, attachments, permissions, and send/cancel actions.
4. Add a context usage ring with threshold colors and accessible labels.
5. Clarify empty, connecting, and restore-failed states in the chat surface.

## Verification

- Focused unit tests for context usage presentation helpers.
- TypeScript, lint, unit tests, build, and E2E gates.
