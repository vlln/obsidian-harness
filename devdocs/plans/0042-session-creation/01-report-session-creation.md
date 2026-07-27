---
title: Report-0042-01: Project-aware Session Creation
description: Implementation and DEVELOP-slice evidence for directory rules, creation modal, ordered materialization and exact compensation under AC-0024.
type: report
status: complete
created: 2026-07-27T03:36:00Z
---

# Report-0042-01: Project-aware Session Creation

## Summary

Navigator New session now opens a single-directory Create project modal without eager writes. It derives a
default target under `~/Documents`, rejects unsafe/existing/root targets, locks the selected folder basename,
shows effective cwd and prevents duplicate submit. Existing non-Navigator callers retain their cwd fallback.

Session materialization now reserves identities after directory preparation and writes transcript manifest →
`.session` → confirmed index. Materialization, create-event reconciliation and delete cleanup share an entryId
queue. Failure deletes or invalidates the entry before index/transcript cleanup; a residual failed entry is
suppressed so a queued create event cannot recreate its mapping. cwd is never part of compensation.

## AC Evidence

| Scenario | Result | Evidence |
|----------|--------|----------|
| AC-0024-N-1 | [PASS] | `session-materialization.test.ts` asserts exact transcript/entry/index order and identity mapping; `project-directory.test.ts` derives `/Users/test/Documents/atlas`. |
| AC-0024-N-2 | [PASS] | Selected absolute non-root directory produces `kind=selected`, `needsCreate=false`; modal renders one source row, locks the name and removes Add folder. |
| AC-0024-N-3 (DEVELOP slice) | [PASS] | `SessionCreationModal` accepts and validates `initialSourceDirectory`; Project menu wiring remains assigned to Plan-0044. |
| AC-0024-N-4 (DEVELOP slice) | [PASS] | Modal uses labeled native controls, focus return, stable issue area and 260 px-safe CSS. Full theme/focus-loop evidence remains SYSTEM_TEST. |
| AC-0024-B-1 (DEVELOP slice) | [PASS] | Opening/canceling the modal calls no storage operation; picker cancellation returns null and preserves form state. Real host interaction remains SYSTEM_TEST. |
| AC-0024-B-2 | [PASS] | Existing default target rejects with an explicit select-or-rename message; selected target never requests directory creation. |
| AC-0024-B-3 | [PASS] | Parameterized tests reject empty/dot/separator/control/trailing names, Windows reserved values, relative/file/missing targets and POSIX/drive/UNC roots. |
| AC-0024-B-4 (DEVELOP slice) | [PASS] | Modal disables Create while pending and guards submit with `submitting`; transaction uses one preallocated identity. Double-click E2E remains SYSTEM_TEST. |
| AC-0024-B-5 (DEVELOP slice) | [PASS] | Source and Location use ellipsis plus full title/aria label; removing source re-enables name and Add folder. Geometry remains SYSTEM_TEST. |
| AC-0024-E-1 | [PASS] | Selected directory is revalidated on submit; a removed/non-directory target fails before storage. |
| AC-0024-E-2 | [PASS] | Empty/non-absolute homedir rejects without a vault-root fallback. |
| AC-0024-F-1 (DEVELOP slice) | [PASS] | Default parent/target mkdir errors propagate into the still-open modal before materialization. OS fault injection remains SYSTEM_TEST. |
| AC-0024-F-2 | [PASS] | Parameterized transcript/entry/index failures assert entry-first compensation, exact index/history cleanup, Catalog refresh and serialized reconciliation. |
| AC-0024-F-3 | [PASS] | Cleanup failure test exposes exact entry/transcript paths; queue suppression prevents a residual entry from rebuilding index. Parameterized UI summaries remain SYSTEM_TEST. |

## Constraint Evidence

- `project-directory.ts` and `session-materialization.ts` have no React, Obsidian or ACP SDK imports.
- No dependency, schema, Project persistence or existing cwd fallback was changed.
- Incomplete `.session` deletion has a local lint exception because unpublished artifacts must be removed exactly;
  user-requested Session deletion continues to use recoverable FileManager trash semantics.
- Navigator row menus, Turn Navigator and importer files are outside this branch.

## Gate Evidence

| Gate | Result |
|------|--------|
| Focused directory/materialization/lifecycle/Navigator tests | PASS: 37/37 |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run gate:mr` | PASS: 22 Vitest files / 184 tests; 94.08% V8 lines; project-directory 97.22%; session-materialization 95.12%; importer 9 tests / 90% lines |

## Acceptance Audit

- Tests assert exact target values, cross-platform invalid inputs, write order, index fields, cleanup order and
  reconciliation scheduling; no assertion is limited to “does not throw”.
- No test is skipped. UI geometry, native picker behavior, focus loops and theme screenshots are explicitly left
  to SYSTEM_TEST and are not claimed as runtime evidence here.
- The diff matches the AC slice: two pure services, one modal, plugin lifecycle wiring, focused Navigator entry,
  CSS, tests and the existing coverage target list.

## Associated Commit

- `ecf05e6` `feat(session): implement AC-0024 project-aware creation`
