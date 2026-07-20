---
title: Report-0026-01: Turn Transcript Domain
description: Verification evidence for transcript types, aggregation and UI projection.
type: report
status: complete
created: 2026-07-20T11:17:04Z
---

# Report-0026-01: Turn Transcript Domain

## Result

Implemented the SDK-independent schema-v2 turn domain, deterministic ACP-normalized update aggregation, isolated active checkpoints and pure `ChatMessage[]` projection.

The aggregator preserves only semantic snapshots: contiguous non-empty text and thought chunks are merged, tools and plans retain their first semantic position while receiving final state, and repeated usage/config updates retain only the final snapshot. Unknown update payloads are not persisted; their type is retained as a visible placeholder.

## Verification

| Check | Result | Evidence |
|------|--------|----------|
| Targeted domain tests | PASS | 12/12 tests in `test/transcript-aggregator.test.ts` |
| Full MR gate | PASS | lint, production TypeScript/build and 106/106 tests |
| Aggregator line coverage | PASS | 94.2% |
| Projection line coverage | PASS | 100% |
| Dependency boundaries | PASS | types have no SDK/React/Obsidian imports; services have no React imports |

Commands:

```bash
npx vitest run test/transcript-aggregator.test.ts --coverage
npm run gate:mr
```

## Acceptance Evidence

| Scenario | Result | Evidence |
|----------|--------|----------|
| AC-0007-E-1 | PASS | Unknown normalized update becomes a typed unsupported placeholder; private `sessionId`/payload is absent from the record; known items still project. |
| AC-0008-N-1 | PASS | Golden ACP fixture produces one complete turn with full prompt, merged text/thought, one final tool snapshot, stable semantic order and final usage. |
| AC-0008-B-1 | PASS | Empty chunks are dropped, repeated usage keeps the final value, and semantic boundaries split otherwise contiguous message chunks. |
| AC-0008-E-1 | PASS | Cancelled and error turns retain partial semantic content and available stop reason. |
| AC-0008-F-1 | PARTIAL | The domain can finalize an active checkpoint as interrupted without fabricating completion metadata; durable restart behavior belongs to Plan 0027. |
| AC-0009-N-1 | PARTIAL | `checkpoint()` returns the current semantic snapshot and later updates do not mutate the returned value; atomic persistence belongs to Plan 0027. |
| AC-0009-E-1 | PARTIAL | `interrupt()` retains checkpoint content with `status=interrupted` and no `endedAt` or `stopReason`; reader recovery belongs to Plan 0027. |

## Commits

- `c875e9f test(transcript): define semantic turn domain behavior`
- `ef85d8e feat(transcript): implement semantic turn domain`

## Scope Notes

ACP normalized updates do not expose backend-private commentary/final labels or an independent message ID. The aggregator therefore uses only protocol-observable semantic boundaries: contiguous chunks of the same kind merge, while tool, plan, thought and message transitions preserve separate ordered items. It does not infer private backend structure.

Storage, schema reader validation, active checkpoint scheduling and ACP Client recorder integration are intentionally deferred to Plan 0027. Entry lifecycle and offline-first UI are deferred to Plan 0028. The all-scenario submission gate must run only after those dependent containers are complete.
