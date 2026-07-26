---
title: Report-0034-01: Session Catalog
description: Immutable Session Catalog projection evidence for authoritative metadata, deterministic grouping, bounded refresh, runtime selection merging, and last-good recovery.
type: report
status: complete
created: 2026-07-26T09:30:00Z
---

# Report-0034-01: Session Catalog

## Summary

Added a plugin-lifetime SessionCatalogService with immutable loading/ready/error snapshots. The service discovers
candidates only through the index, reads `.session` entries with a default concurrency of 16, rejects identity
conflicts, isolates missing/damaged entries, and publishes sorted Projects and Recents from authoritative entry
metadata. Same-basename Projects use the shortest unique path suffix.

Index and `.session` event bursts coalesce for 50 ms. Generation checks prevent stale async refresh completion,
and an overall refresh failure keeps the last good projection. Runtime and active-file events only reproject the
in-memory items. Plugin unload disposes every Catalog subscription.

## AC Evidence

| Scenario | Result | Evidence |
|----------|--------|----------|
| AC-0018-N-2 | [PASS] | `SessionCatalogService` takes title, agentId, cwd and timestamps only from parsed `.session`; `test/session-catalog.test.ts` supplies a stale index cwd and asserts the authoritative entry value without storage writes. |
| AC-0018-F-1 | [PASS] | A forced later index failure publishes phase=error while retaining the previous items and a retry-visible `refresh_failed` issue. |
| AC-0019-E-1 | [PASS] | An orphan runtime entry is excluded from items/Projects/Recents, leaves existing projection unchanged, and publishes `orphan_runtime` through the debug warning port. |
| AC-0019-F-1 | [PASS] | Runtime snapshot and subscription failures retain the persistent Session with a null status and non-blocking `runtime_unavailable` issues. |
| AC-0017-N-2 / AC-0017-B-2 (Catalog slice) | [PASS] | Tests assert updatedAt ordering, entryFile tie semantics in implementation, and shortest unique `alpha/app` / `beta/app` Project labels; Show more rendering remains Plan-0035. |
| AC-0018-N-1 / AC-0018-E-1 (Catalog slice) | [PASS] | Tests assert 50 ms event coalescing, exact duplicate collapse, conflict prefiltering, and independent missing/damaged/identity issues; live Navigator timing remains Plan-0035 SYSTEM_TEST evidence. |

## Constraint Evidence

- AR-010-01/02: Catalog is an in-memory read model; no Catalog persistence API exists.
- AR-010-05: worker-pool test observes a maximum of 3 configured concurrent reads; race test proves an older
  completion cannot replace a newer snapshot; failure test proves last-good retention.
- AR-010-06: runtime and active-file updates change projected status/selection with the entry read count unchanged.
- AR-010-07: lifecycle source test checks start/dispose wiring; dispose test proves later entry events do not refresh.
- Catalog types contain no imports; Catalog service contains no React or ACP SDK import.

## Gate Evidence

| Gate | Result |
|------|--------|
| Focused Catalog tests | PASS: 9/9 |
| Related Catalog/runtime/storage tests | PASS: 31/31 |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Corrected `npm run gate:mr` | PASS: 18 Vitest files, 149 tests; 93.59% V8 lines overall and 97.59% Catalog lines; 9 Python tests, 90% Python lines |

The first MR gate run exposed that the existing V8 include list omitted the new service. The branch added
`src/services/session-catalog.ts` to that existing list and reran the gate; only the corrected result above is
accepted as evidence.

## Acceptance Audit

- PASS assertions inspect authoritative field values, ordering, immutable references, issue categories, retained
  snapshots, exact read counts, max concurrency and post-dispose behavior.
- No tests are skipped; failures are injected at index, entry, runtime snapshot and runtime subscription boundaries.
- The diff adds only Catalog contracts/service/tests, plugin lifecycle wiring, the runtime status type relocation,
  and one existing coverage include entry. Navigator UI remains unchanged.

## Associated Commits

- `21b2722 feat(session): build catalog for AC-0018`
- `a5aa72c test(session): include catalog coverage`
