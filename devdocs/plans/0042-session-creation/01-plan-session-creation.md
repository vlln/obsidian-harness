---
title: Plan-0042-01: Project-aware Session Creation
description: Add Project directory rules, a Codex-style creation modal and serialized materialization compensation for AC-0024.
type: plan
status: done
created: 2026-07-27T03:22:00Z
---

# Plan-0042-01: Project-aware Session Creation

## Context

Spec-0007 replaces the Navigator's immediate Session creation with a confirmation modal. The modal either
selects one existing non-root directory or derives `~/Documents/<projectName>`, while the lifecycle must publish
manifest, `.session` and index atomically enough to prevent reconciliation from recreating failed entries.

## Request

Implement AC-0024 through pure directory rules, a focused Obsidian modal and a serialized Session Entry
Lifecycle transaction with exact compensation and actionable failure state.

## Output Format

- `src/services/project-directory.ts` pure validation/target derivation with cross-platform tests.
- `src/ui/SessionCreationModal.ts` with one source directory, effective cwd preview and keyboard-safe form state.
- A plugin lifecycle API that opens the modal and materializes manifest → `.session` → confirmed index.
- Precise compensation for transcript, entry and index artifacts without deleting cwd.
- Vitest tests for N/B/E/F AC-0024 behavior and an E2E-ready DOM/host seam.
- Complete Report mapping every AC-0024 scenario to tests and commits.

## Constraints

- Do not implement Turn Navigator or Project/Session action menus; 0043/0044 own those surfaces.
- Preserve Spec-0001 callers that omit cwd; only modal-driven creation supplies the new effective cwd.
- Do not add dependencies, persistence schema or a persistent Project entity.
- Keep path rules and transaction coordination out of React UI; `src/services/` must not import React.
- Never recursively delete cwd or user project contents during compensation.
- In `SessionManagerView.tsx`, touch only the global `New session` callback needed to open this modal; 0044 owns row menus.
- Preserve unrelated importer files and all v0.4.0 Session entry commands.

## Checkpoint

Stop if Electron cannot provide a single-directory picker without a new dependency, if SessionStorage cannot
support idempotent exact cleanup, or if preventing create reconciliation requires changing ADR-0010 rather than
serializing the existing lifecycle. Stop before merge if any failure can leave an unreported artifact or delete cwd.

## Steps

1. Write failing unit tests for default/selected targets, invalid names, root detection and existing targets.
2. Add transaction tests for fixed write order, duplicate submit, each failure stage and compensation races.
3. Implement pure directory rules and the serialized lifecycle/storage cleanup primitives.
4. Implement SessionCreationModal and wire Navigator New session to open it without eager writes.
5. Add focused UI/state tests, run MR gate, complete Report and submit the feature branch.
