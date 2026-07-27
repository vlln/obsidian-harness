---
title: Report-0049-01: Turn Navigation Smooth Scroll
description: Release-staging fix evidence for continuous long-distance Turn navigation across dynamically measured virtual messages.
type: report
status: complete
created: 2026-07-27T07:18:50Z
---

# Report-0049-01: Turn Navigation Smooth Scroll

## Failure Classification

| Finding | Classification | Basis |
|---------|----------------|-------|
| A distant Turn jump paused repeatedly while crossing user messages | Local implementation bug | `scrollToIndex(..., smooth)` recalculated its destination as target-region messages were measured and restarted the browser's smooth scroll for every correction. The frozen Turn identity, active-state and layout contracts remained valid. |

The issue was found during human review of the refreshed `v0.5.0` release candidate. The initial hypothesis blamed
viewport-derived active-turn changes, but a permanent runtime trace held the active sequence at `[41]`; active
state was not the cause.

## Failing Reproduction

The corrected 48-turn reproduction explicitly positioned the message viewport at the first turn before clicking
Turn 41. Before the fix, one navigation produced nine native smooth `scrollTo` calls. Calls 2-9 occurred while the
first animation was still in flight, including a cluster from approximately 538 ms through 870 ms. The frame
trace plateaued after each restart, matching the hesitation reported during review.

The permanent WDIO assertion rejects more than two smooth calls: one uninterrupted primary animation and, only
when dynamic measurement changes the destination, one terminal correction. It also requires active trace `[41]`,
target visibility and rail-local active following.

## Resolution

- Normal-motion navigation obtains the estimated target through TanStack Virtual's public
  `getOffsetForIndex` API and gives that target directly to one browser-native smooth scroll.
- After `scrollend`, the now-measured target may receive one short smooth correction. TanStack Virtual then owns
  the exact automatic final alignment.
- A 1.6 s fallback bounds browsers without `scrollend`; a new navigation and component unmount both remove the
  previous listener and timer.
- Reduced-motion and guarded `scrollToIndex` fallback paths remain immediate and unchanged. Manual viewport
  tracking still uses the existing animation-frame update path.

## Evidence

| Gate | Result |
|------|--------|
| Failing 48-turn runtime trace | PASS as reproduction: 9 smooth restarts, active trace `[41]` |
| Focused fixed runtime scenario | PASS: 1/1 on two consecutive runs |
| Complete Session workspace regression | PASS: 7/7, 15.1 s |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Clean-worktree `npm run gate:mr` | PASS: 198/198 TypeScript tests, 94.05% line coverage; 9/9 Python tests, 90% coverage |

Running `gate:mr` in the shared dirty worktree first produced five unrelated importer reader failures because the
uncommitted importer CLI now requires `--adapter` while its TypeScript contract test still invokes the previous
interface. The same 0049 commit passed the complete gate in an isolated clean worktree. The unrelated importer
diff was untouched; its checksum remained
`503b454b6eba2f983fbabb897dd69ffc424e5ea649c059fdd17a61c5a4fd2163`.

## Associated Commits

- `27ef384` `test(session): reproduce Turn smooth-scroll restarts`
- `6df8631` `fix(session): coalesce Turn smooth-scroll corrections`

## Release Impact

The existing `release/v0.5.0` candidate is stale because it predates this product fix. After 0049 merges into
`develop`, the release branch must be rebuilt from the new baseline and staging rerun. No production merge, tag
or publish action was performed from the stale candidate.
