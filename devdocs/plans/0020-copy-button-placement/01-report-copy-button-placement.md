---
title: Report-0020-01: Copy Button Placement
description: Implementation report for message and code block copy action placement.
type: report
status: complete
created: 2026-07-18T18:45:00Z
---

# Report-0020-01: Copy Button Placement

## Summary

Copy actions now follow message context: user messages show the action below the bubble on the right, assistant messages show it below the response on the left, and code blocks expose their own top-right copy action.

## Changes

- Split message rendering into a frame, content body, and action row.
- Styled user and assistant message action rows independently.
- Added copy buttons to rendered Markdown code blocks after Obsidian Markdown rendering.
- Positioned code block copy buttons at the top-right of each code block.

## Gates

- `npx tsc --noEmit --skipLibCheck` [PASS]
- `npm run lint` [PASS]
- `npm test` [PASS] 89 tests
- `npm run build` [PASS]
- `npm run test:e2e` [PASS] 9 tests
