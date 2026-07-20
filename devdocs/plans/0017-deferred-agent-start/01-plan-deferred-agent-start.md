---
title: Plan-0017-01: Deferred Agent Start
description: Start backend sessions on first send while keeping new .session entries selectable before connection.
type: plan
status: done
created: 2026-07-18T17:50:00Z
---

# Plan-0017-01: Deferred Agent Start

## Objective

Improve the new session entry flow so a newly opened `.session` file can choose an agent before any backend connection is created.

## Scope

- Keep newly opened empty session entries file-backed without immediately connecting to an ACP backend.
- Allow agent selection while the entry is not connected.
- Start the selected backend and create the ACP session immediately before sending the first message.
- Simplify the sidebar header by removing redundant direct action buttons.

## Verification

- TypeScript check.
- Unit tests for lifecycle helper behavior.
- Build gate.
- E2E plugin-load regression coverage.
