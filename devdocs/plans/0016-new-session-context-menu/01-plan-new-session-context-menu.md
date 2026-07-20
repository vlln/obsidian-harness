---
title: Plan-0016-01: New Session Context Menu
description: Add a file explorer context menu item for creating .session files.
type: plan
status: done
created: 2026-07-18T17:24:28Z
---

# Plan-0016-01: New Session Context Menu

## Context

Users create notes and folders directly from the file explorer context menu. Session entries should be just as accessible from the same surface.

## Scope

1. Add `New session` to the file explorer context menu.
2. When invoked on a folder, create the `.session` entry in that folder.
3. When invoked from an unscoped/blank file menu, create the `.session` entry through the default session location.
4. Open the new session after creation.

## Verification

- Unit tests for target folder resolution.
- TypeScript, lint, unit tests, build, and E2E gates.
