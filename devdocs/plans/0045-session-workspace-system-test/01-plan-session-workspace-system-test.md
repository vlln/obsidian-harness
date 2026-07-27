---
title: Plan-0045-01: Session Workspace System Test
description: Execute v0.5.0 Obsidian integration, E2E, visual, accessibility, host-failure and performance verification for AC-0024 through AC-0026.
type: plan
status: done
created: 2026-07-27T04:39:26Z
---

# Plan-0045-01: Session Workspace System Test

## Context

All v0.5.0 feature Plans are merged and their DEVELOP gates are green. Runtime evidence remains for the
Session creation modal, Turn Navigator geometry/navigation and Project/Session menus. Existing v0.4.0 E2E must
also be updated where AC-0026 explicitly supersedes the four-item Session menu.

## Request

Run the SYSTEM_TEST layers once on `develop`: existing Obsidian integration/E2E, v0.5.0 black-box scenarios,
theme/width screenshots and the isolated 500-message performance test. Classify every failure before changing
code and record complete AC evidence and blocking-defect assessment.

## Output Format

- Updated superseded Session-menu E2E assertion.
- A focused `session-workspace.spec.ts` with real ItemView/modal/menu/virtualizer geometry and injected local-host failures.
- 260/519/520/800/1200 px light/dark screenshot evidence where applicable.
- Performance evidence for the frozen 500-message budget.
- A complete SYSTEM_TEST Report with failure classification and blocking-defect decision.

## Constraints

- Do not rerun DEVELOP unit/MR layers; SYSTEM_TEST owns WDIO, visual and performance layers only.
- Do not add features or change frozen Spec/AC/ADR documents.
- Do not access real Agents, paid APIs, user vaults or external network services.
- Stub system file manager and clipboard calls before exercising them; do not open Finder or overwrite the real clipboard.
- Fix implementation bugs only after a failing system assertion and keep the smallest permanent reproduction.
- Preserve unrelated importer files and their exact diff.

## Checkpoint

Stop the current layer on first failure, classify it as test infrastructure, design or local implementation,
and follow the corresponding devloop transition. Do not advance to RELEASE with a blocking defect.

## Steps

1. Update the superseded menu expectation and add v0.5.0 runtime fixtures/assertions.
2. Run existing service integration/E2E in order, then the v0.5.0 WDIO system layer.
3. On a local bug, add/retain the failing reproduction, fix minimally and restart from the failed layer.
4. Capture and inspect responsive light/dark screenshots; run the isolated 500-message performance layer.
5. Complete the Report, assess blocking defects and advance only if every applicable layer passes.
