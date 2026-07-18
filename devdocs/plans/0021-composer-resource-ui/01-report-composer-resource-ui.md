---
title: Report-0021-01: Composer Resource UI
description: Implementation report for composer resource affordance and control layout.
type: report
status: complete
created: 2026-07-18T18:55:00Z
---

# Report-0021-01: Composer Resource UI

## Summary

Added a Codex-style composer footer with a left-side resource entry point and a right-side model/control cluster.

## Changes

- Added a `+` button to the lower-left composer footer.
- Added a UI-only resource menu with file/folder, current note, and vault search placeholders.
- Grouped usage, model/config selectors, and send button on the lower-right.
- Styled selector controls as compact pill buttons and kept model selection visually prominent.
- Preserved existing send, attachment, mention, and config-change behavior.

## Gates

- `npx tsc --noEmit --skipLibCheck` [PASS]
- `npm run lint` [PASS]
- `npm test` [PASS] 89 tests
- `npm run build` [PASS]
- `npm run test:e2e` [PASS] 9 tests
