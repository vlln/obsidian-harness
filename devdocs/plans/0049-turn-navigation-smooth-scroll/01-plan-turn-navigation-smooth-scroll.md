---
title: Plan-0049-01: Turn Navigation Smooth Scroll
description: Remove per-user-message pauses by preventing virtual measurement corrections from restarting an in-flight native smooth scroll.
type: plan
status: pending
created: 2026-07-27T06:51:11Z
---

# Plan-0049-01: Turn Navigation Smooth Scroll

## Context

Human review of the refreshed v0.5.0 release candidate found that long-distance Turn navigation is visually
segmented: the message viewport briefly hesitates at each user message it crosses. A 48-turn runtime trace
disproved the initial active-state hypothesis: the active sequence remained `[41]`. The same trace showed the
actual defect: one `scrollToIndex(..., smooth)` call produced nine native smooth `scrollTo` calls as newly
measured target-region messages shifted the virtualizer's destination. Calls 2-9 restarted the browser
animation between approximately 538 ms and 870 ms, creating the visible plateaus.

## Request

During a programmatic Turn jump, obtain the current estimated destination from the virtualizer and issue one
native smooth scroll directly to the message viewport. After that uninterrupted scroll settles, use the
virtualizer's newly measured destination for at most one short smooth correction, followed by an exact automatic
landing. Manual scrolling before and after a jump must retain the existing current-turn semantics.

## Output Format

- Permanent 48-turn runtime assertion limiting a distant jump to one primary and at most one correction smooth
  call while keeping one stable active destination.
- Minimal MessageList native-scroll coordinator with `scrollend` and bounded timeout cleanup.
- Existing reduced-motion, navigation identity and rail-follow behavior preserved.
- Complete fix Report and refreshed v0.5.0 release candidate evidence.

## Constraints

- Use TanStack Virtual for offset calculation/final alignment and the browser for animation; do not implement a
  separate animation engine.
- Do not change the 120-180 ms marker transition, 400 ms target visibility contract or reduced-motion path.
- Do not disable active tracking for manual wheel, trackpad or keyboard scrolling.
- A failed, superseded or unmounted navigation must release listeners and timers automatically.
- Preserve unrelated importer files and their exact diff.

## Checkpoint

Stop if coalescing target corrections prevents the destination from entering the viewport, leaves navigation
cleanup active after failure, or changes message/Turn identity mapping.

## Steps

1. Extend the 48-turn WDIO scenario to record native scroll calls and active-state transitions during a truly
   distant click.
2. Retain the red evidence: nine native smooth calls with plateau-producing mid-flight restarts, while the active
   trace remains `[41]`.
3. Route normal-motion Turn navigation through one native smooth scroll, an optional terminal smooth correction
   and exact virtualizer landing; retain the reduced-motion and fallback paths.
4. Verify distant smooth navigation, manual tracking, reduced motion and complete workspace regression.
5. Complete the Report, merge to `develop` and rebuild the release candidate from the new baseline.
