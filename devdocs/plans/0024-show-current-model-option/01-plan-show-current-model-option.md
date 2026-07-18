---
title: Plan-0024-01: Show Current Model Option
description: Keep ACP current model visible when the backend exposes only one model option.
type: plan
status: done
created: 2026-07-18T19:15:00Z
---

# Plan-0024-01: Show Current Model Option

## Objective

Show the current ACP model in the composer model menu even when the backend has no alternative models to choose from.

## Scope

- Keep `category: "model"` options visible when they contain at least one option.
- Disable single-choice menu items so they read as current state rather than a change action.
- Keep secondary model-related config controls visible only when there is a real choice.

## Verification

- Direct ACP probe against `pi-acp`.
- TypeScript check.
- Lint.
- Unit tests.
- Build.
