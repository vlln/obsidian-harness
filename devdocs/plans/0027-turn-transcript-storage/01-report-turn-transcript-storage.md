---
title: Report-0027-01: Turn Transcript Storage
description: Verification evidence for v2 transcript persistence, recovery and blobs.
type: report
status: complete
created: 2026-07-20T11:17:04Z
---

# Report-0027-01: Turn Transcript Storage

## Result

Replaced v1 raw `SessionUpdate` persistence with the schema-v2 transcript layout: `manifest.json`, immutable semantic turns in `turns.jsonl`, atomically replaced `active-turn.json`, and content-addressed tool-output blobs.

Added a `TranscriptRecorder` at the ACP Client prompt boundary. Session/load replay is ignored outside an active prompt. Active updates are checkpointed through a serialized debounce queue; completed, cancelled, error and interrupted turns are committed semantically. Persistence failure is observable and retains the aggregate or completed turn for retry without failing the live ACP response.

## Verification

| Check | Result | Evidence |
|------|--------|----------|
| Targeted storage/recorder tests | PASS | 18 tests across storage and recorder suites |
| Clean-worktree MR gate | PASS | lint, production build and 124/124 tests |
| Configured target line coverage | PASS | 92.1% |
| `SessionStorage` line coverage | PASS | 89.51% |
| `TranscriptRecorder` line coverage | PASS | 97.01% |
| v1 compatibility paths | ABSENT | raw writer, metadata/event append and raw event reader removed |

Commands:

```bash
npm run gate:mr
```

The gate was repeated from detached commit `334c3e8` in a clean temporary worktree, excluding the five uncommitted E1 experiment files.

## Acceptance Evidence

| Scenario | Result | Evidence |
|----------|--------|----------|
| AC-0007-E-1 | PASS | Future stored item types normalize to a visible `unknown` item containing only stable identity and type. |
| AC-0009-N-1 | PASS | Streaming updates coalesce into one semantic checkpoint; storage writes sibling temp then renames to `active-turn.json`. |
| AC-0009-B-1 | PASS | Reader suppresses a checkpoint whose turnId already exists in completed turns. |
| AC-0009-E-1 | PASS | Orphan active checkpoint projects as interrupted without `endedAt` or `stopReason`. |
| AC-0009-F-1 | PASS | Injected rename failure leaves the previous checkpoint intact and the temp file retryable. |
| AC-0012-N-1 | PASS | Manifest and turn round-trip; completed turn is verified readable before its matching checkpoint is removed. |
| AC-0012-B-1 | PASS | Corrupt JSONL line and duplicate turnId are skipped independently with structured warnings. |
| AC-0012-E-1 | PASS | Corrupt manifest/checkpoint are localized while valid completed turns remain readable. |
| AC-0012-F-1 | PASS | Checkpoint and commit failures set persistent error state and retain active/pending records until retry succeeds. |
| AC-0013-N-1 | PASS | Large canonical JSON is SHA-256 addressed and written before the referencing TurnRecord; read resolves original output. |
| AC-0013-B-1 | PASS | Identical output across turns produces one blob and a shared digest. |
| AC-0013-E-1 | PASS | Missing and hash-invalid blobs produce local placeholders and warnings with the expected digest. |
| AC-0013-F-1 | PASS | Injected blob write failure prevents any referencing turn append and remains retryable through the recorder. |

## Commits

- `f76720f test(transcript): define v2 storage failure behavior`
- `334c3e8 feat(transcript): persist semantic turns with checkpoints`

## Scope Notes

The ACP Client exposes `setTranscriptHistoryId()` and persistence-state observation. The old setter name remains only as a temporary source-level bridge because entry lifecycle is owned by dependent Plan 0028; that plan must remove the bridge and bind the recorder from the v2 entry's stable `historyId`, never from `acpSessionId`.

Likewise, current history list actions still use their pre-v2 identity parameter until Plan 0028 replaces entry/index lifecycle. No v1 files are read, migrated, projected or written by the storage service.
