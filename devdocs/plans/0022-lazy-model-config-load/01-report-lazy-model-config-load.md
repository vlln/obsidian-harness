---
title: Report-0022-01: Lazy Model Config Load
description: Implementation report for lazy ACP model config loading.
type: report
status: complete
created: 2026-07-18T19:05:00Z
---

# Report-0022-01: Lazy Model Config Load

## Summary

Added lazy ACP config loading from the composer model control. Empty session entries still do not connect on open, but opening the model selector can now prepare the backend session and display ACP-provided model options.

## Changes

- Added an unconnected-state `Model` control in the composer footer.
- Clicking the control creates the backend session through the existing session lifecycle path.
- The model menu opens from returned `configOptions` when the backend exposes a `category: "model"` select option.
- If the backend has no model selector, the menu reports that no model options were provided.
- Existing first-message send behavior remains unchanged.

## Gates

- `npx tsc --noEmit --skipLibCheck` [PASS]
- `npm run lint` [PASS]
- `npm test` [PASS] 89 tests
- `npm run build` [PASS]
- `npm run test:e2e` [PASS] 9 tests
