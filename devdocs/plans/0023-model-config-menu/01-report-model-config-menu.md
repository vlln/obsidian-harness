---
title: Report-0023-01: Model Config Menu
description: Implementation report for the compact ACP model config menu.
type: report
status: complete
created: 2026-07-18T19:05:00Z
---

# Report-0023-01: Model Config Menu

## Summary

The composer now presents ACP model-related configuration through one compact `Model` menu. The menu is driven by ACP `configOptions` categories and keeps lazy backend preparation available before the first message.

## Changes

- Grouped `model`, `model_config`, and `thought_level` select options in the composer model menu.
- Kept the existing click-to-prepare behavior for unconnected session entries.
- Stopped rendering every ACP select option as its own composer control.
- Preserved the legacy mode selector path for agents that do not expose ACP config options.

## Gates

- `npx tsc --noEmit --skipLibCheck` [PASS]
- `npm run lint` [PASS]
- `npm test` [PASS] 89 tests
- `npm run build` [PASS]
- `npm run test:e2e` [PASS] 9 tests
