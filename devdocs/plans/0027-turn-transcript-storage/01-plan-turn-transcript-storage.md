---
title: Plan-0027-01: Turn Transcript Storage
description: Replace raw SessionUpdate persistence with v2 manifest, immutable TurnRecord JSONL, atomic checkpoint and content-addressed blob storage.
type: plan
status: pending
created: 2026-07-20T11:17:04Z
---

# Plan-0027-01: Turn Transcript Storage

## Context

Plan 0026 supplies the semantic record model. SessionStorage currently writes v1 raw events under backend session IDs and must be replaced by historyId-addressed v2 storage.

## Request

Implement the ADR-0005 storage transaction, schema gate, corruption diagnostics, checkpoint recovery and large-content blob references.

## Output Format

- v2 SessionStorage APIs for manifest, completed turns, active checkpoints and blobs.
- Recorder integration at the ACP Client boundary using a stable historyId.
- Persistent storage health/errors observable by the UI layer.
- Unit and integration tests for AC-0009, AC-0012 and AC-0013.
- Complete execution Report with coverage and fault-injection evidence.

## Constraints

- Do not read, migrate or project v1 history.
- Blob commit precedes any TurnRecord that references it.
- Checkpoint replacement uses sibling temp + rename and never appends chunks.
- Duplicate turnId and stale checkpoint recovery are idempotent.
- A failed write keeps the in-memory aggregate/checkpoint retryable and never reports persistence success.

## Checkpoint

Stop if the Obsidian DataAdapter cannot provide the required temp-write/rename semantics; classify whether a revised atomicity rule requires DESIGN or only an implementation adjustment.

## Steps

1. Write storage tests with MemoryDataAdapter failures and corruption fixtures.
2. Replace v1 SessionStorage methods and SettingsService port.
3. Implement checkpoint, commit ordering, blob hashing and reader diagnostics.
4. Connect the ACP Client recorder to prompt/update/completion/cancel/error boundaries.
5. Run MR gate and record evidence.
