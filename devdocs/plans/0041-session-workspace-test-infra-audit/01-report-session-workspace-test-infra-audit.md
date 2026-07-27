---
title: Report-0041-01: Session Workspace Test Infrastructure Audit
description: Incremental TEST_INFRA evidence for v0.5.0 test-layer coverage, AC discovery, V8 coverage targets and unchanged delivery gates.
type: report
status: complete
created: 2026-07-27T03:15:00Z
---

# Report-0041-01: Session Workspace Test Infrastructure Audit

## Summary

ADR-0004 and ADR-0011 cover every test layer required by Spec-0007 and AC-0006; no new framework,
dependency, mock service, persistence fixture format or TEST_INFRA ADR is required. The audit found and fixed
two incremental configuration gaps:

1. submission-gate AC discovery matched scenario references in prose instead of only table definition rows;
2. the V8 coverage target list did not yet name `project-directory.ts` or `turn-navigation.ts`.

After the fixes, the local MR gate and the real GitHub pull-request gate passed. The branch contains no
v0.5.0 business implementation or feature test case.

## Incremental Mapping

| Frozen requirement class | Existing infrastructure | Conclusion and evidence |
|--------------------------|-------------------------|-------------------------|
| Project directory rules and TurnNavigationItem projection | Node-environment Vitest + V8 coverage | Supported; both future service files are now explicit coverage targets in `vitest.config.mts` |
| Materialization ordering, compensation and reconciliation races | Vitest integration tests + MemoryDataAdapter occurrence/checkpoint failures | Supported by `test/support/memory-data-adapter.ts`; concrete AC cases belong to DEVELOP |
| Directory picker, system file manager and clipboard success/failure | Injectable host callbacks with Vitest spies; WDIO `browser.execute` for real ItemView interaction | Supported without a new host framework; existing `ChangeDirectoryModal` proves Electron directory selection is available |
| Turn rail virtualizer, keyboard, focus and responsive geometry | Existing `@tanstack/react-virtual` + WDIO Obsidian Service + DOM geometry | Supported; `.session` FileView fixture injection is proven by `e2e/offline-transcript.spec.ts` |
| Navigator menus, themes and screenshots | WDIO selectors, computed styles, `saveScreenshot` and fixed-width helpers | Supported by `e2e/session-navigator.spec.ts`; screenshots remain SYSTEM_TEST-only |
| 500-message projection budget | Vitest monotonic timing at the system/performance layer | Supported by the existing `test/session-navigator-performance.system.test.ts` pattern |
| Service/UI/plugin dependency boundaries | Vitest repository source inspection + ESLint | Supported by `test/session-catalog.test.ts` and `test/session-navigator-model.test.ts` patterns; concrete new-module assertions belong to DEVELOP |
| Scenario-level submission evidence | `scripts/check-submission-gate.mjs` | Fixed to match only `| AC-####-[NBEF]-# |` definition rows; reference fixture proves old AC citations are ignored |

## Gate Evidence

| Incremental gate | Result | Basis and evidence |
|------------------|--------|--------------------|
| Accepted test-infrastructure ADR covers v0.5.0 | PASS | ADR-0004 selects Vitest/WDIO/GitHub Actions; ADR-0011 covers pure logic, UI, screenshots, performance, architecture and gates without new dependencies |
| Test framework and fault controls support new modules | PASS | Existing Vitest node environment, Obsidian stub, MemoryDataAdapter and WDIO `browser.execute` cover the required seams |
| Coverage configuration includes new pure services | PASS | `vitest.config.mts` includes `src/services/project-directory.ts` and `src/services/turn-navigation.ts` |
| Submission gate ignores referenced scenarios | PASS | Focused `test/submission-gate.test.ts`: 6/6; new fixture reports 2 definition rows while prose cites 2 unrelated scenarios |
| Local MR gate | PASS | `npm run gate:mr`: ESLint and fixture lint pass; build passes; Vitest 20 files / 155 tests pass; V8 lines 93.83%; importer 9 tests and 90% lines pass |
| Real CI pull-request gate | PASS | GitHub PR #5, `lint-and-build`, run 30234169307, passed in 53 seconds |
| Architecture rule mechanism matches frozen dependency graph | PASS | Existing source-inspection tests can assert service-to-UI/plugin forbidden imports and required plugin wiring without a new tool |
| System-test framework startup | REUSED | Plan-0025 records WDIO 9/9 smoke; current `e2e/session-navigator.spec.ts` exercises the same Navigator and screenshot helpers. Not rerun in TEST_INFRA per the no-repeat boundary |
| MR/quality/submission negative self-tests | REUSED + INCREMENTAL PASS | Prior self-proofs remain accepted; the only changed parser has a new positive/reference-isolation case and existing incomplete-report negative case |
| Mock service / paid dependency / sandbox | NOT APPLICABLE | v0.5.0 adds no external or paid API; host calls are local desktop capabilities |
| Deployment bottom layer | NO CHANGE | Local Obsidian plugin packaging/release infrastructure is unchanged by the test configuration patch |

The optional `relay` workflow on PR #5 failed because OpenClaw secrets are absent. As recorded in Report-0025,
it is not part of `lint-and-build`, `gate:mr` or the plugin delivery gate and does not block this phase.

## Residual Risk

`npm ci` reported 37 vulnerabilities in the existing dependency graph (4 moderate, 33 high). This branch adds
no dependency or lockfile change, so dependency remediation is outside this incremental TEST_INFRA container;
the finding should be handled as a separate dependency-maintenance backlog item rather than mixed into v0.5.0.

## Conclusion

The two identified incremental gaps are closed and self-proven. No new test-infrastructure ADR requires human
promotion. TEST_INFRA is complete for v0.5.0 and the repository can advance to DEVELOP after this branch is
merged into `develop`.

## Associated Commits

- `1fdac40` `docs(plan): add v0.5.0 test infrastructure audit`
- `9bc0f3e` `test(infra): cover v0.5.0 service and AC discovery gates`
