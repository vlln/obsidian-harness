---
title: RELEASE Report v0.2.0
description: Obsidian Harness v0.2.0 发布验收报告，记录 staging、production、产物校验与发布异常。
type: report
status: complete
created: 2026-07-20T09:34:04Z
---

# RELEASE Report v0.2.0

## Release

| Field | Result |
|-------|--------|
| Version | `v0.2.0` |
| Release commit | `393f908` |
| Tag | `v0.2.0` |
| Published at | `2026-07-20T09:33:00Z` |
| GitHub release | https://github.com/vlln/obsidian-harness-frontend/releases/tag/v0.2.0 |

## Staging verification

| Gate | Result |
|------|--------|
| Lint | PASS |
| Unit tests | PASS, 89/89 |
| Production build | PASS |
| Documentation build | PASS |
| Obsidian E2E smoke | PASS, 9/9 |
| Runtime dependency audit | PASS, 0 vulnerabilities |

The development-only audit reported four moderate and two high findings in build and E2E dependencies. None are included as runtime dependencies; upstream-compatible fixes were not available without breaking toolchain changes.

## Production verification

The published `main.js`, `manifest.json`, and `styles.css` assets were downloaded from GitHub after publication. Their SHA-256 digests matched the locally tested release artifacts:

| Asset | SHA-256 |
|-------|---------|
| `main.js` | `a3aab6ed943c4e17d716551065ea930d328377de0f20f6a1183f19aebf0e96cc` |
| `manifest.json` | `e6576502ac1381dabc33780aeb0b0c24560c4e4f610d07ef70bfc47de1ce5723` |
| `styles.css` | `f484479c6347c4a24f2f44e8aadf3921a780a4e2e6bae8d7460f0af8129664cb` |

The published manifest reports plugin version `0.2.0` and minimum Obsidian version `1.11.4`.

## Release anomaly

The tag push did not create a GitHub Actions run even though Actions and the release workflow were enabled. The existing workflow's equivalent fallback was performed manually: build artifacts from the verified release worktree were uploaded to a draft release, their GitHub digests were checked, and the draft was then published.

Because the workflow did not run, this release does not include the workflow's build-provenance attestation. Artifact integrity was instead verified by matching local and published SHA-256 digests.

## Decision

Release gates passed. The `v0.2.0` iteration is complete and the project advances to DESIGN for the ACP turn transcript iteration.
