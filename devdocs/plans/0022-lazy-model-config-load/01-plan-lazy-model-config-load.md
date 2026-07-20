---
title: Plan-0022-01: Lazy Model Config Load
description: Load ACP session config options when the user opens the model selector.
type: plan
status: done
created: 2026-07-18T19:05:00Z
---

# Plan-0022-01: Lazy Model Config Load

## Objective

Allow users to open model configuration before sending the first message without connecting on session open.

## Scope

- Show a model selector affordance while an entry is still unconnected.
- Prepare the backend session when the model selector is clicked.
- Render ACP-provided model/config options after preparation.
- Keep normal first-message send behavior unchanged.

## Verification

- TypeScript check.
- Lint.
- Unit tests.
- Build.
- E2E plugin-load tests.
