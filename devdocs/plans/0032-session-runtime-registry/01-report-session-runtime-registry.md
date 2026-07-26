---
title: Report-0032-01: Session Runtime Registry
description: Runtime status registry implementation and gate evidence for AC-0019-B-2 and ADR-0010 runtime projection constraints.
type: report
status: complete
created: 2026-07-26T05:39:33Z
---

# Report-0032-01: Session Runtime Registry

## Summary

Added a runtime-only registry keyed by entryId and viewId, wired every ChatPanel host through the shared
component, and preserved the existing ChatViewRegistry container API. No dependencies or persistence were
added.

## AC Evidence

| Scenario | Result | Evidence |
|----------|--------|----------|
| AC-0019-B-2 | [PASS] | `test/session-runtime-registry.test.ts` removes permission/error/busy/ready views in order and asserts permission → error → busy → ready → null |

## Constraint Evidence

- AR-010-04: registry stores `entryId -> viewId -> status` and uses the frozen priority table.
- AR-010-09: `src/services/view-registry.ts` has no React, Obsidian view-class or ACP SDK import.
- ChatPanel mount/update/unmount uses one shared path for ChatView, FloatingChatView and HarnessSessionView.
- Plugin unload clears runtime state and subscribers.

## Gate Evidence

| Gate | Result |
|------|--------|
| Focused runtime tests | PASS: 4/4 |
| Related workbench tests | PASS: 4/4 |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run gate:mr` | PASS: 16 files, 131 Vitest tests; 92.05% V8 lines; 9 Python tests; 90% Python lines |
| Submission gate | PASS |

## Associated Commit

- `86fcb09 feat(session): implement AC-0019 runtime registry`
