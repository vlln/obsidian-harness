---
title: Plan-0047-01: Turn Navigator Responsive Layout
description: Fix the SYSTEM_TEST regression where hiding the Turn rail leaves the message viewport in a collapsed implicit grid column.
type: plan
status: pending
created: 2026-07-27T05:08:00Z
---

# Plan-0047-01: Turn Navigator Responsive Layout

## Context

The AC-0025 responsive screenshots show that 260 px and 519 px Session views hide the Turn rail but collapse
the message viewport to 34 px. The prior geometry assertion checked only the viewport offset, so it passed even
though most of the shell was blank. The permanent reproduction now asserts the message viewport width and fails
at 260 px with an actual width of 34 px instead of 260 px.

## Failure Classification

This is a local implementation bug. The frozen AC requires the rail to disappear below 520 px while retaining
the usable message area; the CSS instead places the second grid child in a collapsed implicit column after a
container query changes the grid declaration on the container itself.

## Request

Keep the stable rail/message tracks at wide widths and explicitly span the message viewport across the grid
when the rail is hidden, without changing the 520 px threshold, rail width, Turn behavior or message rendering.

## Output Format

- Minimal grid-track CSS correction.
- Permanent responsive geometry assertion covering message width at 260/519/520/800/1200 px.
- Refreshed light/dark visual evidence and a complete fix Report.

## Constraints

- Do not change Turn navigation, virtual scrolling, message layout or responsive thresholds.
- Do not modify frozen Spec, AC or ADR documents.
- Do not rerun SYSTEM_TEST layers that already passed.
- Preserve unrelated importer files and their exact diff.

## Checkpoint

Stop if the fix requires DOM reordering, JavaScript breakpoint handling or changes to the public Turn model.

## Steps

1. Retain the failing width assertion from Plan-0045.
2. Replace the ineffective self-targeting container override with explicit narrow-width placement for the
   message viewport.
3. Rebuild and rerun the failed v0.5 WDIO geometry/visual layer.
4. Inspect all ten responsive screenshots and complete the Report.
