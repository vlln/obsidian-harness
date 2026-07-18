---
title: Plan-0010-01: Session File Initial Agent Fix
description: Fix command-created .session files that wait forever on first open when agentId is initially empty.
type: plan
status: done
created: 2026-07-18T00:00:00Z
---

# Plan-0010-01: Session File Initial Agent Fix

## Context

User-reported bug:

1. Cmd+P creates a generic `.session` file.
2. The file opens and default pi-acp is selected.
3. The view stays in connecting.
4. Switching away and back makes it connect.

## Root Cause

Generic `.session` files are created with `agentId: ""`. `useAgentSession` already resolves an effective default agent for its initial state, but `ChatPanel` lifecycle decisions only considered `initialAgentId` and `config?.agent`. On first open, the lifecycle returned `wait_for_agent` even though `session.agentId` had the resolved default.

After a tab switch, `shouldPersistResolvedAgentId()` had already written the resolved agent ID back to the `.session` file, so the second mount followed the normal create/restore path.

## Request

Use the resolved session agent as lifecycle fallback for first-open `.session` files with empty `agentId`.

## Constraints

- No new feature scope.
- Do not change ACP semantics.
- Preserve restore behavior when `.session` already has an `agentId`.

## Verification

- Unit regression: `decideInitialSessionLifecycle()` creates with fallback agent for bootstrap `.session` files.
- E2E regression: Cmd+P-created `.session` initializes on first open without tab switching and rewrites the bootstrap session ID to the ACP session ID.
