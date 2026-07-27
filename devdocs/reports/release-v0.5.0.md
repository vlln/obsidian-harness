---
title: RELEASE Report v0.5.0
description: Obsidian Harness v0.5.0 release verification for Project-aware Session creation, continuous Turn navigation and focused Project/Session actions.
type: report
status: complete
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

Human approval explicitly covered one-time publication, the `master` merge and the `v0.5.0` tag. Production
executed against the approved release candidate as follows:

| Gate | Result |
|------|--------|
| `master` merge | PASS: `235aaf0`, with a tree identical to release candidate `4ad4417` |
| Remote tag | PASS: `v0.5.0` points to `235aaf0` |
| Tag workflow | PASS: run [30246702118](https://github.com/vlln/obsidian-harness-frontend/actions/runs/30246702118), 39 s |
| Draft inspection | PASS: exactly `main.js`, `manifest.json` and `styles.css`; all sizes and SHA-256 digests matched staging |
| Build provenance | PASS: downloaded `main.js` and `styles.css` attestations verified for `vlln/obsidian-harness-frontend` |
| Public release | PASS: [v0.5.0](https://github.com/vlln/obsidian-harness-frontend/releases/tag/v0.5.0), published `2026-07-27T07:37:43Z`, non-prerelease |
| Public download smoke | PASS: all three assets downloaded; hashes and manifest metadata matched staging |
| Five-minute monitoring | PASS at `2026-07-27T07:43:13Z`; release remained latest/public and all assets remained uploaded with matching digests |

The workflow emitted one non-blocking warning: pinned Actions currently target the deprecated Node 20 action
runtime and were forced to Node 24 by GitHub. Runtime assets and provenance were unaffected; follow-up is recorded
as a backlog candidate. No rollback trigger fired, so public `v0.5.0` remains active alongside `v0.4.0`.

## Retrospective

- Human staging review found two presentation defects after the first system pass: host-dependent Turn rail
  styling and virtualizer smooth-scroll retargeting. Both were classified as local implementation bugs, fixed on
  isolated branches and covered by permanent 48-turn runtime checks before the candidate was rebuilt.
- The candidate was rebuilt twice rather than published with known UI defects. This extended release verification
  but preserved the rule that `master` receives only a reviewed candidate.
- Future release checks should wait for asset downloads to complete before hashing and should update pinned GitHub
  Actions before GitHub removes the Node 20 compatibility path.

## Decision

`[PASS]` Staging, production publication, public download smoke and the five-minute monitoring window all passed.
The release may be merged back to `develop`; no rollback is required.
