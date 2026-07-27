---
title: Report-0051-01: Turn Scroll System Test
description: Real-Obsidian runtime evidence for v0.5.1 manual Turn synchronization and continuous bottom scrolling.
type: report
status: complete
created: 2026-07-27T09:35:00Z
---

# Report-0051-01: Turn Scroll System Test

## Scope And Environment

SYSTEM_TEST ran the packaged plugin in the local Obsidian desktop host through WDIO/Chromedriver on macOS.
The increment exercised a real restored `.session` FileView, TanStack virtual messages, native scrolling, Turn
buttons and the existing trailing loading-indicator geometry. No Agent process, network API, Finder, clipboard
or real user vault/history was accessed. DEVELOP-owned Vitest and coverage layers were not repeated.

## Test Summary

| Layer | Result | Evidence |
|-------|--------|----------|
| Packaged `develop` plugin build | PASS | TypeScript + production esbuild before initial WDIO |
| Initial Session Workspace WDIO | FAIL: 7/9 | New scenarios selected a sibling leaf; classified and fixed by Plan 0052 |
| Isolated manual diagnostic | FAIL: 0/1 | Visible viewport snapshot proved the restored message container lacked a scroll listener |
| Failed layer after Plan 0053 | PASS: 9/9, 17.7 s | Complete `e2e/session-workspace.spec.ts` on the fix branch |
| Post-merge `develop` confirmation | PASS: 4/4, 6.6 s | Existing Turn navigation plus all three `AC-0025 scroll synchronization` scenarios |
| Visual baseline | REUSED | Product changes no CSS/layout; generated 0045 screenshot side effects were restored rather than published as a new baseline |
| Paid/external validation | NOT APPLICABLE | Message scrolling has no remote or paid dependency |

## AC Evidence

| Scenario | Result | Runtime evidence |
|----------|--------|------------------|
| AC-0025-N-2 | [PASS] | Mouse/keyboard Turn activation retains exact target behavior; manual viewport movement selects the nearest preceding user Turn |
| AC-0025-N-3/N-5 | [PASS] | Distant Turn and bottom actions use one primary and at most one correction smooth call; destination active remains stable during coordinated Turn scrolling |
| AC-0025-B-4/B-5 | [PASS] | Manual first/last boundary clamping, true container-bottom distance <=35 px and hidden bottom button |
| AC-0025-E-1/E-3 | [PASS] | MessageId guard remains active; detached-container listeners are cleaned and direct/manual tracking resumes outside an active coordinator action |
| AC-0025-F-1/F-2 | [PASS] | DEVELOP fault tests cover one-shot fallback/recovery; runtime suite remains operable after navigation and measurement changes |

## Failure Classification

| Failure | Classification | Basis | Resolution |
|---------|----------------|-------|------------|
| New cases omitted the shared width helper's visual leaf marker and leaked hidden-leaf state after failure | Local system-test script bug | Product assertions were not reached; zero geometry and later screenshot failures were caused by the test leaf selection/teardown | [Report-0052](../0052-turn-scroll-system-test-selector/01-report-turn-scroll-system-test-selector.md) |
| Restored viewport scrolled to index 59 while active stayed Turn 1 and bottom button stayed absent | Local product bug | The visible container had real geometry, but scroll listeners remained attached to the replaced empty-state element | [Report-0053](../0053-message-list-scroll-listener/01-report-message-list-scroll-listener.md) |
| Programmatic Turn active trace walked through Turns 1-39 | Local product bug | Newly working scroll events updated active during a coordinator-owned animation, violating retained continuous-destination behavior | Plan 0053 added coordinator active-state gating while preserving manual cancellation/tracking |
| Existing tooltip hover became ambiguous after leaf teardown isolation | Local test-script bug | Scoped node existed and product tooltip contract was unchanged; explicit scoped mouseover restored deterministic host event delivery | Plan 0053 test stabilization |

No failure indicated a frozen contract defect, framework instability, coverage error or Mock mismatch. Fixes were
limited to test targeting/teardown and MessageList listener/coordinator lifecycle.

## Semantic Review

The manual scenario compares `aria-current` with the first rendered virtual message intersecting the real
viewport and separately tests both boundaries. The bottom scenario intercepts native `scrollTo`, records the
container maximum offset at the exact call instant, limits smooth calls to two, and observes final geometry and
button state. The distant Turn scenario ensures active identity remains stable throughout the animation. These
assertions observe user-visible behavior and would fail if replaced by last-item alignment, stale rendered-range
scanning or per-message smooth restarts.

## Blocking-Defect Assessment

No known defect remains. Manual navigation and return-to-bottom both complete without a workaround; no data,
security or persistence behavior changed. Under the devloop criteria, v0.5.1 has no release-blocking defect.
The unrelated importer diff checksum remains
`503b454b6eba2f983fbabb897dd69ffc424e5ea649c059fdd17a61c5a4fd2163`.

## Conclusion

`[PASS]` All applicable incremental SYSTEM_TEST evidence passed. The iteration may advance to RELEASE, but no
release branch, `main` merge, production action or version tag is authorized by this Report.
