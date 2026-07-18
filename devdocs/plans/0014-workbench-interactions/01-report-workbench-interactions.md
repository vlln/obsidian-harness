---
title: Report-0014-01: Workbench Interactions
description: Implementation report for thought duration and tool folding.
type: report
status: complete
created: 2026-07-18T16:35:46Z
---

# Report-0014-01: Workbench Interactions

## Summary

Implemented the missing workbench interactions for thought duration and collapsible tool details.

## Changes

- Thought chunks record start/update timestamps in message state and render as `Thought for Xs`.
- Thought content remains click-to-expand.
- Tool calls are clickable collapsible controls.
- Collapsed tool calls show a bounded parameter summary.
- Expanded tool calls show full input parameters, returned raw output when provided, and structured content such as terminal/diff blocks.
- ACP rawOutput is now propagated into message state.
- Added focused unit tests for duration formatting, summary truncation, stable payload formatting, thought timing, and rawOutput merging.

## Gates

- `npx tsc --noEmit --skipLibCheck` [PASS]
- `npm run lint` [PASS]
- `npm test` [PASS] 85 tests
- `npm run build` [PASS]
- `npm run test:e2e` [PASS] 8 tests
