---
title: Report-0024-01: Show Current Model Option
description: Implementation report for showing single ACP model options.
type: report
status: complete
created: 2026-07-18T19:15:00Z
---

# Report-0024-01: Show Current Model Option

## Summary

Validated `pi-acp` directly through ACP. It returns a single `category: "model"` option for `blsc/DeepSeek-V4-Flash` and a multi-option `thought_level` selector. The composer now keeps the single current model visible instead of filtering it out.

## Changes

- Show `model` config options when at least one option exists.
- Disable single-choice menu entries while still showing their checked state.
- Keep `model_config` and `thought_level` controls hidden unless they offer multiple values.

## Gates

- Direct `pi-acp` ACP probe [PASS]
- `npx tsc --noEmit --skipLibCheck` [PASS]
- `npm run lint` [PASS]
- `npm test` [PASS] 89 tests
- `npm run build` [PASS]
