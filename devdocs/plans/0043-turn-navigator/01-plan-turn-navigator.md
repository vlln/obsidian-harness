---
title: Plan-0043-01: Per-user-message Turn Navigator
description: Add the user-message projection, responsive rail UI and virtualized message navigation required by AC-0025.
type: plan
status: done
created: 2026-07-27T03:49:00Z
---

# Plan-0043-01: Per-user-message Turn Navigator

## Context

Long `.session` FileViews need a compact left-edge rail with one node per user message, preview text, active
viewport tracking and virtualizer-based jump behavior. Floating chat and the legacy ChatView must remain unchanged.

## Request

Implement AC-0025 as a pure `ChatMessage[]` projection plus an accessible TurnNavigator rendered only by the
`.session` MessageList host, with responsive hiding and reduced-motion-aware `scrollToIndex` navigation.

## Output Format

- `src/services/turn-navigation.ts` with deterministic user-only items and safe 160-character previews.
- `src/ui/TurnNavigator.tsx` with fixed-size buttons, previews and active state.
- MessageList integration for active item derivation, RAF batching and virtualizer jumps.
- A host flag wired only by HarnessSessionView/ChatPanel for `.session` FileViews.
- Vitest N/B/E/F coverage and complete AC-0025 Report.

## Constraints

- Do not read transcript files or persist navigation state.
- Do not add an animation library or dependency; use CSS and reduced-motion media queries.
- Do not render the rail in FloatingChatView or legacy ChatView.
- Do not let rail state alter message identity, streaming aggregation or InputArea width.
- Keep projection code React-free and do not expose base64/full resource URIs in previews.
- Do not modify Navigator action menus or Project creation behavior.

## Checkpoint

Stop if active tracking requires a second message truth, if virtualizer navigation cannot preserve messageId
identity across Session changes, or if the rail cannot hide below 520 px without changing InputArea geometry.

## Steps

1. Write failing projection tests for user-only nodes, preview safety, attachment fallback and 500 messages.
2. Expose the minimal virtualizer navigation/visible-range state required by a colocated rail.
3. Implement TurnNavigator accessibility, hover/focus preview, active state and responsive CSS.
4. Wire the `.session` host flag without affecting other ChatPanel hosts.
5. Run MR gate, audit AC-0025 evidence, complete Report and submit the feature branch.
