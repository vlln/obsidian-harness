---
title: Report-0015-01: Remove Prompt Injection
description: Implementation report for removing Obsidian prompt injection.
type: report
status: complete
created: 2026-07-18T17:08:36Z
---

# Report-0015-01: Remove Prompt Injection

## Summary

Removed the Obsidian Markdown prompt injection feature from runtime settings, settings UI, and prompt preparation.

## Changes

- Removed `promptInjection` from plugin settings and default settings.
- Removed prompt injection normalization from settings load.
- Removed the Prompt injection settings section.
- Removed Obsidian system instruction construction from both embedded-context and text-context prompt paths.
- Removed send-path wiring that passed prompt injection options to `preparePrompt`.

## Gates

- Runtime search for `obsidian_system_instruction` / `promptInjection` [PASS]
- `npx tsc --noEmit --skipLibCheck` [PASS]
- `npm run lint` [PASS]
- `npm test` [PASS] 85 tests
- `npm run build` [PASS]
- `npm run test:e2e` [PASS] 8 tests
