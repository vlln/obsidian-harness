---
title: Report-0043-01: Per-user-message Turn Navigator
description: Implementation and DEVELOP-slice evidence for the user-turn projection, FileView-only rail and virtualized navigation under AC-0025.
type: report
status: complete
created: 2026-07-27T03:58:36Z
---

# Report-0043-01: Per-user-message Turn Navigator

## Summary

`.session` FileViews now render a compact left rail with one accessible node per user message. A React-free
projection creates stable messageId/index mappings and safe 160-code-point previews without exposing image data
or resource URIs. The rail uses fixed 24 px targets, a 150 ms active transition, Obsidian viewport-aware
tooltips and a 519 px container-query cutoff.

MessageList derives the projection with `useMemo`, batches active tracking through one animation frame and
selects the most recent user turn at the viewport's upper anchor. Navigation validates messageId against the
current Session before calling the existing virtualizer. Reduced-motion requests use immediate scrolling and a
single fallback attempt handles a rejected target measurement without a retry loop.

## AC Evidence

| Scenario | Result | Evidence |
|----------|--------|----------|
| AC-0025-N-1 (DEVELOP slice) | [PASS] | Projection test asserts exactly one ordered item per user message; `TurnNavigator` renders one button with ordinal/preview aria-label, fixed target and connector CSS. Hover/focus geometry remains SYSTEM_TEST. |
| AC-0025-N-2 (DEVELOP slice) | [PASS] | MessageList validates messageId and calls `scrollToIndex(messageIndex, align=start)`; active projection test asserts the nearest preceding user turn. Virtualizer runtime/keyboard evidence remains SYSTEM_TEST. |
| AC-0025-N-3 (DEVELOP slice) | [PASS] | Source and CSS regression assertions cover reduced-motion branching and the 150 ms node transition. Actual 400/100 ms viewport timing remains SYSTEM_TEST. |
| AC-0025-N-4 (DEVELOP slice) | [PASS] | Active state changes both size and theme accent; Obsidian tooltip placement is right; the rail is a sibling grid column inside MessageList so InputArea geometry is untouched. Theme and viewport screenshots remain SYSTEM_TEST. |
| AC-0025-B-1 (DEVELOP slice) | [PASS] | No user turns produces no rail item/class; CSS asserts a 519 px hide cutoff and 34 px column only while the rail exists. Width-matrix geometry remains SYSTEM_TEST. |
| AC-0025-B-2 | [PASS] | Tests assert whitespace normalization, a 160 Unicode code-point maximum, readable image/resource summaries and absence of base64/full URI values. |
| AC-0025-B-3 (DEVELOP slice) | [PASS] | A 500-message projection completes below 16 ms; source regression asserts the single pending RAF guard. Streaming behavior remains SYSTEM_TEST. |
| AC-0025-B-4 (DEVELOP slice) | [PASS] | Active selector tests clamp before the first user turn and after the last; viewport boundary behavior remains SYSTEM_TEST. |
| AC-0025-E-1 | [PASS] | Behavioral test rejects a stale item whose messageId no longer matches its index and accepts the current Session item. |
| AC-0025-E-2 | [PASS] | Host wiring test asserts only `HarnessSessionView` enables the flag; ChatView and FloatingChatView omit it and therefore reserve no rail column. |
| AC-0025-F-1 (DEVELOP slice) | [PASS] | MessageList makes one primary `scrollToIndex` call and at most one fallback inside bounded catches; subsequent navigation is independent. Runtime measurement fault injection remains SYSTEM_TEST. |

## Constraint Evidence

- `turn-navigation.ts` imports domain types only and has no React, Obsidian or ACP SDK dependency.
- Navigation state is derived from the in-memory `ChatMessage[]`; no transcript read or persistence was added.
- Existing message identity, streaming aggregation and InputArea layout are unchanged.
- No dependency, animation library, Navigator action or Project creation behavior changed.

## Gate Evidence

| Gate | Result |
|------|--------|
| Focused Turn Navigator tests | PASS: 8/8 |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run gate:mr` | PASS: 23 Vitest files / 192 tests; 94.01% V8 lines; turn-navigation 92.00%; importer 9 tests / 90% lines |

## Acceptance Audit

- Projection tests assert exact item identity, ordering, preview content, bounds and stale-target behavior; they
  are not limited to non-throwing execution.
- No test is skipped. Obsidian tooltip placement, focus traversal, live virtualizer geometry, animation timing,
  streaming stability and theme screenshots are explicitly assigned to SYSTEM_TEST.
- The diff matches the AC slice: one pure projection service, one rail component, MessageList/host wiring, CSS
  and focused tests. Session creation, action menus and importer files are outside the implementation commit.

## Associated Commit

- `d3af942` `feat(session): implement AC-0025 Turn Navigator`
