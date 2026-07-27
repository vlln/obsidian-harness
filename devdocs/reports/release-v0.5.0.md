---
title: RELEASE Report v0.5.0
description: Obsidian Harness v0.5.0 release verification for Project-aware Session creation, continuous Turn navigation and focused Project/Session actions.
type: report
status: draft
created: 2026-07-27T05:19:24Z
---

# RELEASE Report v0.5.0

## Release Candidate

| Field | Result |
|-------|--------|
| Version | `v0.5.0` |
| Release branch | `release/v0.5.0` |
| Source commit | `05a66c8` (`develop`, SYSTEM_TEST complete plus accepted staging fixes through 0049) |
| Version preparation | `a41aeaa` |
| Strategy | One-time public GitHub Release after draft asset verification |
| Previous public stable | `v0.4.0` |
| Rollback | Keep public `v0.4.0` available; do not publish on any staging/draft mismatch, or withdraw `v0.5.0` if production smoke fails |

The minor version increment is required because this iteration adds backward-compatible user-facing features;
there is no breaking change.

## Staging Verification

Staging ran from an isolated `release/v0.5.0` worktree with a clean dependency installation.

| Gate | Result |
|------|--------|
| Clean `npm ci` | PASS: 987 packages installed; release patch applied |
| Plugin production build | PASS |
| Documentation build | PASS |
| Runtime dependency audit | PASS: 0 vulnerabilities |
| Version consistency | PASS: package, manifest and versions map report `0.5.0`; minimum Obsidian version `1.11.4` |
| Release smoke | PASS: 4/4; Project-aware creation, basic Turn navigation, distant continuous scrolling and 48-turn hidden-scrollbar behavior render and interact in Obsidian |

The complete development toolchain reports 4 moderate and 33 high findings in transitive development/build/E2E
dependencies. They are excluded from the three Obsidian runtime assets; `npm audit --omit=dev` reports zero
runtime vulnerabilities. Broad dependency upgrades are outside this release scope.

## Staging Artifacts

| Asset | Bytes | SHA-256 |
|-------|------:|---------|
| `main.js` | 852780 | `6e8b1c848b83d4574324ae65def34ff1d8b5411b46531d74db4285e36f35af11` |
| `manifest.json` | 301 | `56fe079fb4e67dbad6995ee1fee4ad9cfbe7afc45e02996408663f7ab30049d2` |
| `styles.css` | 67085 | `7fbac7335b3e44c1b98c6ee1a721bd117b8db48f4d1f1a42c964a4b35b0d046c` |

## Production Decision Contract

- Publish strategy: after explicit approval, merge `release/v0.5.0` to `master`, create tag `v0.5.0`, let the
  tag workflow create an attested draft GitHub Release, verify the draft assets, publish once, then merge the
  release branch back to `develop`.
- Pre-publication threshold: the tag workflow succeeds within 10 minutes and the draft contains exactly
  `main.js`, `manifest.json` and `styles.css`; manifest metadata and all three SHA-256 digests match staging.
- Post-publication threshold: within a 5-minute observation window, GitHub reports a public non-prerelease
  `v0.5.0`, all three assets download successfully, their hashes still match, and the public manifest reports
  plugin `obsidian-harness`, version `0.5.0`, minimum Obsidian `1.11.4`.
- Rollback trigger: any workflow failure, missing/mismatched asset, invalid public metadata or failed download.
  Before publication, leave or delete the draft without publishing. After publication, withdraw `v0.5.0` and
  retain public `v0.4.0` while the cause is investigated.

## System Evidence

- [Session workspace SYSTEM_TEST Report](../plans/0045-session-workspace-system-test/01-report-session-workspace-system-test.md)
- [Turn accessibility fix Report](../plans/0046-turn-tooltip-accessibility/01-report-turn-tooltip-accessibility.md)
- [Turn responsive layout fix Report](../plans/0047-turn-navigator-responsive-layout/01-report-turn-navigator-responsive-layout.md)
- [Turn visual polish Report](../plans/0048-turn-navigator-visual-polish/01-report-turn-navigator-visual-polish.md)
- [Turn smooth-scroll fix Report](../plans/0049-turn-navigation-smooth-scroll/01-report-turn-navigation-smooth-scroll.md)

## Production Verification

Pending explicit human approval and production execution.

## Decision

`[PENDING]` Staging passed. Production publication, public smoke, monitoring, release-branch merges, tag and
iteration closeout remain pending.
