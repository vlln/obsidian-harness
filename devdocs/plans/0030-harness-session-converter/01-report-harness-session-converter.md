---
title: Report-0030-01: Harness Session Converter
description: Execution evidence for the companion skill CLI, four private source adapters, semantic conversion reports, stable identity, lossless blobs, and atomic generic bundle publication.
type: report
status: complete
created: 2026-07-21T05:05:03Z
---

# Report-0030-01: Harness Session Converter

## Result

Implemented the source-specific converter as the companion
`harness-session-importer` skill. Obsidian Harness remains ACP-only: the skill
understands Claude Code, Codex, Pi Agent, and Kimi Code history formats and
publishes only the source-agnostic bundle defined by Interface-0001.

The obsolete Autowiki prototype was removed after the replacement passed the
project gates. The converter does not write formal plugin transcript storage,
`.session` entries, receipts, transaction journals, or session indexes.

## Outputs

- `inspect` and `bundle` commands with structured JSON output and errors.
- Four private adapters with explicit branch selection, semantic diagnostics,
  deterministic v2 turns, and stable UUIDv5 identities.
- RFC 8785 canonical inputs for source and conversion digests.
- Content-addressed blobs for tool output larger than 64 KiB without truncation.
- Vault boundary checks, atomic descriptor publication, and idempotent bundle
  candidate detection.
- Sanitized fixtures, adapter tests, fault injection, architecture boundary
  checks, and an installable make-skill package.

## Gate Evidence

| Gate | Result | Evidence |
|------|--------|----------|
| AC-0014 semantic adapters | PASS | Four harness fixtures preserve expected turns, messages, tool calls/results, branches, tail prompts, and explicit degradations. |
| AC-0015 bundle contract | PASS | Large outputs remain lossless, duplicate blobs deduplicate, digests are reproducible, invalid vault targets fail, and injected write/fsync/rename failures publish no recognizable candidate. |
| Architecture boundary | PASS | Private harness markers remain inside the companion skill; plugin `src/` consumes no private source schema or default history path. |
| Fixture privacy | PASS | `npm run lint:importer-fixtures` accepted all committed fixtures. |
| MR gate | PASS | `npm run gate:mr`: lint, fixture lint, production build, 123 Vitest tests, 92.05% V8 line coverage, and 12 Python tests with 91% line coverage. |
| Skill packaging | PASS | `skit install . --skill harness-session-importer --dir <temporary-directory>` produced a standalone skill whose installed CLI completed a Codex inspect. |

`skit check` also inspected machine-wide active links and reported five unrelated
missing `.claude/skills` links. It did not report a packaging error for the new
skill and does not gate this repository-local installation check.

## Scope Check

- No plugin ACP lifecycle, validator, materializer, import workspace, or receipt
  reader was implemented.
- No Folder Bridge, `PJ_*`, or Autowiki convention is embedded in the converter.
- No imported source ID is treated as an ACP continuation binding.
- No real session, home path, credential, or private prompt was committed.

## Associated Commits

- `293e194` test(importer): define external conversion behavior
- `9ff5065` feat(importer): implement AC-0014 AC-0015 conversion
- `1a39109` test(importer): strengthen AC-0015 bundle guarantees
