---
title: Plan-0029-01: Session Importer Test Infrastructure
description: Build the shared contract vectors, Python/Vitest coverage gates, fault-injection support, sanitized adapter fixture layout, and generic Obsidian E2E helpers required by AC-0004.
type: plan
status: done
created: 2026-07-20T13:46:13Z
---

# Plan-0029-01: Session Importer Test Infrastructure

## Context

Spec-0005, AC-0004, ADR-0006, ADR-0007 and Interface-0001 are frozen. Existing Vitest, WDIO, memory adapter, V8 coverage, GitHub Actions and submission gate remain authoritative. This plan adds only the reusable infrastructure required for a Python converter and generic TypeScript materializer.

## Request

Provide deterministic, privacy-safe test infrastructure for DEVELOP plans implementing the importer skill and plugin materializer.

## Output Format

- A valid `skills/harness-session-importer/` skill skeleton with test-only dependency metadata and empty proprietary implementation surface.
- Shared RFC 8785/identity/digest contract vector format consumable by Python and TypeScript.
- Sanitized source fixture directories for Claude, Codex, Pi and Kimi with fixture lint guardrails.
- Python unittest/coverage entry points and TypeScript importer coverage include configuration.
- Fault-injectable storage helpers with named operation logs and reload support.
- Generic `.harness-import` E2E materialization helpers that do not parse private formats or reuse production materializer code.
- MR/submission gate extensions and positive/negative proof in a complete Report.

## Constraints

- Do not implement private source adapters, JCS business implementation, bundle writer, validator, materializer, receipt reader, transaction recovery or import UI.
- Do not add real session records, user prompts, home paths, credentials, large outputs or network-dependent fixtures.
- Keep Python runtime dependencies empty; `coverage.py` is test-only and pinned.
- Reuse Vitest/WDIO and the existing Obsidian test vault; do not introduce another JS/E2E framework.
- Do not touch or commit `AGENTS.local.md` or manual-vault plugin state.
- Keep specific AC-0014 through AC-0019 assertions in DEVELOP.

## Checkpoint

Stop and classify as TEST_INFRA defect if Python and TypeScript cannot consume the same vector file, if named failure injection is nondeterministic, if the fixture lint accepts a real home path/private token, if the MR gate accepts a known failing Python smoke, or if either coverage report omits its configured importer surface.

## Steps

1. Scaffold the importer skill and sanitized fixture/test layout.
2. Add shared contract vector schema and cross-language smoke readers.
3. Extend memory storage support with named failure injection and operation logs without adding import behavior.
4. Add generic E2E descriptor/bundle/receipt fixture helpers and an empty-driver smoke.
5. Add Python coverage, V8 importer includes, CI installation and dual coverage gate inputs.
6. Prove fixture lint, test failure, coverage omission and submission gate rejection paths.
7. Run lint, build, unit smoke, Python smoke and E2E smoke; record evidence in the Report.
