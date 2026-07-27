---
title: Report-0046-01: Preserve Turn Tooltip Accessibility Name
description: SYSTEM_TEST local-bug fix evidence for retaining the Turn ordinal after Obsidian tooltip registration.
type: report
status: complete
created: 2026-07-27T04:55:30Z
---

# Report-0046-01: Preserve Turn Tooltip Accessibility Name

## Failure Classification

| Finding | Classification | Basis |
|---------|----------------|-------|
| Mounted Turn buttons exposed only preview text instead of `Turn <ordinal>: <preview>` | Local implementation bug | The frozen AC and JSX were correct; Obsidian `setTooltip` mutated `aria-label` during the ref callback. DEVELOP source tests did not execute that host behavior. |

## Resolution

`TurnNavigator` now restores the complete accessible name immediately after registering the Obsidian tooltip.
Tooltip content, placement, button identity, navigation and CSS are unchanged.

## Evidence

| Gate | Result |
|------|--------|
| Failing reproduction before fix | PASS as reproduction: mounted labels were `First prompt`, `Second prompt`, `Third prompt` |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Failed SYSTEM_TEST layer after fix | PASS: `e2e/session-workspace.spec.ts` 5/5, including exact ordinal labels, tooltip, jump and responsive geometry |

No test was skipped and no new defect was observed in this layer. The responsive assertion also confirmed that
hidden rails reserve zero horizontal space at 260/519 px, so no speculative CSS change was made.

## Associated Commit

- `4a94494` `fix(session): preserve Turn tooltip aria label`
