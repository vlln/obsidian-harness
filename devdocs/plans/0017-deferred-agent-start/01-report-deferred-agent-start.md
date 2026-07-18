---
title: Report-0017-01: Deferred Agent Start
description: Implementation report for deferred backend start and header simplification.
type: report
status: complete
created: 2026-07-18T17:50:00Z
---

# Report-0017-01: Deferred Agent Start

## Summary

New `.session` entries now remain unconnected when opened. The selected agent is recorded in the entry UI state, and the backend ACP session is created immediately before the first message is sent.

## Changes

- Changed initial session lifecycle resolution so empty entries stay idle instead of connecting on open.
- Added pending-session agent selection for the sidebar menu.
- Moved first backend session creation into the send path and passed the created session snapshot into the first prompt send.
- Simplified the sidebar header to a single More button while preserving menu access to session actions.
- Updated e2e coverage for the unconnected-on-open contract.

## Gates

- `npx tsc --noEmit --skipLibCheck` [PASS]
- `npm run lint` [PASS]
- `npm test` [PASS] 89 tests
- `npm run build` [PASS]
- `npm run test:e2e` [PASS] 9 tests
