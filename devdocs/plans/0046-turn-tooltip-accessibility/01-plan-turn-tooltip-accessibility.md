---
title: Plan-0046-01: Preserve Turn Tooltip Accessibility Name
description: Fix the SYSTEM_TEST regression where Obsidian tooltip registration overwrites the Turn node ordinal in aria-label.
type: plan
status: pending
created: 2026-07-27T04:53:40Z
---

# Plan-0046-01: Preserve Turn Tooltip Accessibility Name

## Context

The AC-0025-N-1 WDIO reproduction reads three mounted Turn buttons and receives only each preview as the
accessible name. `TurnNavigator` supplies `Turn <ordinal>: <preview>` in JSX, but Obsidian `setTooltip` replaces
that attribute during the ref callback.

## Request

Preserve the full ordinal-plus-preview accessible name after registering the viewport-aware tooltip, without
changing tooltip text, node identity, navigation or layout.

## Output Format

- Minimal `TurnNavigator` fix.
- Existing failing WDIO assertion green from the failed SYSTEM_TEST layer.
- Complete fix Report with failure classification and associated commit.

## Constraints

- Do not replace Obsidian tooltip positioning or add dependencies.
- Do not change projection, scrolling, CSS, Session data or other AC behavior.
- Do not rerun already-passed SYSTEM_TEST layers.

## Checkpoint

Stop if preserving the label requires replacing the tooltip API or changing the public TurnNavigationItem model.

## Steps

1. Retain the failing AC-0025-N-1 E2E assertion from Plan-0045.
2. Restore the complete aria-label immediately after tooltip registration.
3. Run lint/build, merge the fix and restart the v0.5 WDIO layer from its failure.
