---
title: RELEASE Report v0.6.0
description: Obsidian Harness v0.6.0 release verification for the unified agent configuration model and the session header navigator toggle.
type: report
status: complete
created: 2026-07-29T11:55:00Z
---

# RELEASE Report v0.6.0

## Release Candidate

| Field | Result |
|-------|--------|
| Version | `v0.6.0` |
| Release branch | `release/v0.6.0` (deleted after reconciliation) |
| Source commit | `c0e36a6` (`develop`, accepted DEVELOP and SYSTEM_TEST evidence through 0059) |
| Version preparation | `d8b4033` (`chore(release): bump version to 0.6.0`) |
| Previous public stable | `v0.5.1` |
| Rollback | Keep public `v0.5.1` available; withdraw `v0.6.0` and delete the remote tag on any production smoke failure |

This is a minor increment: unified `agents[]` configuration model with a single Agents settings section
(BL-0009), session header Navigator toggle (BL-0010), and importer test-coverage restoration (BL-0011).

## Staging Verification

Local-type project: deployment staging is exempt per the devloop project-form instantiation. Verification
evidence in place of staging:

| Gate | Result |
|------|--------|
| MR gate on develop | PASS: lint, importer fixtures, build, 238 unit tests, JS coverage 86.64%, Python coverage 90% |
| AC-0029 Agents settings WDIO | PASS: 8/8 (`e2e/settings-agents.spec.ts`) |
| AC-0027 Navigator toggle WDIO | PASS: 6/6 (`e2e/navigator-toggle.spec.ts`) |
| Full E2E regression on develop | PASS: 8/9 specs; the single red (`demo-vault-verify`) is a pre-existing suite-composition mismatch, PASS 1/1 under its dedicated `wdio.demo.conf.mts` — see Report-0059-01 |
| Version consistency | PASS: package, manifest and versions map report `0.6.0`; minimum Obsidian version `1.11.4` |

## Production Decision Contract (approved)

Human approval explicitly covered one-time publication, the `master` merge, the `v0.6.0` tag and the tag push.
Approved monitoring contract: the tag workflow succeeds within a 15-minute window and produces the GitHub
release; smoke = the published manifest reports plugin `obsidian-harness` version `0.6.0`. Rollback on any
failure without further consultation.

## Production Verification

| Gate | Result |
|------|--------|
| `master` merge | PASS: `31e0616` (`Merge release/v0.6.0`), pushed |
| Remote tag | PASS: `v0.6.0` points to `31e0616`, pushed |
| Tag workflow | PASS: run [30449201504](https://github.com/vlln/obsidian-harness-frontend/actions/runs/30449201504), ~2 min, well inside the 15-minute window |
| Draft inspection | PASS: exactly `main.js`, `manifest.json`, `styles.css`; all three SHA-256 digests matched the local production build (`main.js` 2b423a55…, `manifest.json` d00fd0d6…, `styles.css` fb338cd2…) |
| Public release | PASS: [v0.6.0](https://github.com/vlln/obsidian-harness-frontend/releases/tag/v0.6.0), published `2026-07-29T11:53:46Z`, non-draft, non-prerelease |
| Manifest smoke | PASS: published `manifest.json` reports id `obsidian-harness`, version `0.6.0`, minAppVersion `1.11.4` |
| `develop` reconciliation | PASS: `e09f0e5` (`Merge release/v0.6.0 back into develop`), pushed; remote/local release branch deleted |

No rollback trigger fired; public `v0.6.0` is active alongside `v0.5.1`.

## System Evidence

- [v0.6.0 SYSTEM_TEST Report](../plans/0059-v0.6.0-system-test/01-report-v0.6.0-system-test.md)
- [Agent config test infra Report](../plans/0055-agent-config-test-infra/01-report-agent-config-test-infra.md)
- [Importer coverage Report](../plans/0056-importer-coverage/01-report-importer-coverage.md)
- [Agent config unification Report](../plans/0057-agent-config-unification/01-report-agent-config-unification.md)
- [Navigator toggle button Report](../plans/0058-navigator-toggle-button/01-report-navigator-toggle-button.md)

## Retrospective

- SYSTEM_TEST earned its keep: it caught the BR-067 deviation (legacy ChatView rendering the Navigator
  toggle) that DEVELOP's acceptance review had missed. The fix loop worked as designed — permanent red
  reproduction first, minimal `fix/*` branch, green rerun, all inside SYSTEM_TEST without phase rollback.
- Schedule: single-day iteration as planned (DESIGN → TEST_INFRA → DEVELOP → SYSTEM_TEST → RELEASE on
  2026-07-29); no deviation worth correcting.
- Subagent provider instability (repeated `provider.connection_error`) cost some delegation attempts; the
  fallback of writing E2E in the main loop was effective and should remain the default when provider errors
  repeat.
- Surfaced debt, recorded non-blocking: BL-0012 (`demo-vault-verify` captured by the default wdio glob
  despite its dedicated config) and BL-0013 (offline-transcript assertion race). Both predate v0.6.0.
- Watch item: the full E2E suite mutates the shared `test/vaults/simple` (`copy: false`); accumulated
  session-file junk is harmless today but was the visible symptom behind the demo-vault-verify red. BL-0012
  should consider vault isolation alongside the glob exclusion.

## Decision

`[PASS]` Tag workflow, draft asset hashes, public release and manifest smoke all passed inside the approved
monitoring window. The release was reconciled back to `develop`; no rollback is required.
