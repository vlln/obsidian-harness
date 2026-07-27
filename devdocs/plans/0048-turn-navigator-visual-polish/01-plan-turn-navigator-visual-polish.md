---
title: Plan-0048-01: Turn Navigator Visual Polish
description: Correct host-themed Turn button chrome and replace visible overflow scrollbars with a quiet auto-follow rail.
type: plan
status: done
created: 2026-07-27T05:34:05Z
---

# Plan-0048-01: Turn Navigator Visual Polish

## Context

The v0.5.0 release candidate is functionally correct, but human staging review rejected the Turn rail's visual
quality. Obsidian host button rules expose square controls around the intended markers. With enough user turns,
the rail also shows an independent vertical scrollbar that competes with the message scrollbar.

## Request

Match the quiet Codex navigation language: invisible button chrome, faint idle markers, a compact active marker
and no visible rail scrollbar. Preserve scrolling, keyboard access and tooltips. When the active turn changes,
keep its marker within the rail viewport without moving the message viewport.

## Output Format

- Standalone normal and overflowing design-reference images before implementation.
- Permanent host-runtime assertions for transparent button chrome and hidden scrollbar behavior.
- Minimal CSS and rail-local active-marker following.
- Light/dark runtime screenshots for normal and overflowing rails.
- Complete fix Report suitable for rebuilding the `v0.5.0` release candidate.

## Constraints

- Do not change Turn derivation, message navigation, the 520 px breakpoint or the 24 px click target.
- Do not remove wheel, trackpad, keyboard or programmatic scrolling.
- Do not add a second message scrollbar or custom scrollbar library.
- Respect reduced-motion preferences and Obsidian theme variables.
- Preserve unrelated importer files and their exact diff.

## Checkpoint

Stop if scrollbar removal prevents pointer/keyboard scrolling, or if active-marker following scrolls the message
viewport or an outer Obsidian workspace container.

## Design Extraction

The normal and overflow references establish one quiet component language:

- 28 px visual rail with unchanged 24 px button hit targets.
- Invisible button chrome: no border, fill, shadow or host minimum sizing.
- 5 px faint idle dots and a 3 x 12 px rounded active marker.
- A faint continuous connector preserves AC-0025-N-1 without competing with the markers.
- Hidden scrollbar with a short top/bottom mask to indicate clipped overflow.
- Theme colors only; no fixed light/dark surface colors in the implementation.

References: [normal rail](artifacts/design-normal.png) and
[overflowing rail](artifacts/design-overflow.png).

## Steps

1. Generate and inspect normal/overflow visual references.
2. Add a failing Obsidian runtime reproduction for host chrome and overflow treatment.
3. Harden button reset, marker geometry and visually hidden scrollbar CSS.
4. Keep the active marker visible by changing only the rail's `scrollTop`.
5. Rebuild, rerun the failed layer, inspect runtime screenshots and complete the Report.
