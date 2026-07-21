---
title: Plan-0030-01: Harness Session Converter
description: Implement the companion skill CLI, four private source adapters, semantic conversion reports, stable identity, lossless blobs, and atomic generic bundle publication.
type: plan
status: done
created: 2026-07-20T16:45:00Z
---

# Plan-0030-01: Harness Session Converter

## Context

Plan-0029 established the shared Python/TypeScript contract, privacy fixtures, independent coverage and bundle handoff boundary. The old Autowiki prototype proved offline rendering but silently loses nested Codex tools, branch structure, tail prompts, full outputs and failure safety.

## Request

Implement the Obsidian Harness companion skill portion of Spec-0005: inspect one explicit Claude Code, Codex, Pi Agent or Kimi Code session and publish a source-agnostic `.harness-import` bundle after explicit acceptance.

## Output Format

- Standard-library Python CLI at `$_S/scripts/import_session.py` with `inspect` and `bundle` commands from Interface-0001.
- Private adapters and sanitized golden fixtures only inside `skills/harness-session-importer/`.
- Deterministic v2 turns, conversion report, stable UUIDv5 identities, JCS digests, lossless blobs, vault boundary enforcement and atomic descriptor publication.
- Updated `SKILL.md` procedure and complete Report with AC-0014/0015 evidence.

## Constraints

- Never write `.session`, formal transcript storage, receipt, transaction journal or session index.
- Do not read Folder Bridge/PJ conventions or scan default history roots.
- Do not infer branch, tool completion, final timestamps, ACP binding or Agent preference.
- Do not add Python runtime dependencies or commit real session data.
- Do not implement plugin validator, materializer, import UI or receipt reader.

## Checkpoint

Stop and classify the conversion as incomplete when a visible prompt, assistant item, tool call/result, relative order or final turn state cannot be mapped without guessing. Stop the Plan if the frozen generic bundle contract cannot represent a required visible source semantic.

## Steps

1. Add sanitized four-harness fixtures and AC-0014 adapter tests before implementation.
2. Implement strict source loading, identity/branch selection, semantic candidates and diagnostics.
3. Add JCS/UUID/digest vectors, blob and vault-boundary tests before the shared writer.
4. Implement inspect/bundle CLI, atomic staging, fsync, idempotent candidate detection and structured errors.
5. Update the skill workflow, run architecture/privacy/coverage/MR gates and write the Report.
