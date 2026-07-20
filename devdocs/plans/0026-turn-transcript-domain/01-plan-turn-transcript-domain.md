---
title: Plan-0026-01: Turn Transcript Domain
description: Implement versioned TurnRecord types, deterministic ACP update aggregation, interruption semantics, and ChatMessage projection.
type: plan
status: done
created: 2026-07-20T11:17:04Z
---

# Plan-0026-01: Turn Transcript Domain

## Context

ADR-0005 replaces raw ACP event history with semantic turn snapshots. The ACP Client is the only layer that observes the complete outgoing prompt, normalized SessionUpdate stream and final stop reason; React message state remains a projection.

## Request

Create SDK-independent transcript domain types, a deterministic per-turn aggregator and a pure transcript-to-ChatMessage projection.

## Output Format

- `src/types/transcript.ts` with schema-versioned semantic records and blob references.
- `src/services/transcript-aggregator.ts` with start/apply/checkpoint/complete/interrupted operations.
- `src/services/transcript-projection.ts` that reconstructs stable UI messages without ACP replay.
- Unit tests covering AC-0007-E-1, AC-0008 and the semantic parts of AC-0009.
- Complete execution Report with scenario evidence and coverage.

## Constraints

- Types have no SDK, React or Obsidian imports.
- Aggregator accepts only internal ACP-normalized updates.
- Streaming chunks and repeated usage updates never appear in completed records.
- IDs and clocks are injectable for deterministic tests.
- Unknown semantic updates remain visible as unsupported items without persisting raw harness events.

## Checkpoint

Stop if ACP-normalized updates cannot determine a stable semantic order without relying on backend-private fields; return to DESIGN only if the accepted turn model itself becomes impossible.

## Steps

1. Write four-quadrant aggregator and projection tests from AC-0007/0008/0009.
2. Define transcript identities, content items, status and validation helpers.
3. Implement deterministic aggregation and final snapshot semantics.
4. Implement projection to ChatMessage state.
5. Run MR gate and record evidence.
