---
title: Plan-0054-01: Release v0.5.1
description: Stage, publish and verify the Turn viewport synchronization patch release.
type: plan
status: done
created: 2026-07-27T10:02:03Z
---

# Plan-0054-01: Release v0.5.1

## Context

DEVELOP and SYSTEM_TEST are green for manual Turn synchronization, continuous bottom scrolling and the restored
message-container listener lifecycle. The user explicitly authorized production publication of `v0.5.1`.

## Request

Prepare a clean patch release from `develop`, verify its packaged assets in Obsidian, merge the accepted candidate
to `master`, tag it, verify the workflow-created draft, publish it once and merge the release back to `develop`.

## Output Format

- Version `0.5.1` in package, lockfile, manifest and Obsidian versions map.
- Changelog and release Report covering only the scrolling fixes.
- Public GitHub Release containing `main.js`, `manifest.json` and `styles.css` with verified hashes.
- `master`, `develop` and remote tag reconciled after production verification.

## Constraints

- Work from an isolated worktree; do not include importer or screenshot changes from the primary worktree.
- Do not publish if clean installation, production/documentation build, runtime audit, Obsidian smoke, version
  consistency, workflow, asset digest or manifest checks fail.
- Retain public `v0.5.0` as rollback target.
- Keep the patch release free of unrelated features and dependency updates.

## Checkpoint

Stop before publication if staging reveals a new risk or any production threshold fails. After publication,
withdraw `v0.5.1` if public assets or metadata differ from the accepted candidate.

## Steps

1. Create `release/v0.5.1` from the accepted `develop` head in an isolated worktree.
2. Bump and verify all release metadata; update Changelog, backlog and release documentation.
3. Run clean install, production/documentation builds, runtime dependency audit and focused Obsidian release smoke.
4. Record candidate asset sizes and SHA-256 digests, then push the release candidate.
5. Merge the candidate to `master`, tag `v0.5.1` and wait for the release workflow.
6. Verify the draft assets and provenance, publish once and perform public download smoke.
7. Merge the release branch back to `develop`, complete the Report, reconcile remotes and close RELEASE.
