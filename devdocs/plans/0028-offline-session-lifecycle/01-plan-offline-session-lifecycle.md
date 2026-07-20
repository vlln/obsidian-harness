---
title: Plan-0028-01: Offline Session Lifecycle
description: Implement v2 entry identities, offline-first history rendering, explicit continuation states, and no implicit ACP startup or new session fallback.
type: plan
status: done
created: 2026-07-20T11:17:04Z
---

# Plan-0028-01: Offline Session Lifecycle

## Context

Plans 0026 and 0027 provide an authoritative local transcript. The current ChatPanel restores ACP immediately on open and the E1 experiment models imported history as a backend state; both conflict with Spec-0004.

## Request

Make `.session` version 2 the stable entry for entryId/historyId and optional ACP binding. Render local history before any continuation action and expose resumable, backend unavailable, read-only and restoring states in the workspace.

## Output Format

- Version 2 `.session` creation, parsing, indexing and cleanup by stable local identities.
- Offline transcript loading and projection with persistent diagnostics.
- Explicit Continue/New session commands and composer state; opening never starts an Agent.
- Removal of the E1 `backendState: imported` model and raw-history projection path.
- Unit, component and Obsidian E2E evidence for AC-0007, AC-0010 and AC-0011.

## Constraints

- Do not support v1 entry/history formats.
- Do not infer backend availability from history presence.
- Resume failure must preserve entryId/historyId/acpSessionId and never call newSession.
- Cwd absence affects continuation only, not local reading.
- Workspace status must be visible without relying on transient Notice or logs.

## Checkpoint

Stop if local transcript rendering still requires Agent initialization, or if an existing lifecycle path can create a backend session without an explicit user send/new action.

## Steps

1. Write lifecycle and entry schema tests, including no-spawn assertions.
2. Replace SessionFileData and all entry materialization/writeback consumers.
3. Load and project transcript before constructing continuation actions.
4. Add workspace states and explicit continuation controls.
5. Add offline/corruption/version E2E coverage and run the manual-vault regression path.
6. Run MR and submission gates and record all 29 AC scenario outcomes.
