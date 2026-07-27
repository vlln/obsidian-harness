---
title: Report-0047-01: Turn Navigator Responsive Layout
description: SYSTEM_TEST local-bug fix evidence for preserving the full message viewport when the Turn rail is hidden.
type: report
status: complete
created: 2026-07-27T05:11:50Z
---

# Report-0047-01: Turn Navigator Responsive Layout

## Failure Classification

| Finding | Classification | Basis |
|---------|----------------|-------|
| At 260/519 px the Turn rail was hidden but the message viewport collapsed into the first grid track | Local implementation bug | AC-0025 requires the rail to hide below 520 px while retaining the message area. The container query attempted to change the grid container itself, which container queries do not support; the second child was therefore left in an implicit collapsed column. |

The permanent reproduction added `messageWidth` to the WDIO geometry probe. Before the fix, the 260 px shell
reported a 34 px message viewport and failed the expected 260 px assertion. The previously checked offset and
horizontal overflow both remained zero, explaining why the visual defect escaped the earlier geometry check.

## Resolution

The wide layout keeps its explicit 34 px rail plus flexible message column. Below 520 px, the rail remains
hidden and the message viewport is explicitly placed across the full grid. No DOM, breakpoint, virtualizer,
Turn behavior or message-rendering code changed.

## Evidence

| Gate | Result |
|------|--------|
| Failing reproduction before fix | PASS as reproduction: 260 px shell, expected 260 px message viewport, actual 34 px |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npx prettier --check styles.css` | PASS |
| Focused AC-0025 responsive WDIO scenario | PASS: 1/1 |
| Failed v0.5.0 SYSTEM_TEST layer after fix | PASS: `e2e/session-workspace.spec.ts` 5/5 |
| Responsive visual inspection | PASS: 10/10 at 260/519/520/800/1200 px in light and dark themes |

The 260/519 px screenshots show the full message content with no reserved rail space. The 520/800/1200 px
screenshots retain the rail and a correctly sized message viewport. No clipping, overlap or blank collapsed
column remains. Evidence is stored under
[Plan-0045 artifacts](../0045-session-workspace-system-test/artifacts/).

## Associated Commit

- `817bcd7` `fix(session): preserve narrow message viewport`
