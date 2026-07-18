---
title: Report-0010-01: Session File Initial Agent Fix
description: Verification report for command-created .session first-open initialization.
type: report
status: complete
created: 2026-07-18T00:00:00Z
---

# Report-0010-01: Session File Initial Agent Fix

## Summary

Fixed command-created `.session` files that selected pi-acp but remained connecting until the user switched tabs.

## Changes

- `decideInitialSessionLifecycle()` accepts an optional `fallbackAgentId`.
- `ChatPanel` passes the resolved `session.agentId` as fallback.
- Empty-agent `.session` files now call `createSession(fallbackAgentId)` on first open instead of waiting.
- Added unit coverage for bootstrap `.session` lifecycle.
- Added E2E coverage for Cmd+P-created `.session` first-open initialization.

## Root Cause

The first mount had two different notions of agent identity:

- `.session` file metadata: `agentId: ""`
- runtime session state: resolved default `pi-acp`

The lifecycle helper only saw the first one, so it returned `wait_for_agent`. The resolved agent ID was still persisted into the file, which explains why switching away and back made the next mount succeed.

## Gates

| Gate | Result |
|------|--------|
| `npm run lint` | PASS |
| `npm test` | PASS, 4 files / 81 tests |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS, 9 tests |

## Regression Evidence

| Scenario | Result | Evidence |
|----------|--------|----------|
| Cmd+P creates `.session` with empty `agentId` | PASS | E2E `should initialize a command-created .session file on first open` |
| No tab switch required | PASS | E2E waits for ACP session ID rewrite on first open |
| Existing restore with stored `agentId` | PASS | Existing unit lifecycle tests unchanged |

## Commit

- `e868e08 fix(session): initialize command-created session files`
- `9300b62 merge: session file initial agent fix 0010`

## Develop Verification

After merging into `develop`, the full gate set was rerun:

| Gate | Result |
|------|--------|
| `npm run lint` | PASS |
| `npm test` | PASS, 4 files / 81 tests |
| `npm run build` | PASS |
| `npm run test:e2e` | PASS, 9 tests |
