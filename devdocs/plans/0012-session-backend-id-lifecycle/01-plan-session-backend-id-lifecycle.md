---
title: Plan-0012-01: Session Backend ID Lifecycle
description: Separate vault session entry identity from ACP backend session identity.
type: plan
status: done
created: 2026-07-18T15:32:08Z
---

# Plan-0012-01: Session Backend ID Lifecycle

## Context

A `.session` entry has a vault lifecycle and an ACP backend lifecycle. Creating the file produces a vault entry. Connecting to a backend and calling `session/new` produces the backend session ID.

Restore decisions must use backend session identity.

## Scope

1. Add explicit backend session identity to `.session` metadata.
2. Keep the existing `sessionId` field compatible while treating it as the backend ID once connected.
3. Track entry connection state so an unconnected entry does not call `session/load`.
4. Ensure `session/new` success writes the backend ID before later restores.
5. Add regression tests for unconnected entries and connected empty entries.

## Verification

- Unit tests for lifecycle decision helpers.
- E2E regression for command-created session first open and tab restore behavior.
- Full gates: lint, unit tests, build, E2E.
