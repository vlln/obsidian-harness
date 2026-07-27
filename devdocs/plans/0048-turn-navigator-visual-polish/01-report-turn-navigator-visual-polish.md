---
title: Report-0048-01: Turn Navigator Visual Polish
description: Release-staging fix evidence for quiet Turn markers, hidden overflow scrollbars and rail-local active following.
type: report
status: complete
created: 2026-07-27T05:57:59Z
---

# Report-0048-01: Turn Navigator Visual Polish

## Failure Classification

| Finding | Classification | Basis |
|---------|----------------|-------|
| Turn markers rendered inside white square controls with multiple shadows | Local implementation bug | Plugin selectors lost to Obsidian host button rules, so the runtime did not match the intended transparent control styling or human staging acceptance. |
| A 48-turn rail displayed its own scrollbar and did not follow a distant active marker | Local implementation bug | Overflow remained functionally scrollable, but the rail exposed `scrollbar-width: auto`, a visible WebKit scrollbar and no active-marker visibility behavior. |

Both findings were discovered during human review of the `v0.5.0` release candidate. The frozen Turn derivation,
breakpoint, message navigation and continuous connector contract remain valid.

## Image-First Design Evidence

The visual workflow first generated standalone [normal](artifacts/design-normal.png) and
[overflow](artifacts/design-overflow.png) component references. Extraction established transparent 24 px button
targets, 5 px faint idle dots, a 3 x 12 px active marker, a subdued continuous connector, visually hidden
scrollbars and short edge fading. The continuous line was retained to satisfy AC-0025-N-1.

## Failing Reproduction

The permanent 48-turn Obsidian runtime scenario recorded the following pre-fix state:

- Button background `rgb(255, 255, 255)` with five host box-shadow layers.
- Idle marker `7 x 7 px`; active marker `11 x 11 px`.
- Overflow present with `scrollbar-width: auto` and WebKit scrollbar `display: block`.
- No mask; activating a distant turn changed current state but left rail `scrollTop` at zero.

## Resolution

- A scoped high-specificity reset removes host fill, shadow, minimum sizing and border radius without changing
  the 24 px semantic button target.
- Idle and active markers now use the extracted geometry and Obsidian theme variables; the connector remains at
  0.55 opacity and focus retains a visible marker halo.
- Firefox and WebKit scrollbar paths are hidden while `overflow-y: auto` preserves wheel, trackpad, keyboard and
  programmatic scrolling.
- A top/bottom mask indicates clipped rail content. When current turn changes, `TurnNavigator` compares marker
  and rail rectangles and scrolls only the rail; reduced-motion mode uses immediate movement.

## Evidence

| Gate | Result |
|------|--------|
| Failing Obsidian runtime reproduction | PASS as reproduction: all host chrome and overflow defects observed |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Focused 48-turn runtime scenario | PASS: 1/1 |
| Complete v0.5.0 workspace regression | PASS: 6/6, 12.8 s |
| Runtime visual inspection | PASS: 4/4 normal/overflow in light and dark themes |

The runtime images [normal light](artifacts/runtime-normal-light.png),
[normal dark](artifacts/runtime-normal-dark.png), [overflow light](artifacts/runtime-overflow-light.png) and
[overflow dark](artifacts/runtime-overflow-dark.png) show no square button chrome or independent rail scrollbar.
The message scrollbar remains visible and separate. Long-rail markers fade at the edges and the active marker
remains visible after distant navigation.

The unrelated importer diff was untouched; its checksum remained
`503b454b6eba2f983fbabb897dd69ffc424e5ea649c059fdd17a61c5a4fd2163`.

## Associated Commit

- `dd776ca` `fix(session): polish Turn Navigator rail`

## Release Impact

The earlier `release/v0.5.0` candidate is stale. It must be rebuilt from `develop` after this fix merges; no
production merge, tag or GitHub Release was performed from the rejected candidate.
