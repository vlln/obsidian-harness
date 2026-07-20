---
title: Plan-0025-01: Turn Transcript Test Infrastructure
description: Build deterministic ACP fixtures, fault-injectable storage, offline E2E fixtures, coverage reporting, and enforceable gates for AC-0003.
type: plan
status: pending
created: 2026-07-20T10:08:02Z
---

# Plan-0025-01: Turn Transcript Test Infrastructure

## Context

Spec-0004 v2, AC-0003 and ADR-0005 are frozen. Existing vitest, WDIO, GitHub Actions and release packaging remain the selected infrastructure under ADR-0004, but this iteration needs deterministic inputs and failure controls for semantic turn aggregation and local transcript storage.

## Request

Provide reusable test infrastructure for DEVELOP plans without implementing transcript business behavior.

## Output Format

- Typed ACP-normalized turn fixtures covering messages, thoughts, tools, plans, usage, completion and interruption.
- An in-memory Obsidian-compatible adapter with deterministic failures for write, append, rename, remove and corrupted reads.
- E2E helpers that materialize `.session` entries and plugin-local transcript files without starting an Agent.
- Coverage reporting and executable MR/submission gate commands; the submission gate derives every N/B/E/F scenario from the frozen AC document.
- A complete Report with positive and negative gate evidence.

## Constraints

- Reuse vitest, WDIO and GitHub Actions; do not introduce a second test framework.
- Do not implement transcript aggregation, persistence, projection or UI behavior in this plan.
- Do not parse any private Agent history format.
- Do not touch or commit `AGENTS.local.md` or vault-local plugin state.
- Preserve the five E1 experiment source changes until the DEVELOP implementation replaces them.

## Checkpoint

Stop and classify as a TEST_INFRA defect if a fixture cannot deterministically express an AC-0003 failure mode, if the MR gate accepts a known failing test, or if the submission gate accepts missing AC/coverage evidence.

## Steps

1. Add reusable turn and storage fixtures under `test/support/`.
2. Add offline `.session`/transcript materialization helpers under `e2e/support/`.
3. Add coverage configuration and explicit `gate:mr` / `gate:submission` commands.
4. Prove the MR gate rejects a known failing test without committing that test.
5. Prove the submission gate rejects incomplete report and coverage fixtures and accepts complete fixtures.
6. Run lint, unit smoke, build and E2E smoke; record evidence in the Report.
