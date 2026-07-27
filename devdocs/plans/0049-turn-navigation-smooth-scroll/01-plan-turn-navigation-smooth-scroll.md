---
title: Plan-0049-01: Turn Navigation Smooth Scroll
description: Remove per-user-message pauses by locking active state to the destination during programmatic Turn navigation.
type: plan
status: pending
created: 2026-07-27T06:51:11Z
---

# Plan-0049-01: Turn Navigation Smooth Scroll

## Context

Human review of the refreshed v0.5.0 release candidate found that long-distance Turn navigation is visually
segmented: the message viewport briefly hesitates at each user message it crosses. Scroll handling currently
updates `activeTurnMessageId` from the viewport on every animation frame. Each crossed turn therefore triggers
a MessageList render and restarts the rail's active-marker follow animation while the virtualizer is still
performing one smooth destination scroll.

## Request

During a programmatic Turn jump, make the selected destination active immediately and suppress intermediate
viewport-derived active changes. Release the lock when the destination becomes the viewport anchor or after a
bounded timeout. Manual scrolling before and after a jump must retain the existing current-turn semantics.

## Output Format

- Permanent 48-turn runtime trace showing one stable active destination during the jump.
- Minimal MessageList navigation lock with bounded cleanup.
- Existing reduced-motion, navigation identity and rail-follow behavior preserved.
- Complete fix Report and refreshed v0.5.0 release candidate evidence.

## Constraints

- Do not replace TanStack Virtual or implement a separate scrolling engine.
- Do not change the 120-180 ms marker transition, 400 ms target visibility contract or reduced-motion path.
- Do not disable active tracking for manual wheel, trackpad or keyboard scrolling.
- A failed/aborted navigation must release the lock automatically.
- Preserve unrelated importer files and their exact diff.

## Checkpoint

Stop if suppressing intermediate active updates prevents the destination from entering the viewport, leaves the
active state locked after failure, or changes message/Turn identity mapping.

## Steps

1. Extend the 48-turn WDIO scenario to record active-state transitions during a distant click.
2. Retain the red trace showing multiple intermediate active turns.
3. Add a destination lock around `navigateToTurn` and viewport-derived active updates.
4. Verify distant smooth navigation, manual tracking, reduced motion and complete workspace regression.
5. Complete the Report, merge to `develop` and rebuild the release candidate from the new baseline.
