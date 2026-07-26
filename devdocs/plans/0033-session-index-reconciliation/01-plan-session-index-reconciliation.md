---
title: Plan-0033-01: Session Index Reconciliation
description: Make session index mutations serialized and idempotent, reconcile valid entry create/rename events, and expose index mutation notifications without implementing the Catalog.
type: plan
status: done
created: 2026-07-26T09:00:00Z
---

# Plan-0033-01: Session Index Reconciliation

## Context

ADR-0010 keeps `.session` files authoritative while using `session_index.jsonl` for discovery. Existing index
writes append rows independently, so duplicate materialization or concurrent lifecycle events can leave repeated
or stale mappings that a future SessionCatalogService cannot safely project.

## Request

Add a serialized, idempotent SessionStorage reconciliation path keyed by `entryId`, notify subscribers after
successful index mutations, and invoke reconciliation for valid `.session` create and rename vault events.

## Output Format

- A reconciliation result that distinguishes changed, unchanged and conflicting mappings.
- Exactly one canonical index row for a reconciled entry, with `.session` identity fields and current entryFile.
- Conflict protection when one entryId points to two different entry files that both still exist.
- Stable subscribe/unsubscribe access through SessionStorage and SettingsService.
- Plugin lifecycle handlers that parse valid `.session` create/rename events and delegate reconciliation.
- Vitest coverage for normal, duplicate, rename, concurrent, conflict, malformed and failure behavior.
- Complete Report with AC-0018-N-1 and ADR-0010 AR-010-10 evidence.

## Constraints

- Do not implement SessionCatalogService, Catalog snapshots, search, Projects/Recents or Navigator UI.
- Do not scan the vault for Session discovery; only inspect paths already involved in reconciliation.
- Do not overwrite an existing distinct `.session` identity conflict or modify either entry file.
- Preserve malformed index-line tolerance and existing delete cascade behavior.
- Do not add dependencies or touch importer files.
- Keep services free of React imports and ACP SDK imports confined to `src/acp/`.

## Checkpoint

Stop if reconciliation requires treating index metadata as authoritative, if an identity conflict cannot be
reported without overwriting a live mapping, or if vault event integration would recursively rewrite `.session`
files.

## Steps

1. Write failing storage tests for idempotent upsert, duplicate collapse, rename repair, serialization, conflict
   protection, mutation notification and write failure.
2. Implement serialized SessionStorage index mutations and reconciliation with an explicit conflict result.
3. Expose reconciliation and subscription through SettingsService.
4. Write failing plugin lifecycle tests for valid create/rename and invalid/non-session event filtering.
5. Register create/rename handlers that parse `.session` data and delegate reconciliation; retain delete cleanup.
6. Run focused tests and the MR gate; write the Report, audit AC evidence, and mark the Plan done.
