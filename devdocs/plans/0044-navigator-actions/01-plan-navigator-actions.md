---
title: Plan-0044-01: Project and Session Navigator Actions
description: Remove the redundant Session Open menu item and add Project-scoped creation, system file manager and copy-path actions for AC-0026.
type: plan
status: pending
created: 2026-07-27T04:02:00Z
---

# Plan-0044-01: Project and Session Navigator Actions

## Context

Session rows already open by click and Enter/Space, so their menu duplicates Open. Project rows currently use a
single full-width collapse button and expose no directory actions. AC-0026 requires a sibling ellipsis and the
same menu on right click, while preserving the distinction between vault Reveal and a system file manager open.

## Request

Refine Session and Project menus, add testable Project path action coordination and wire the host operations
through plugin commands with precise Notice failures and menu focus restoration.

## Output Format

- A React-free Project action service covering directory availability, system open and clipboard behavior.
- Plugin commands for New session here, Open in system file manager and Copy path.
- A Project row shell with sibling collapse/ellipsis buttons and a shared right-click/ellipsis menu.
- A Session menu containing Reveal, Rename and Delete only while row click/keyboard Open remains intact.
- Vitest N/B/E/F coverage and a complete AC-0026 Report.

## Constraints

- Do not change Catalog persistence, Project grouping or Session entry schemas.
- Do not reuse Session Reveal for Project system open; the destinations and host APIs are intentionally distinct.
- Missing Project directories block New session here and system open but never block Copy path.
- Menu activation must not change Project collapse state; Project ellipsis is a sibling, never nested in a button.
- Preserve Obsidian Menu keyboard traversal/Escape semantics and return focus to the corresponding ellipsis.
- Do not modify Session creation, Turn Navigator, importer files or add dependencies.

## Checkpoint

Stop if desktop system open requires shell command construction instead of Electron's host API, if menu focus
cannot be restored through the existing Obsidian Menu lifecycle, or if Project actions require persistent state.

## Steps

1. Write failing Project action tests for available, missing, host rejection and clipboard-independent behavior.
2. Remove Session Open from the menu while preserving row click and Enter/Space activation.
3. Add the Project row shell, ellipsis/right-click menu and focus restoration.
4. Wire plugin commands to directory validation, SessionCreationModal, Electron shell and clipboard hosts.
5. Run MR gate, audit AC-0026 evidence, complete Report and submit the feature branch.
