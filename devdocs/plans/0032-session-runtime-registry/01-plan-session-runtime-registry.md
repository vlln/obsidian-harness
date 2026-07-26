---
title: Plan-0032-01: Session Runtime Registry
description: Add an entryId/viewId runtime-status registry and register every ChatPanel host without coupling it to view container interfaces.
type: plan
status: done
created: 2026-07-26T05:39:33Z
---

# Plan-0032-01: Session Runtime Registry

## Context

ADR-0010 requires every ChatPanel host to publish transient status by `entryId + viewId`. The existing
ChatViewRegistry only covers container behavior and does not include HarnessSessionView, so it cannot be the
source for Session Navigator row status.

## Request

Add a narrow SessionRuntimeRegistry beside ChatViewRegistry and wire ChatPanel mount/status/unmount to it.

## Output Format

- Stable subscribe/getSnapshot service API with one merged status per entryId.
- Deterministic priority: permission > error > busy > ready > disconnected.
- ChatPanel registration for ChatView, FloatingChatView and HarnessSessionView through the shared component.
- Vitest coverage for normal, boundary, orphan, multiple-view and cleanup behavior.
- Complete Report with AC-0019-B-2 and ADR-0010 constraint evidence.

## Constraints

- Do not implement SessionCatalogService, SessionStorage reconciliation or Session Navigator UI.
- Do not add React, Obsidian view-class or ACP SDK imports to the registry service.
- Do not persist runtime state, title or entryFile.
- Preserve existing ChatViewRegistry APIs and multi-view behavior.
- Do not add dependencies or touch importer files.

## Checkpoint

Stop if status cannot be derived without importing React/ACP SDK, if ChatPanel cleanup can leave a stale
entryId after unmount, or if wiring changes existing view focus/broadcast semantics.

## Steps

1. Write failing Vitest cases for registration, priority merge, update, orphan removal, stable snapshot and clear.
2. Implement SessionRuntimeRegistry in the existing service boundary.
3. Add the registry to plugin lifecycle and clear it on unload.
4. Register/update/unregister runtime state from ChatPanel using entryId and viewId.
5. Run focused tests, lint, build and MR gate; write Report and mark the Plan done.
