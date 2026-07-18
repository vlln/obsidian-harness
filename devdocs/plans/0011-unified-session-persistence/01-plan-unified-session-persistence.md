---
title: Plan-0011-01: Unified Session Persistence
description: Make every session materialize as a vault .session file with JSONL transcript storage.
type: plan
status: pending
created: 2026-07-18T08:29:54Z
---

# Plan-0011-01: Unified Session Persistence

## Context

The current code still has two persistence tracks:

- `.session` files plus `session_index.jsonl` and `sessions/{sessionId}/main.jsonl`
- hidden origin-style `savedSessions[]` metadata and `sessions/{sessionId}.json` full message snapshots

The product contract is a single model:

- every session is recoverable
- every session has a vault-visible `.session` file
- transcript storage remains `sessions/{sessionId}/main.jsonl`
- `session_index.jsonl` is an index, not a second source of truth

## Scope

1. Add a configurable default session folder, defaulting to `Sessions`.
2. Create `.session` files in that folder when a session starts without an explicit `.session` entry.
3. Bind sidebar and floating chat views to the materialized `.session` metadata.
4. Remove hidden full-message persistence APIs and call sites.
5. Keep the existing `session_index.jsonl` and `main.jsonl` layout.

## Verification

- Unit tests for default session file location and settings normalization.
- E2E checks that `Create new .session file` creates under `Sessions/`.
- E2E checks that `Open chat view` materializes a `.session` file.
- Existing `.session` first-open initialization regression remains green.
- Full gates: lint, unit tests, build, E2E.
