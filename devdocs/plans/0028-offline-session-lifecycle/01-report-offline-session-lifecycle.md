---
title: Report-0028-01: Offline Session Lifecycle
description: Verification evidence for v2 entries, offline history and continuation states.
type: report
status: complete
created: 2026-07-20T11:17:04Z
---

# Report-0028-01: Offline Session Lifecycle

## Result

Completed the schema-v2 session lifecycle. Each vault entry now owns stable `entryId` and `historyId` values plus an optional opaque ACP binding. Opening an entry parses v2 strictly, renders the local transcript first, and computes continuation availability without initializing an Agent.

The workspace distinguishes read-only, ready-to-continue, restoring, connected and backend-unavailable states. Continue and Start session are separate explicit actions. Restoration uses the binding's Agent and prefers ACP resume over load; the continuation service has no new-session capability, so failure cannot silently replace the local or ACP identities.

## Verification

| Check | Result | Evidence |
|------|--------|----------|
| Full MR gate | PASS | ESLint, production TypeScript/build and 114/114 unit tests |
| Configured target line coverage | PASS | 92.05% |
| Obsidian E2E | PASS | 16/16 across plugin materialization and offline lifecycle suites |
| Open-without-Agent invariant | PASS | Offline, continuable, unavailable, missing-history and v1 entries leave every ACP client uninitialized |
| Identity separation | PASS | Entry/index cleanup use `entryId` and `historyId`; successful and failed continuation preserve the opaque ACP binding |
| v1 compatibility paths | ABSENT | Strict entry/transcript v2 readers; no migration, legacy projection or raw-history fallback |

Commands:

```bash
npm run gate:mr
npm run test:e2e
npm run gate:submission -- --report devdocs/plans/0028-offline-session-lifecycle/01-report-offline-session-lifecycle.md --ac-file devdocs/ac/0003-acp-turn-transcript.md --min-lines 80
```

## Acceptance Evidence

| Scenario | Result | Evidence |
|----------|--------|----------|
| AC-0007-N-1 | [PASS] | Obsidian E2E renders the local prompt and answer from `turns.jsonl` while all ACP clients remain uninitialized; projection/storage unit suites cover ordered assistant, thought, tool and plan semantics. |
| AC-0007-B-1 | [PASS] | E2E opens valid history whose cwd does not exist and still renders its prompt and answer. |
| AC-0007-B-2 | [PASS] | Strict parser unit test and E2E reject a v1 entry with the actual/required version and do not initialize an Agent. Transcript reader also rejects unsupported manifest/record versions. |
| AC-0007-E-1 | [PASS] | Domain and storage tests retain unknown semantic types as visible typed placeholders while known items continue to project. |
| AC-0007-F-1 | [PASS] | E2E reports `Local history is unavailable` with the historyId instead of presenting an empty valid conversation. |
| AC-0008-N-1 | [PASS] | Aggregator golden test produces one complete turn with full prompt, merged chunks, one final tool snapshot and stable semantic order. |
| AC-0008-B-1 | [PASS] | Aggregator tests drop empty chunks, preserve message boundaries and keep final usage. |
| AC-0008-E-1 | [PASS] | Cancelled and error fixtures retain partial semantic content and available stop reason. |
| AC-0008-F-1 | [PASS] | Recorder/storage tests retain a pending completed turn on failure and expose an orphan checkpoint as interrupted without fabricating completion. |
| AC-0009-N-1 | [PASS] | Recorder coalesces streaming updates; storage atomically replaces one semantic checkpoint through temp-file rename. |
| AC-0009-B-1 | [PASS] | Reader suppresses a stale checkpoint when its turnId already exists in committed turns. |
| AC-0009-E-1 | [PASS] | Orphan checkpoint projects as interrupted without `endedAt` or `stopReason`. |
| AC-0009-F-1 | [PASS] | Rename fault injection preserves the last complete checkpoint and leaves the temp content retryable. |
| AC-0010-N-1 | [PASS] | E2E immediately renders history and Ready to continue using the binding Agent, with composer hidden and no initialized ACP client. |
| AC-0010-B-1 | [PASS] | E2E entry without a binding displays Read-only history, hides composer and performs no ACP lifecycle operation. |
| AC-0010-E-1 | [PASS] | E2E missing-Agent binding displays Backend unavailable with the exact condition while preserving local history and disabling composer; pure state tests cover missing cwd. |
| AC-0010-F-1 | [PASS] | E2E explicit continuation with unsupported restore transitions out of restoring to Backend unavailable and keeps history visible. |
| AC-0011-N-1 | [PASS] | E2E explicit Continue invokes resume with the original opaque sessionId, reaches Connected, enables composer and preserves all identities. |
| AC-0011-B-1 | [PASS] | Restore selection prefers ACP resume; E2E records exactly one resume call and zero newSession calls. |
| AC-0011-E-1 | [PASS] | Unsupported restoration produces the specific failure reason and leaves an independent Start session action. |
| AC-0011-F-1 | [PASS] | Failure E2E exits restoring with zero newSession calls and unchanged entryId, historyId and ACP binding; continuation unit test propagates restore failure. |
| AC-0012-N-1 | [PASS] | Manifest/turn round-trip verifies a committed turn is readable before matching checkpoint cleanup. |
| AC-0012-B-1 | [PASS] | Corrupt JSONL and duplicate turnId are skipped independently with structured persistent warnings. |
| AC-0012-E-1 | [PASS] | Corrupt manifest/checkpoint are localized while valid turns remain readable and diagnostics identify the damaged file. |
| AC-0012-F-1 | [PASS] | Recorder fault tests expose persistent History not saved state and retain active/pending records for retry. |
| AC-0013-N-1 | [PASS] | Large canonical tool output is SHA-256 addressed, written before its referencing turn and resolved on read. |
| AC-0013-B-1 | [PASS] | Identical outputs across turns share one digest and one blob. |
| AC-0013-E-1 | [PASS] | Missing and corrupt blobs yield localized placeholders and warnings containing the expected hash. |
| AC-0013-F-1 | [PASS] | Injected blob write failure prevents the referencing completed turn from being appended and remains retryable. |

## Commits

- `a3f298e test(session): define offline continuation lifecycle`
- `9362605 feat(session): implement offline-first continuation`

## Scope Notes

External harness scanning/import remains outside the plugin core. The plugin reads only ACP-derived schema-v2 transcripts. This iteration does not restore imported private histories, migrate v1 files, perform cross-backend migration or preserve token-level streaming events.
