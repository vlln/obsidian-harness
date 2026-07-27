---
title: Plan-0041-01: Session Workspace Test Infrastructure Audit
description: Audit whether existing Vitest, WDIO, host fault injection, architecture checks, coverage and delivery gates fully support the frozen v0.5.0 contracts.
type: plan
status: done
created: 2026-07-27T03:05:00Z
---

# Plan-0041-01: Session Workspace Test Infrastructure Audit

## Context

Spec-0007 and AC-0006 add project-aware Session creation, a Turn Navigator and refined Navigator menus.
This is an incremental TEST_INFRA pass: ADR-0004 and ADR-0011 already select Vitest, WDIO Obsidian
Service, screenshot/geometry review, V8 coverage and the existing delivery gates.

## Request

Determine whether those accepted decisions and installed components cover every new v0.5.0 test layer. Add
only missing infrastructure; do not create feature tests or business implementation.

## Output Format

- A mapping from each new module/AC verification class to an existing test entry and fault-control pattern.
- Evidence that architecture checks can express the new service/UI dependency boundaries.
- Evidence that MR, coverage and submission gates remain executable on the frozen contracts.
- A complete Report stating whether a new test-infrastructure ADR or component is required.

## Constraints

- Do not implement Spec-0007 behavior or write AC-0006 feature test cases.
- Do not modify accepted ADRs, frozen Spec/AC documents, dependencies or release metadata.
- Do not access user vaults, home history, real Agents, network APIs or paid services from tests.
- Reuse existing Vitest, WDIO, MemoryDataAdapter, host dependency injection and gate scripts when sufficient.
- Preserve all unrelated importer work in the primary worktree.

## Checkpoint

Stop and design a new TEST_INFRA ADR only if an AC-0006 verification class cannot be expressed with the
accepted stack, or if supporting it requires a new framework, dependency, persistence fixture format or CI
execution layer. Stop before DEVELOP if the existing MR/coverage/submission gates do not execute cleanly.

## Steps

1. Map Spec-0007 modules and AC-0006 verification methods to ADR-0004/0011 and existing test helpers.
2. Audit host API, storage fault, virtualizer/UI, screenshot, performance and architecture-boundary support.
3. Run the existing MR gate in an isolated worktree and verify AC-0006 scenario discovery through the
   submission gate's existing parser tests or a non-mutating parser invocation.
4. Record conclusions, evidence paths and any applicable/waived TEST_INFRA gates in the Report.
5. Mark the execution container done; if no gap exists, merge the branch and advance to DEVELOP.
