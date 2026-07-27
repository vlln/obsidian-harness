---
title: Plan-0052-01: Turn Scroll System-Test Selector
description: Fix the new WDIO scenarios so the shared viewport-width helper isolates their marked workspace leaf.
type: plan
status: done
created: 2026-07-27T09:38:12Z
---

# Plan-0052-01: Turn Scroll System-Test Selector

## Context

The first Plan 0051 WDIO run passed 7/9 Session Workspace scenarios but both new scroll scenarios failed before
their product assertions. `setTurnViewportWidth` selects the leaf marked `data-workspace-turn-visual` and hides
its sibling leaves. The new scenarios marked only `workspaceTurnManual` or `workspaceTurnBottom`, so the helper
could isolate another leaf and leave the tested viewport hidden with zero geometry.

## Request

Mark each new scenario as the current visual leaf while it uses the shared width helper, then remove both its
scenario-specific and visual marker during teardown.

## Output Format

- Minimal WDIO fixture-marker correction in `e2e/session-workspace.spec.ts`.
- Failed SYSTEM_TEST layer rerun from `session-workspace.spec.ts`.
- Complete classification Report and merge back to `develop`.

## Constraints

- Do not change product code, Spec/AC/ADR, selector helper semantics or assertions.
- Do not weaken timeouts, expected ordinals, smooth-call limits, bottom geometry or button state.
- Preserve unrelated importer and screenshot changes exactly.

## Checkpoint

Stop and reclassify if either scenario still reaches a non-zero visible viewport but fails its product assertion;
that result would no longer be explained by the test selector.

## Steps

1. Retain the original 7-pass/2-fail output as red evidence.
2. Add/remove `workspaceTurnVisual` with each new scenario marker.
3. Rebuild the packaged plugin only if product code changes (not expected), then rerun the failed WDIO layer.
4. Complete the Report and merge the test-only fix to `develop`.
