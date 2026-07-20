---
title: Plan-0021-01: Composer Resource UI
description: Add a Codex-style resource affordance and consolidate composer controls.
type: plan
status: done
created: 2026-07-18T18:55:00Z
---

# Plan-0021-01: Composer Resource UI

## Objective

Make the composer footer closer to the Codex-style control layout while introducing a visible resource entry point.

## Scope

- Add a left-side `+` action that opens resource menu UI.
- Keep the resource menu as UI-only in this iteration.
- Group model/config selectors and send button on the right.
- Keep existing prompt sending and attachment behavior unchanged.

## Verification

- TypeScript check.
- Lint.
- Unit tests.
- Build.
- E2E plugin-load tests.
