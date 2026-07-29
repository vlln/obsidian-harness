---
title: RELEASE Report v0.5.1
description: Obsidian Harness v0.5.1 release verification for synchronized manual and bottom message scrolling.
type: report
status: complete
created: 2026-07-27T10:05:00Z
---

# RELEASE Report v0.5.1

## Release Candidate

| Field | Result |
|-------|--------|
| Version | `v0.5.1` |
| Release branch | `release/v0.5.1` |
| Source commit | `71bf5f9` (`develop`, accepted DEVELOP and SYSTEM_TEST evidence through 0053) |
| Version preparation | `6e4b536` |
| Previous public stable | `v0.5.0` |
| Rollback | Keep public `v0.5.0` available; do not publish on any draft mismatch, or withdraw `v0.5.1` if production smoke fails |

This is a patch increment containing backward-compatible fixes to existing Turn Navigator scrolling behavior.

## Staging Verification

Staging ran from an isolated `release/v0.5.1` worktree with a clean dependency installation.

| Gate | Result |
|------|--------|
| Clean `npm ci` | PASS: 987 packages installed; release patch applied |
| Plugin production build | PASS |
| Documentation build | PASS |
| Runtime dependency audit | PASS: 0 vulnerabilities |
| Version consistency | PASS: package, manifest and versions map report `0.5.1`; minimum Obsidian version `1.11.4` |
| Release smoke | PASS: 3/3; distant Turn navigation, manual viewport synchronization and continuous bottom scrolling work in Obsidian |

The complete development toolchain reports 4 moderate and 33 high findings in transitive development/build/E2E
dependencies. They are excluded from the three Obsidian runtime assets; `npm audit --omit=dev` reports zero
runtime vulnerabilities. Broad dependency upgrades remain outside this patch scope.

## Staging Artifacts

| Asset | Bytes | SHA-256 |
|-------|------:|---------|
| `main.js` | 854949 | `e2fffe4288482ef661626241e3196ccb7d553e5620c5795b6d9dacc763d9c462` |
| `manifest.json` | 301 | `30b23bfac93e38b83df3c992515b4916d9273cea318eb2d36dd62fbc38b1859b` |
| `styles.css` | 67085 | `7fbac7335b3e44c1b98c6ee1a721bd117b8db48f4d1f1a42c964a4b35b0d046c` |

## Production Decision Contract

- Publish strategy: merge the authorized candidate to `master`, create tag `v0.5.1`, let the tag workflow create
  an attested draft, verify the draft assets, publish once, then merge the release branch back to `develop`.
- Pre-publication threshold: the tag workflow succeeds within 10 minutes and the draft contains exactly
  `main.js`, `manifest.json` and `styles.css`; metadata, sizes and all SHA-256 digests match staging.
- Post-publication threshold: within a 5-minute observation window, GitHub reports a public non-prerelease
  `v0.5.1`, all assets download successfully with matching hashes, and the manifest reports plugin
  `obsidian-harness`, version `0.5.1`, minimum Obsidian `1.11.4`.
- Rollback trigger: any workflow failure, missing/mismatched asset, invalid public metadata or failed download.
  Before publication, leave or delete the draft. After publication, withdraw `v0.5.1` and retain `v0.5.0`.

## System Evidence

- [Turn scroll synchronization Report](../plans/0050-turn-scroll-sync/01-report-turn-scroll-sync.md)
- [Turn scroll SYSTEM_TEST Report](../plans/0051-turn-scroll-system-test/01-report-turn-scroll-system-test.md)
- [SYSTEM_TEST selector fix Report](../plans/0052-turn-scroll-system-test-selector/01-report-turn-scroll-system-test-selector.md)
- [MessageList listener lifecycle Report](../plans/0053-message-list-scroll-listener/01-report-message-list-scroll-listener.md)

## Production Verification

Human approval explicitly covered one-time publication, the `master` merge and the `v0.5.1` tag. Production
executed against the approved release candidate as follows:

| Gate | Result |
|------|--------|
| `master` merge | PASS: `91537c3`, with a tree identical to release candidate `d7c0c3c` |
| Remote tag | PASS: `v0.5.1` points to `91537c3` |
| Tag workflow | PASS: run [30256679792](https://github.com/vlln/obsidian-harness-frontend/actions/runs/30256679792), 30 s |
| Draft inspection | PASS: exactly `main.js`, `manifest.json` and `styles.css`; all sizes and SHA-256 digests matched staging |
| Build provenance | PASS: downloaded `main.js` and `styles.css` attestations verified for `vlln/obsidian-harness-frontend` |
| Public release | PASS: [v0.5.1](https://github.com/vlln/obsidian-harness-frontend/releases/tag/v0.5.1), published `2026-07-27T10:07:25Z`, latest and non-prerelease |
| Public download smoke | PASS: all three assets downloaded; hashes and manifest metadata matched staging |
| Five-minute monitoring | PASS at `2026-07-27T10:13:09Z`; release remained latest/public and all assets remained uploaded with matching digests |
| `develop` reconciliation | PASS: release completion evidence merged at `c5fb614`; remote release branch deleted |

The workflow repeated the known non-blocking warning that pinned Actions target the deprecated Node 20 action
runtime and were forced to Node 24. Runtime assets and provenance were unaffected; `BL-0007` already tracks the
upgrade. No rollback trigger fired, so public `v0.5.1` remains active alongside `v0.5.0`.

## Retrospective

- Focused patch scope kept staging to the three changed scrolling behaviors while reusing the full DEVELOP and
  SYSTEM_TEST evidence already accepted on `develop`.
- The restored-message listener regression found during SYSTEM_TEST is permanently covered in the same public
  candidate; no production-only correction was required.
- Release operations stayed in isolated worktrees, so pre-existing importer and visual-artifact changes in the
  primary worktree were not included in commits or release assets.

## Decision

`[PASS]` Staging, production publication, public download smoke and the five-minute monitoring window all passed.
The release was merged back to `develop`; no rollback is required.
