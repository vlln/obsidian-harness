---
title: RELEASE Report v0.3.0
description: Obsidian Harness v0.3.0 release verification for semantic turn transcripts, offline history and explicit ACP continuation.
type: report
status: complete
created: 2026-07-20T13:22:46Z
---

# RELEASE Report v0.3.0

## Release

| Field | Result |
|-------|--------|
| Version | `v0.3.0` |
| Release commit | `ca4c513` |
| Tag | `v0.3.0` |
| Published at | `2026-07-20T13:21:12Z` |
| GitHub Release | https://github.com/vlln/obsidian-harness-frontend/releases/tag/v0.3.0 |
| Release workflow | https://github.com/vlln/obsidian-harness-frontend/actions/runs/29745733450 |
| Strategy | One-time public GitHub Release after draft asset verification |
| Rollback | Keep `v0.2.0` available as the previous stable release; withdraw `v0.3.0` if production smoke or monitoring fails |

## Staging Verification

Staging ran from release preparation commit `759d842` on `release/v0.3.0`.

| Gate | Result |
|------|--------|
| Clean dependency install | PASS |
| Lint and production build | PASS |
| Unit tests | PASS, 114/114 |
| Configured line coverage | PASS, 92.05% |
| Submission gate | PASS, 29/29 AC scenarios |
| Documentation build | PASS |
| Obsidian E2E | PASS, 16/16 |
| User manual test | PASS |
| Runtime dependency audit | PASS, 0 vulnerabilities |

The development toolchain audit still reports four moderate and two high findings in transitive build/E2E dependencies. They are not packaged in the Obsidian runtime, and available automated fixes require breaking dependency changes.

## Production Verification

The tag workflow built the plugin on GitHub Actions, generated build-provenance attestations and created a draft release. Before publication, all draft assets were downloaded and matched the staging artifacts. After publication, the same assets were downloaded again from their final public URLs.

| Asset | SHA-256 |
|-------|---------|
| `main.js` | `6660fd87686b8f302f8d4ee6b58468356199740aa8e542a88737ca9b328aae1d` |
| `manifest.json` | `5528c616292f6a1e3efd9cc276b76e657a9858d0f26e2f3a0eeff8e78388183d` |
| `styles.css` | `2a889b9a3fca6cb96574125ec0cbed98e1fa2e2399b0a6018de61a453cd27012` |

Production smoke confirmed:

- `manifest.json` reports plugin `obsidian-harness`, version `0.3.0`, and minimum Obsidian version `1.11.4`.
- GitHub's latest-release API returns public, non-prerelease tag `v0.3.0`.
- The release contains exactly `main.js`, `manifest.json`, and `styles.css`.
- Public asset digests match staging and GitHub release metadata.
- No production rollback signal was observed.

## Iteration Retrospective

### Delivered

- ACP-normalized semantic turn aggregation without streaming persistence.
- Stable separation of entry, local history, and opaque ACP session identities.
- Offline-first transcript rendering and explicit continuation/new-session actions.
- Crash checkpoints, localized corruption warnings, retryable write failures, and content-addressed large tool output.
- Strict v2 boundary with no development v1 compatibility or migration code.

### Problems Found

- Persistent Obsidian test leaves made global E2E selectors flaky; assertions were scoped to the target file-backed leaf.
- Pre-merge review found that restoration could select the entry's preferred Agent instead of the binding Agent; lifecycle E2E now covers mismatched identities.
- The previous `v0.2.0` tag workflow did not start. The `v0.3.0` workflow ran normally and produced attestations and a draft release, so no manual build fallback was needed.

### Improvements for the Next Iteration

- Keep continuation guarantees structural: restoration APIs must not receive a new-session capability.
- Continue using target-leaf E2E snapshots in persistent Obsidian workspaces.
- Treat external harness import/scan as a separate adapter workflow that emits the current transcript schema rather than expanding plugin-core backend knowledge.

## Decision

[PASS] Staging, production publication, asset integrity, provenance, public download smoke, monitoring checks and rollback readiness all passed. The v0.3.0 iteration is closed and may advance to DESIGN.
