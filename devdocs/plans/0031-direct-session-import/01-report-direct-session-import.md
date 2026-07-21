---
title: Report-0031-01: Direct Session Import
description: Execution evidence for collapsing the bundle/inspect/report protocol into one direct conversion command that writes a standard read-only v2 Obsidian Harness session the plugin reader consumes unchanged.
type: report
status: complete
created: 2026-07-21T06:30:00Z
---

# Report-0031-01: Direct Session Import

## Result

Replaced the unshipped bundle handoff protocol with a single direct conversion.
The companion `harness-session-importer` skill now understands Claude Code,
Codex, Pi Agent, and Kimi Code history and writes a standard Obsidian Harness
v2 session directly: a version-2 `.session` entry plus the plugin's manifest,
`turns.jsonl`, and content-addressed blobs. The plugin remains the only reader;
it consumes no external schema and no import protocol.

Removed the staging protocol, inspection/conversion reports, receipts,
confirmation flow, `.harness-import` materializer, contract fixtures, and the
E2E infrastructure that only existed to exercise the bundle handoff.

## Outputs

- One `import_session.py` command that emits a session wikilink and identity on
  success and structured JSON errors on failure.
- Four private adapters retained: explicit branch selection, deterministic v2
  turns, stable UUIDv5 identity, lossless tool output preserved as blobs above
  64 KiB, and unmapped tool results kept as explicit placeholder tool items
  rather than a separate report.
- Direct standard-format writer: v2 `.session` entry, transcript manifest,
  `turns.jsonl`, and blobs written with the plugin's on-disk layout.
- Idempotent re-import: an existing target reports `already_exists` and never
  overwrites.

## Gate Evidence

| Gate | Result | Evidence |
|------|--------|----------|
| Converter semantics | PASS | 9 Python tests: four adapters preserve turns/messages/tool results, branch selection is required and unmixed, dedup keeps tool + tail prompt, malformed source and CLI errors are structured. |
| Plugin reader compatibility | PASS | `test/session-import-plugin-reader.test.ts` runs the real Python importer end-to-end for all four harnesses, then reads output back through the plugin's own `parseSessionFileData` and `SessionStorage.readTranscript` from a real-filesystem adapter — no warnings, correct manifest/turns, and idempotent re-import. |
| Architecture boundary | PASS | `test/session-import-boundary.test.ts`: private harness markers and history paths stay out of plugin `src/`; project routing and obsolete bundle protocol markers stay out of the converter. |
| Fixture privacy | PASS | `npm run lint:importer-fixtures`: PASS. |
| MR gate | PASS | `npm run gate:mr`: lint, fixture lint, production build, 127 Vitest tests at 92.05% V8 line coverage, and 9 Python tests at 90% line coverage. |

## Scope Check

- No `.harness-import`, bundle, materializer, conversion report, receipt, or
  confirmation UI remains.
- No ACP continuation binding is written; imported sessions are read-only.
- No Folder Bridge, `PJ_*`, or project routing convention is embedded in the
  converter.
- No real session, home path, credential, or private prompt was committed.

## Associated Commits

- `5f09061` docs(design): simplify session import
- (this plan) test + implementation convergence to direct conversion
