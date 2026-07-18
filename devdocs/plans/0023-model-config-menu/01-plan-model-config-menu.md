---
title: Plan-0023-01: Model Config Menu
description: Present ACP model-related configuration through one compact composer control.
type: plan
status: done
created: 2026-07-18T19:30:00Z
---

# Plan-0023-01: Model Config Menu

## Objective

Make the composer model control feel like a single Codex-style configuration entry while staying driven by ACP `configOptions`.

## Scope

- Group `category: "model"` and `category: "model_config"` select options in one model menu.
- Keep the unconnected-state lazy preparation behavior.
- Keep unrelated config selectors from crowding the composer.
- Preserve legacy mode selector behavior when ACP config options are absent.

## Verification

- TypeScript check.
- Lint.
- Unit tests.
- Build.
- E2E plugin-load tests.
