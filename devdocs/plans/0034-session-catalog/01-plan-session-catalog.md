---
title: Plan-0034-01: Session Catalog
description: Build the plugin-lifetime immutable Session Catalog projection with bounded entry reads, event coalescing, runtime/selection merging, and last-good failure recovery.
type: plan
status: done
created: 2026-07-26T09:30:00Z
---

# Plan-0034-01: Session Catalog

## Context

Plan-0033 made the discovery index serial, reconcilable and observable. ADR-0010 now requires one shared read
model that validates each discovered `.session`, treats it as metadata authority, and merges runtime and active
workspace state without making SessionManagerView read storage directly.

## Request

Implement a plugin-lifetime SessionCatalogService that publishes deterministic immutable snapshots and responds
to index, `.session`, runtime and active-file events with the refresh behavior frozen in ADR-0010.

## Output Format

- Typed Catalog item, project, issue and snapshot contracts with loading/ready/error phases.
- Index discovery plus authoritative `.session` parsing and identity validation.
- Bounded entry read concurrency (default 16), generation-safe async refresh and last-good retention.
- Projects and Recents sorted by updatedAt with stable entryFile tie-breaking.
- Shortest unique path suffixes for Projects sharing a cwd basename.
- Runtime status and active FileView projection without additional disk reads.
- 50 ms coalescing for entry/index event bursts and plugin-lifecycle subscription cleanup.
- Vitest coverage for AC-0017/0018/0019 Catalog-owned normal, boundary, error and failure behavior.

## Constraints

- Do not implement or restyle SessionManagerView; Navigator rendering and interaction remain Plan-0035.
- Do not persist Catalog items, Projects, Recents, issues, runtime state or selected state.
- Do not scan the vault; index remains the only discovery source.
- Do not use index title/agent/timestamps as display metadata.
- Do not let one missing or damaged entry fail the remaining Catalog.
- Keep the service free of React and ACP SDK imports; do not add dependencies or touch importer files.

## Checkpoint

Stop if a refresh can replace a newer snapshot, if runtime/selection changes require rereading disk, if refresh
failure discards the last successful items, or if same-basename Projects cannot be distinguished deterministically.

## Steps

1. Write failing tests for authoritative loading, sorting, duplicate/conflict handling, issues and immutable snapshots.
2. Add race, bounded-concurrency, last-good and 50 ms fake-timer tests.
3. Add runtime/orphan/selection tests proving zero additional storage reads.
4. Implement Catalog types and SessionCatalogService using injected storage/event ports.
5. Instantiate, start and dispose the Catalog in plugin lifecycle with filtered vault/workspace subscriptions.
6. Run focused tests and the MR gate; write the Report, audit owned AC evidence, and mark the Plan done.
