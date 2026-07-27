---
title: Plan-0051-01: Turn Scroll System Test
description: Execute the v0.5.1 message-scroll synchronization regression once in the packaged plugin on develop.
type: plan
status: pending
created: 2026-07-27T09:35:00Z
---

# Plan-0051-01: Turn Scroll System Test

## Context

Plan 0050 is merged into `develop` with DEVELOP MR and submission gates green. Its WDIO assertions were
authored but deliberately not executed before merge. Runtime evidence remains for manual viewport-to-Turn
synchronization, continuous bottom scrolling against trailing container geometry and retained distant Turn
navigation.

## Request

Build the packaged plugin at the merged `develop` revision and execute the complete Session Workspace WDIO
spec once in the local Obsidian desktop host. Classify any failure before modifying code and record whether the
increment has a release-blocking defect.

## Output Format

- One packaged-plugin build for the merged revision.
- One execution of `e2e/session-workspace.spec.ts`, including all three `AC-0025 scroll synchronization` cases.
- A complete SYSTEM_TEST Report with failure classification, semantic assertion review and blocker decision.

## Constraints

- Do not rerun Vitest, coverage, MR gate or other DEVELOP-owned layers.
- Do not modify frozen Spec/AC/ADR or add product behavior.
- Do not read real Agent history, start an Agent, access paid/network APIs or invoke external host actions.
- No new visual baseline is required because the increment changes no CSS or layout geometry.
- Preserve unrelated importer files and 0048 runtime screenshots exactly.

## Checkpoint

Stop on the first WDIO failure, capture its failing assertion and classify it as infrastructure, design or local
implementation before taking any corrective action. Do not advance with a blocking defect.

## Steps

1. Commit this SYSTEM_TEST Plan on `develop` and build the packaged plugin once.
2. Run `npm run test:e2e -- --spec e2e/session-workspace.spec.ts` once.
3. Confirm the manual-scroll test derives active Turn from the first intersecting virtual message at middle and
   boundary offsets; confirm the bottom test records one or two smooth calls, true maximum-offset landing and a
   hidden button; retain the existing distant Turn assertion.
4. Classify failures and, only for a local bug, create a minimal `fix/*` reproduction/fix before restarting this
   failed system layer.
5. Complete the Report and advance only when no blocking defect remains.
