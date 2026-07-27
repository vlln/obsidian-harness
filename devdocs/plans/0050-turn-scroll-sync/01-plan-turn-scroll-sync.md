---
title: Plan-0050-01: Turn Scroll Sync
description: Keep active Turn state synchronized with manual viewport movement and reuse the continuous smooth-scroll coordinator for the scroll-to-bottom action.
type: plan
status: pending
created: 2026-07-27T08:37:31Z
---

# Plan-0050-01: Turn Scroll Sync

## Context

After the v0.5.0 Turn navigation smooth-scroll fix, two related runtime gaps remain. Manually scrolling the
message viewport does not reliably move `aria-current` to the nearest preceding user turn, even though
BR-054/BR-055 and AC-0025-N-2/B-3/B-4 already require that behavior. The scroll-to-bottom button still calls
the virtualizer's smooth `scrollToIndex` path directly, allowing virtual measurement corrections to restart the
animation instead of using the bounded continuous-scroll behavior delivered by Plan 0049.

## Request

Derive the active message anchor from the viewport's actual scroll offset whenever the user scrolls, then
project that anchor to the nearest preceding user turn. Route the scroll-to-bottom button through the existing
continuous native smooth-scroll behavior, with at most one terminal correction and an exact final alignment.

## Output Format

- Permanent long-session WDIO regression proving manual viewport scrolling selects the nearest preceding Turn,
  clamps at both ends, coalesces rapid/streaming-height updates by RAF and changes `aria-current` from actual
  viewport position.
- Permanent WDIO regression proving the bottom action targets the live maximum container offset, uses one
  primary and at most one correction smooth call and ends within the 35 px bottom threshold with the button
  hidden.
- Fake-clock coordinator tests covering action identity, the 1 px correction threshold, 1.6 s phase/3.2 s total
  bounds, reduced motion, one-shot invalid target fallback, superseding navigation, target replacement, direct
  input and unmount cleanup.
- One reusable `src/ui/message-scroll-coordinator.ts` coordinator consumed by MessageList, with
  virtualizer-aligned Turn targets and container-geometry bottom targets.
- Complete Report and a clean merge into `develop`; no release branch, `main` merge or version tag.

## Constraints

- Preserve frozen Spec-0007 and AC-0006 semantics; do not change public interfaces, persisted data or message
  identity.
- Use TanStack Virtual for offset lookup and exact final alignment, and native scrolling for animation; do not
  add an animation engine or dependency.
- Manual wheel, trackpad, scrollbar and keyboard scrolling must all update active Turn state from actual
  viewport position.
- Preserve reduced-motion behavior, current Turn click identity validation, bounded cleanup and unmount safety.
- Direct wheel/trackpad, touch, scrollbar and scrolling-key input must supersede pending programmatic landing
  without suppressing active Turn tracking.
- Do not expand the change to unrelated automatic scrolling paths unless required by the shared helper.
- Preserve unrelated importer files and existing runtime screenshots exactly.

## Checkpoint

Stop if offset-based active tracking cannot identify the first message intersecting the viewport, if the shared
coordinator changes Turn click landing semantics, or if scroll cleanup can outlive a superseding action or
component unmount.

## Steps

1. Extend `e2e/session-workspace.spec.ts` with failing `AC-0025 scroll synchronization` cases for
   AC-0025-N-2/B-3/B-4/E-1: preserve mouse and keyboard Turn activation, `align=start` exact landing and
   messageId identity guards; manually move to a known message anchor; assert nearest-preceding and first/last
   `aria-current` clamping; trace that rapid scroll events plus streaming height changes schedule one active
   update per animation frame without changing the Turn/messageId mapping.
2. Add failing WDIO cases for AC-0025-N-5/B-5/E-3: record bottom target geometry and smooth calls, then exercise
   wheel/trackpad, touch, scrollbar pointer input and scrolling keys while a programmatic action is pending.
3. Add `test/message-scroll-coordinator.test.ts` fake-clock/fault-injection tests and extend
   `test/turn-navigation.test.ts` for AC-0025-N-3/N-5/B-3/B-5/E-3/F-1/F-2. Preserve the existing 500-message
   projection-under-16-ms assertion and add fake-RAF coalescing/mapping stability evidence. Verify the shared
   coordinator's action identity, 1 px correction threshold, 1.6 s phase and 3.2 s total deadline,
   reduced-motion immediate landing, one-shot invalid virtual/container target fallback and recovery,
   superseding action, message target replacement, stale scrollend/timeout suppression, listener/timer removal
   and unmount cleanup.
4. Replace rendered-range scanning with an offset-based virtual message anchor derived from `scrollTop`.
5. Extract the Plan 0049 native smooth-scroll sequence into the importable
   `src/ui/message-scroll-coordinator.ts` production module, including the offset-based message anchor resolver;
   consume it from `MessageList.tsx` for virtualizer Turn targets and the container's live maximum offset, then
   route Turn clicks and the bottom button through it. Direct user input must cancel only the pending
   programmatic landing.
6. Extend the focused WDIO failure cases so an invalid Turn target is followed by a successful Turn jump, and
   invalid bottom geometry is followed by a normal bottom action satisfying AC-0025-N-5; this proves recovery
   rather than only bounded failure.
7. Run the newly failing Vitest cases to green, then the MR gate and clean-worktree submission gate. Author but
   do not execute WDIO on this branch; after merge, SYSTEM_TEST must create its own Plan and execute the authored
   focused WDIO command once on `develop`.
8. Complete the Report, merge the fix branch into `develop` and leave v0.5.1 publication for explicit approval.

## Verification Commands

The DEVELOP red run must fail because the offset-based anchor/coordinator exports do not yet exist and the old
bottom path has no shared target/coalescing behavior. Record those assertions in the Report before
implementation.

```bash
npx vitest run test/message-scroll-coordinator.test.ts test/turn-navigation.test.ts
```

The WDIO command is documented here for the later SYSTEM_TEST Plan and must not run on this feature branch:

```bash
npm run test:e2e -- --spec e2e/session-workspace.spec.ts --mochaOpts.grep "AC-0025 scroll synchronization"
```

After the focused cases turn green, run the branch-owned MR gate once:

```bash
npm run gate:mr
```

After the Report is complete and the coverage summary exists, run the submission gate with the exact affected
DEVELOP scenario set backed by executed Vitest evidence. AC-0025-N-2/B-4/E-1 must be recorded in the Report as
WDIO assertions authored and deferred, not `[PASS]`, until the later SYSTEM_TEST Plan executes them:

```bash
npm run gate:submission -- --report devdocs/plans/0050-turn-scroll-sync/01-report-turn-scroll-sync.md --ac AC-0025-N-3,AC-0025-N-5,AC-0025-B-3,AC-0025-B-5,AC-0025-E-3,AC-0025-F-1,AC-0025-F-2 --min-lines 80
```
