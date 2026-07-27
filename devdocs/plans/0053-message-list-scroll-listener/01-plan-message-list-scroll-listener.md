---
title: Plan-0053-01: MessageList Scroll Listener
description: Rebind MessageList scroll tracking after history restore replaces the empty-state scroll container.
type: plan
status: pending
created: 2026-07-27T09:46:00Z
---

# Plan-0053-01: MessageList Scroll Listener

## Context

Plan 0051 runtime diagnostics observed `scrollTop=4691`, first visible message index 59 and expected Turn 30,
while active remained Turn 1. MessageList's scroll effect ran during the initial empty render and registered on
that container. Restored history changed the conditional render to a different message container, but the
effect dependencies stayed stable, so neither active tracking nor `isAtBottom` observed the real viewport.

## Request

Rerun the scroll-listener effect when MessageList crosses the empty/non-empty render boundary and explicitly
remove all listeners from the previous container/document during effect cleanup.

## Output Format

- Minimal `MessageList.tsx` lifecycle fix with no coordinator or layout changes.
- Existing red WDIO manual-scroll snapshot and bottom-button absence turn green.
- Complete fix Report and merge into `develop` before restarting the failed SYSTEM_TEST layer.

## Constraints

- Do not change active-anchor math, bottom geometry, smooth-scroll timing or CSS.
- Do not weaken the new WDIO assertions or extend their timeouts.
- Avoid listener accumulation across new/restore/fork transitions and preserve view-level cleanup compatibility.
- Preserve importer and screenshot changes outside this fix.

## Checkpoint

Stop if rebinding creates duplicate scroll callbacks, if listeners remain on a detached container, or if the
visible viewport still fails to update active/bottom state after history restore.

## Steps

1. Retain the Plan 0051 diagnostic snapshot as the red regression.
2. Add empty/non-empty identity to the scroll effect lifecycle and return explicit native listener cleanup.
3. Type-check/build the packaged plugin without rerunning DEVELOP unit layers.
4. Restart the failed Session Workspace WDIO layer; complete the Report and merge when green.
