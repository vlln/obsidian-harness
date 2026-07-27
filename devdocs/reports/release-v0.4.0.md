---
title: RELEASE Report v0.4.0
description: Obsidian Harness v0.4.0 release verification for the global Session Navigator, inline runtime status and compact visual hierarchy.
type: report
status: complete
created: 2026-07-26T12:35:50Z
---

# RELEASE Report v0.4.0

## Release Candidate

| Field | Result |
|-------|--------|
| Version | `v0.4.0` |
| Release branch | `release/v0.4.0` |
| Source commit | `f2cecdf` (`develop`, SYSTEM_TEST complete) |
| Release preparation | `cec8a16` |
| Production commit and tag | `269fedf` (`master`, `v0.4.0`) |
| Strategy | One-time public GitHub Release after draft asset verification |
| Previous public stable | `v0.3.0` |
| Rollback | Keep public `v0.3.0` available; do not publish on any staging/draft mismatch, or withdraw `v0.4.0` if production smoke fails |

## Staging Verification

Staging ran from the isolated `release/v0.4.0` worktree after a clean dependency installation.

| Gate | Result |
|------|--------|
| Clean `npm ci` | PASS: 987 packages installed; release patch applied |
| Plugin production build | PASS |
| Documentation build | PASS |
| Runtime dependency audit | PASS: 0 vulnerabilities |
| Version consistency | PASS: package, manifest and versions map report `0.4.0`; minimum Obsidian version `1.11.4` |
| Navigator release smoke | PASS: 1/1; Harness, New session, 5 Projects and 12 Recents render without an Active section |

The complete development toolchain reports 4 moderate and 33 high findings in transitive development/build/E2E
dependencies. They are not included in the Obsidian runtime dependency set; `npm audit --omit=dev` reports zero
runtime vulnerabilities. Automated broad fixes require dependency upgrades outside this release scope.

GitHub verification found that the existing `v0.4.0` tag produced a draft whose `main.js` and `styles.css`
were byte-identical to public `v0.3.0`; only release metadata changed. The companion importer skill is not part
of the three Obsidian plugin release assets and does not define a plugin version. This candidate therefore reuses
`v0.4.0` for the first actual post-v0.3 plugin runtime change: Session Navigator.

## Staging Artifacts

| Asset | Bytes | SHA-256 |
|-------|------:|---------|
| `main.js` | 837965 | `7127287844debd766d5aeb154bc80129416f1c72857a5f942fdc0063a196069d` |
| `manifest.json` | 301 | `2bd295f4fd9b5fe941de71ff0b60dc4e73e8231bc552e55ef69be63951ac9e93` |
| `styles.css` | 62587 | `d9bbee8baada60ffca7cb8ad87d861f91d7ce917cce4e4169ce733ab69dd9e75` |

## Production Decision Contract

- Publish strategy: after explicit approval, delete the unpublished old `v0.4.0` draft and remote tag, merge
  the release branch to `master`, recreate tag `v0.4.0`, let the tag workflow create an attested draft GitHub
  Release, verify the new draft assets, publish once, then merge the release back to `develop`.
- Pre-publication threshold: tag workflow succeeds within 10 minutes and the draft contains exactly
  `main.js`, `manifest.json` and `styles.css`; manifest metadata and all three SHA-256 digests match staging.
- Post-publication threshold: within a 5-minute observation window, GitHub reports a public non-prerelease
  `v0.4.0`, all three assets download successfully, their hashes still match, and the public manifest reports
  plugin `obsidian-harness`, version `0.4.0`, minimum Obsidian `1.11.4`.
- Rollback trigger: any workflow failure, missing/mismatched asset, invalid public metadata or failed download.
  Before publication, leave/delete the draft without publishing. After publication, withdraw `v0.4.0` and keep
  public `v0.3.0` as the stable release while the cause is investigated.

## System Evidence

- [Navigator visual hierarchy Report](../plans/0040-navigator-visual-hierarchy/01-report-navigator-visual-hierarchy.md)
- [Session Navigator system Report](../plans/0036-session-navigator-system-test/01-report-session-navigator-system-test.md)

## Production Verification

Production execution followed explicit human approval of the merge, tag and publication gates.

| Gate | Result |
|------|--------|
| Release merge | PASS: `release/v0.4.0` merged to `master` as `269fedf` |
| Version tag | PASS: `v0.4.0` points to `269fedf` |
| Tag workflow | PASS: [run 30203381481](https://github.com/vlln/obsidian-harness-frontend/actions/runs/30203381481), commit `269fedf` |
| GitHub Release | PASS: [v0.4.0](https://github.com/vlln/obsidian-harness-frontend/releases/tag/v0.4.0), published `2026-07-26T14:27:36Z`, public latest, non-draft and non-prerelease |
| Public asset set | PASS: exactly `main.js`, `manifest.json` and `styles.css` |
| Public artifact integrity | PASS: all bytes and SHA-256 values match the staging table |
| Public manifest | PASS: plugin `obsidian-harness`, version `0.4.0`, minimum Obsidian `1.11.4` |
| Production smoke | PASS: 1/1; publicly downloaded `main.js` renders Harness, New session, 5 Projects and 12 Recents without Active |
| Observation window | PASS: final check at `2026-07-27T01:42:52Z`, more than 5 minutes after publication; release metadata, downloads and digests remained healthy |
| Rollback | Not triggered |

The first post-publication download check appeared to show a hash mismatch because the files were read while
`gh release download` was still writing them. The release was conservatively returned to draft, and no invalid
artifact was left public. After waiting for download completion and using fresh downloads, all three files matched
the staging hashes; the release was republished and the full observation check passed. This is classified as a
verification-race false alarm, not a build or release artifact defect.

## Retrospective

- Versioning: the earlier unpublished `v0.4.0` draft contained no plugin runtime change, so it was replaced rather
  than skipping the Session Navigator release to `v0.5.0`.
- Scope: the session importer remains a companion skill and is not part of the Obsidian plugin runtime or its three
  release assets.
- Process improvement: artifact checks must wait for the download process to exit, then hash files from a fresh
  directory. The false-alarm handling above records the evidence; no product backlog item is required.

## Decision

[PASS] Staging, production publication, public smoke and the declared monitoring window passed. `v0.4.0` is the
current public stable release. The release can be merged back to `develop`, the project can advance to DESIGN, and
the release branch can be deleted after both merge targets contain this completed report.
