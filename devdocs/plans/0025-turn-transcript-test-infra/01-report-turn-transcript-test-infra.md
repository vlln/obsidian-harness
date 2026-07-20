---
title: Report-0025-01: Turn Transcript Test Infrastructure
description: Execution evidence for ACP fixtures, fault injection, offline E2E helpers, coverage, and delivery gates.
type: report
status: complete
created: 2026-07-20T10:08:02Z
---

# Report-0025-01: Turn Transcript Test Infrastructure

## Summary

Reused ADR-0004's vitest, WDIO and GitHub Actions stack and added the deterministic controls required by AC-0003. The infrastructure now exposes ACP-normalized turn fixtures, one-shot storage failures, an offline transcript materializer, V8 coverage, a single MR gate and a submission gate that derives all 29 N/B/E/F scenario IDs from the frozen AC document.

## Outputs

- `test/support/acp-turn-fixtures.ts`: completed and interrupted ACP-normalized streams.
- `test/support/memory-data-adapter.ts`: deterministic DataAdapter subset with per-operation one-shot failures.
- `e2e/support/offline-transcript-fixture.ts`: version 2 entry, manifest and TurnRecord materialization without an Agent.
- `vitest.config.mts`: V8 coverage over transcript/session storage targets.
- `scripts/check-submission-gate.mjs`: Report status, scenario-level AC evidence and coverage enforcement.
- `.github/workflows/ci.yaml`: PR execution through `npm run gate:mr` with uploaded coverage summary.

## Gate Evidence

| Gate | Expected | Result | Evidence |
|------|----------|--------|----------|
| Fixture smoke | Deterministic semantic/failure fixtures load | PASS | `test/test-infra-smoke.test.ts`, 2/2 |
| MR positive | lint, build and unit smoke pass | PASS | local `npm run gate:mr`, 94/94; GitHub PR #1 `lint-and-build`, 36s |
| MR negative | known failing test is rejected | PASS | temporary intentional assertion failed 1/92; file removed before commit |
| Submission positive | complete AC and coverage evidence passes | PASS | `test/submission-gate.test.ts`, complete 29-scenario fixture accepted |
| Submission negative | missing AC or coverage evidence is rejected | PASS | draft/missing-scenario and 42% fixtures both rejected |
| Coverage accuracy | known unexecuted target reports zero | PASS | SessionStorage 0/86 executable lines, matching zero imports in baseline tests |
| E2E smoke | Obsidian driver starts and existing suite passes | PASS | `npm run test:e2e`, 9/9 in 6s |

The optional `relay` webhook workflow failed because repository OpenClaw secrets are absent. It is not part of the MR gate and does not affect plugin build or test evidence.

## Associated Commits

- `81fb56c` docs(plan): add turn transcript test infrastructure
- `163d54d` test(transcript): add deterministic test infrastructure
- `8044514` docs(test): document transcript delivery gates
- `cb8f1b7` test(gate): require every AC scenario
- `96a5bfe` docs(test): require scenario-level evidence
