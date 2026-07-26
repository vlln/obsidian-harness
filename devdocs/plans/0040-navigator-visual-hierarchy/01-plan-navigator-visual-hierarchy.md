---
title: Plan-0040-01: Navigator Visual Hierarchy
description: Distinguish static Projects/Recents labels, interactive Show more commands and selectable Project/Session rows with contract-driven typography, color, alignment and hover behavior.
type: plan
status: pending
created: 2026-07-26T11:59:42Z
---

# Plan-0040-01: Navigator Visual Hierarchy

## Context

BL-0002 and Spec-0006 v2 require visible role separation inside the compact Session Navigator. Obsidian's
button defaults currently override the low-specificity Show more color, while Projects/Recents differ too
subtly from selectable rows. The result makes static structure, expansion commands and Session content appear
to share one interaction role.

## Request

Implement AC-0023 without changing Navigator structure, Catalog behavior or Session lifecycle semantics.

## Output Format

- Static Projects/Recents labels at 11 px, `--text-faint`, semibold, noninteractive and without pointer hover.
- Interactive Show more commands at 11 px, `--text-muted`, medium and left-aligned; hover promotes text to
  `--text-normal` while retaining the existing list hover background.
- Project/Session rows retain normal UI-small text and remain visually stronger than structural controls.
- Vitest source-boundary assertions that prove dedicated selector specificity and role declarations.
- WDIO AC-0023 scenarios for computed styles, noninteractive labels, widths, hover behavior and collapsed or
  missing theme colors, plus refreshed 260/420 px light/dark screenshots in SYSTEM_TEST.

## Constraints

- Do not change React structure, Catalog/runtime state, commands, persistence, dependencies or public types.
- Use only Obsidian CSS variables; no hard-coded theme colors, gradients, cards or letter-spacing changes.
- Do not make static section labels focusable or clickable.
- Do not weaken existing 32 px Session rows, 18 px status slots, selected state or responsive screenshot checks.
- Do not execute WDIO or regenerate committed screenshots during DEVELOP.
- Do not touch importer files.

## Checkpoint

Stop if the hierarchy needs new JSX roles, a new styling dependency, global Obsidian button overrides, or any
selector outside the Session Navigator ownership boundary.

## Steps

1. Add failing Vitest CSS-boundary assertions for exact label and Show more role declarations and specificity.
2. Implement the scoped CSS rules for AC-0023-N-1/B-1/F-1 and make the focused test green.
3. Add but do not execute WDIO computed-style, hover, noninteraction and theme-fault scenarios for SYSTEM_TEST.
4. Run lint, build and the isolated MR gate; write the Report and run the submission gate.
5. Merge the feature branch to `develop`, advance to SYSTEM_TEST and run only the new WDIO/visual layer there.
