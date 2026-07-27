---
title: Report-0050-01: Turn Scroll Sync
description: Incremental test-infrastructure audit and implementation evidence for active Turn synchronization and shared continuous message scrolling.
type: report
status: complete
created: 2026-07-27T08:37:31Z
---

# Report-0050-01: Turn Scroll Sync

## Incremental Test Infrastructure Audit

| Check | Result | Basis and evidence |
|-------|--------|--------------------|
| Accepted decisions cover the required layers | PASS | ADR-0004 selects Vitest, WDIO Obsidian Service and GitHub Actions; ADR-0011 assigns pure logic/fault branches to Vitest and real Obsidian UI behavior to WDIO |
| Unit seam is supported without new DOM infrastructure | PASS | The Plan places the importable coordinator in `src/ui/message-scroll-coordinator.ts`; it can use injected container/target/timer interfaces in the existing Node Vitest environment without importing React or Obsidian APIs |
| Manual-scroll and long-Session UI verification is supported | PASS | `e2e/session-workspace.spec.ts` already creates a 48-turn `.session` fixture, opens a real FileView, changes viewport width, records `scrollTo`, observes `aria-current` and queries virtual message geometry |
| Reduced motion, fault and timer controls are supported | PASS | Existing Vitest fake timers and injected coordinator interfaces cover deadlines/fallbacks; WDIO `browser.execute` can override `matchMedia`, dispatch input events and record native scroll calls |
| Coverage and delivery gates support the increment | GAP FIXED | `test:coverage`, `gate:mr` and scenario-subset `gate:submission` already exist; the explicit V8 allowlist was extended with `src/ui/message-scroll-coordinator.ts` so the new helper cannot pass outside coverage accounting |
| Architecture rules remain aligned | PASS | The helper remains UI-owned and is consumed by MessageList; no services-to-UI dependency, persistence owner or ACP boundary changes |
| Mock, paid dependency and deployment changes | NOT APPLICABLE | Scrolling is local browser/virtualizer behavior with no external API, network, paid resource or packaging change |
| New test-infrastructure ADR or execution container | NOT REQUIRED | ADR-0011 explicitly covers this UI/projection split and rejects duplicate component-test frameworks; no new dependency or test layer is introduced |

The accepted infrastructure was previously self-proven by the evidence recorded in ADR-0011 and
Report-0041. The initial audit missed that V8 coverage uses an explicit source allowlist; the first DEVELOP red
test exposed that omission before business integration. TEST_INFRA therefore added only the new pure helper to
that allowlist and ran a focused coverage proof. No framework, dependency, threshold, gate parser or CI workflow
changed. Concrete WDIO assertions remain owned by SYSTEM_TEST.

Focused proof: `npx vitest run --coverage --coverage.include=src/ui/message-scroll-coordinator.ts
test/message-scroll-coordinator.test.ts` passed 6/6 with 90.9% line and 84.21% branch coverage.

## DEVELOP Evidence

### Root Cause

| Symptom | Cause |
|---------|-------|
| Manual scrolling did not reliably update the active Turn | `MessageList` scanned `getVirtualItems()`, whose rendered range can lag the viewport scroll event; the active anchor was therefore derived from stale rendered items rather than `scrollTop` |
| Scroll-to-bottom could pause across virtual measurements | The button called `scrollToIndex(last, smooth)` directly, so TanStack measurement corrections could restart native smooth scrolling; last-message alignment also excluded the trailing loading-indicator geometry |

### Implementation

- `getVirtualMessageAnchorIndex` uses TanStack's offset lookup against the actual non-negative `scrollTop`, with
  deterministic first/last fallback boundaries.
- `createMessageScrollCoordinator` owns one action at a time, one primary native smooth call, at most one
  correction, 1.6 s phase bounds, exact landing, reduced-motion/invalid-target fallback and stale-action cleanup.
- Turn navigation supplies a virtualizer `align=start` target. The bottom button supplies the live
  `max(0, scrollHeight - clientHeight)` target, so the loading indicator is included and the existing 35 px
  bottom condition becomes true.
- Wheel/trackpad, touch, pointer and scrolling-key input cancel a pending programmatic landing while ordinary
  scroll events continue to schedule active Turn updates.
- Each action stores its original container, so replacement/unmount cleanup cannot remove listeners from the
  wrong DOM node.

### AC Evidence

| Scenario | Result | DEVELOP evidence |
|----------|--------|------------------|
| AC-0025-N-3 | [PASS] | `message scroll coordinator > performs one primary and at most one correction`; bounded-timeout/action-identity and reduced-motion tests; MessageList wiring review |
| AC-0025-N-5 | [PASS] | Primary/correction, 1 px threshold and live-offset request tests in `test/message-scroll-coordinator.test.ts` |
| AC-0025-B-3 | [PASS] | Existing 500-message projection-under-16-ms test plus `coalesces active updates to one callback per frame` |
| AC-0025-B-5 | [PASS] | Reduced-motion request commits immediately without native smooth calls |
| AC-0025-E-3 | [PASS] | Superseding/cancel, target replacement and original-container cleanup tests leave no listener or timer and perform no stale commit |
| AC-0025-F-1 | [PASS] | Invalid Turn identity cancels without landing; a subsequent valid target completes |
| AC-0025-F-2 | [PASS] | Invalid bottom offset performs one exact fallback without smooth calls; coordinator remains reusable |
| AC-0025-N-2 | AUTHORED / SYSTEM_TEST DEFERRED | WDIO manually scrolls the 48-turn viewport and compares `aria-current` with the first intersecting message; not executed in DEVELOP |
| AC-0025-B-4 | AUTHORED / SYSTEM_TEST DEFERRED | The same WDIO case asserts first/last Turn clamping; not executed in DEVELOP |
| AC-0025-E-1 | AUTHORED / SYSTEM_TEST DEFERRED | Existing identity guard remains in Vitest; real Session replacement/navigation recovery remains owned by WDIO SYSTEM_TEST |

No test is skipped silently. The three deferred rows are intentionally excluded from the DEVELOP submission
scenario set and must not be promoted to PASS until the SYSTEM_TEST Plan runs WDIO on `develop`.

### Test and Gate Evidence

| Check | Result |
|-------|--------|
| Red reproduction | `9c3cd1f`: focused run failed because `src/ui/message-scroll-coordinator.ts` did not exist; existing Turn projection remained 8/8 green |
| Focused green | TypeScript and ESLint passed; Vitest `message-scroll-coordinator` + `turn-navigation`: 2 files / 17 tests passed |
| Clean-worktree MR gate at `5307f0f` | PASS: lint, fixture lint and production build; Vitest 25 files / 207 tests; V8 93.61% lines / 81.05% branches; importer 9 tests / 90% lines |
| WDIO | NOT RUN in DEVELOP; three focused scenarios were authored in `e2e/session-workspace.spec.ts` for SYSTEM_TEST ownership |
| Unrelated importer diff | PRESERVED: SHA-256 `503b454b6eba2f983fbabb897dd69ffc424e5ea649c059fdd17a61c5a4fd2163` before and after implementation |

### Acceptance Reasonableness

The PASS rows map to named tests with business assertions over offsets, native call counts, deadlines, cleanup,
commit side effects and frame scheduling. The implementation diff contains the corresponding offset resolver,
coordinator and MessageList wiring; no assertion was weakened to obtain green. Deferred WDIO evidence is
reported separately rather than represented as executed.

## Associated Commits

- `9c3cd1f` `test(session): reproduce turn scroll synchronization gaps`
- `2ccbb50` `test(infra): cover message scroll coordinator`
- `e5d4a13` `fix(session): synchronize message scrolling`
- `f1bbac9` `test(session): cover manual and bottom scrolling`
- `5307f0f` `test(session): prove active turn frame coalescing`

## SYSTEM_TEST Evidence

[Report-0051](../0051-turn-scroll-system-test/01-report-turn-scroll-system-test.md) records the real-Obsidian
failure classifications, complete 9/9 failed-layer pass and 4/4 post-merge `develop` confirmation.
