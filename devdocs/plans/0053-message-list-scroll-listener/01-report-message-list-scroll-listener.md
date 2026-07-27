---
title: Report-0053-01: MessageList Scroll Listener
description: Runtime failure classification and lifecycle-fix evidence for restored MessageList scroll tracking.
type: report
status: complete
created: 2026-07-27T09:46:00Z
---

# Report-0053-01: MessageList Scroll Listener

## Failure Classification

`[LOCAL BUG]` The frozen current-Turn and bottom-action contracts were correct, and the real Obsidian host
delivered a valid scroll position. The implementation registered MessageList listeners while restored history
was still empty; React then replaced the empty-state container with the message container without rerunning the
effect. The new viewport therefore had no `scroll` listener, leaving both `activeMessageId` and `isAtBottom`
stale. This is neither a test-infrastructure nor design defect.

## Red Evidence

The isolated WDIO reproduction recorded `scrollTop=4691`, `scrollHeight=7768`, a first intersecting message at
index 59 and expected Turn 30, while active remained Turn 1. The bottom button also remained absent after setting
the visible viewport to zero because `isAtBottom` stayed at its initial value.

## Fix

- MessageList now includes the empty/non-empty render boundary in the listener effect lifecycle.
- Effect cleanup removes scroll, wheel, touch, pointer and document key listeners from the exact old targets and
  cancels any action tied to the detached container.
- Programmatic coordinator scrolls expose active state so viewport scroll events do not walk active Turn through
  every crossed node; direct user input cancels the action first and therefore resumes normal active tracking.
- A viewport within the existing 35 px bottom threshold clamps active state to the final Turn.
- WDIO leaf markers and teardown are isolated, bottom geometry is compared at the native call instant, and the
  existing tooltip hover uses a scoped event target.

## Verification

| Check | Result |
|-------|--------|
| Packaged plugin build | PASS: TypeScript + production esbuild |
| MessageList ESLint | PASS |
| Failed Session Workspace WDIO layer | PASS: 9/9 in 17.7 s |
| Manual scroll synchronization | PASS: middle viewport plus first/last boundaries |
| Distant Turn navigation | PASS: stable destination active trace and at most two smooth calls |
| Bottom action | PASS: click-time live maximum offset, one or two smooth calls, <=35 px final distance, button hidden |
| Existing workspace regression | PASS: creation modal, action menus, Turn tooltip/navigation and responsive/visual assertions |

DEVELOP Vitest/coverage gates were not repeated in SYSTEM_TEST. The generated 0045 screenshots were restored to
their baseline because this fix changes no visual style or layout and Plan 0051 did not request a new baseline.

## Associated Commits

- `e8ea8c4` `fix(session): rebind restored message scroll listener`
- `440aaef` `fix(session): preserve active state during coordinated scrolling`
- `efb45ca` `test(session): stabilize scoped Turn tooltip hover`

## Conclusion

`[PASS]` The local lifecycle bug is fixed and the failed SYSTEM_TEST layer is green on the fix branch. No known
blocking defect remains in this fix scope; merge to `develop` and perform the post-merge focused confirmation.
