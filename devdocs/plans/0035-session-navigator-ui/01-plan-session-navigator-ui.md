---
title: Plan-0035-01: Session Navigator UI
description: Replace SessionManagerView with the Codex-style Harness Navigator and add current-entry lifecycle commands while preserving Catalog ownership and Obsidian file semantics.
type: plan
status: done
created: 2026-07-26T10:00:00Z
---

# Plan-0035-01: Session Navigator UI

## Context

Plan-0034 provides the shared authoritative Catalog. The existing SessionManagerView still renders separate
Active Sessions and Session Files lists, reads the index itself, and lacks search, Projects/Recents structure,
fixed right-side runtime status and required lifecycle menus.

## Request

Replace the existing view with the Codex-style Harness Session Navigator frozen in Spec-0006 and route every
row action through a current Catalog entry lookup.

## Output Format

- Header `Harness` with search toggle, `New session`, Projects and Recents; no Active section.
- First 5 Projects and 12 Recents with independent Show more controls.
- Expandable Project rows and flat deduplicated search over all specified fields.
- Session rows with title truncation, selected background, keyboard activation and fixed right status slot.
- Menus for Open, Reveal in file explorer, Rename and Delete.
- Rename that preserves entryId/historyId, checks target collision and updates authoritative title.
- Delete confirmation through Obsidian file manager and recoverable trash semantics.
- Loading, empty, issue and retry states plus compact responsive Obsidian-variable CSS.
- Vitest coverage for view-model search/limits/path validation and lifecycle source wiring.

## Constraints

- React must consume only `sessionCatalog` snapshots; do not read index, `.session` or viewRegistry in UI.
- Do not add an Active Sessions section, cards, gradients, large headings or explanatory onboarding copy.
- Do not cache stale entryFile paths for command execution; resolve by entryId immediately before each action.
- Do not use innerHTML/outerHTML, inline JS styles, manual SVG or new dependencies.
- Do not run WDIO, screenshots, visual regression or performance tests during DEVELOP; defer them to SYSTEM_TEST.
- Do not touch importer files.

## Checkpoint

Stop if Session rows shift when status appears, search duplicates Projects/Recents results, delete bypasses explicit
confirmation/recoverable trash, or any UI callback acts on an entryFile captured before the command begins.

## Steps

1. Write failing pure-model tests for search normalization, Project display lookup, limits and safe rename targets.
2. Implement Navigator model helpers and current-entry plugin commands for open/reveal/rename/delete.
3. Replace SessionManagerView with Catalog subscription, search, sections, rows, menus and accessible states.
4. Replace legacy Session Manager CSS with compact responsive Navigator styles using Obsidian variables.
5. Run focused model tests, lint/build and MR gate; write the Report and mark the Plan done.
6. Leave WDIO fixture, 260/420 px light/dark screenshots and interaction E2E explicitly queued for SYSTEM_TEST.
