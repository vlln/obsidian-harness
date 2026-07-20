---
title: Plan-0015-01: Remove Prompt Injection
description: Remove Obsidian Markdown prompt injection from settings and prompt preparation.
type: plan
status: done
created: 2026-07-18T17:08:36Z
---

# Plan-0015-01: Remove Prompt Injection

## Context

Prompt injection currently inserts Obsidian formatting instructions into the first user prompt. ACP session replay returns those injected blocks as user message text, which pollutes restored conversation display.

## Scope

1. Remove prompt injection settings from persisted settings and settings UI.
2. Remove prompt injection construction from prompt preparation.
3. Remove send-path wiring for prompt injection.
4. Update tests and documentation references.

## Verification

- Search confirms no `obsidian_system_instruction` or prompt injection setting remains in runtime code.
- TypeScript, lint, unit tests, build, and E2E gates.
