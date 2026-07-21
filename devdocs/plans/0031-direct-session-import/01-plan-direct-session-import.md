---
title: Plan-0031-01: Direct Session Import
description: Remove the unnecessary import protocol and make the companion skill write standard read-only v2 sessions directly.
type: plan
status: pending
created: 2026-07-21T05:30:00Z
---

# Plan-0031-01: Direct Session Import

## Request

Keep the four private source adapters, but replace inspect/report/bundle output with one direct
conversion command that produces a standard Obsidian Harness session.

## Constraints

- No `.harness-import`, conversion report, receipt, materializer, confirmation UI or ACP binding.
- Preserve all source semantics representable by v2 turns; ignore non-semantic telemetry.
- Keep external schemas out of plugin `src/` and project routing out of the converter.
- Do not preserve compatibility with the unshipped bundle CLI.

## Steps

1. Replace bundle-oriented tests with direct session writer and reader compatibility tests.
2. Simplify converter state and CLI around one import operation.
3. Remove obsolete bundle contract fixtures and E2E infrastructure.
4. Update the companion skill instructions and run project gates.
