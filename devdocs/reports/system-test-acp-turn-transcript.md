---
title: SYSTEM_TEST Report: ACP Turn Transcript
description: ACP turn transcript iteration system verification across Obsidian integration, lifecycle E2E, visual states and security boundaries.
type: report
status: complete
created: 2026-07-20T12:54:04Z
---

# SYSTEM_TEST Report: ACP Turn Transcript

## Result

The ACP turn transcript iteration passed system verification on merged `develop` commit `b8f2076`. Local transcript reading, strict v2 entries, explicit continuation and failure isolation behave as one integrated Obsidian workflow. No Agent or paid API was required for offline reading.

## Test Summary

| Test layer | Passed/total | Failures | Duration |
|------------|--------------|----------|----------|
| Obsidian service integration | 9/9 | None | 5 s |
| Full browser-driven system E2E | 16/16 | None | 8 s |
| Visual workspace states | 3/3 | None | 3 s |
| Production dependency audit | 0 vulnerabilities | None | <1 s |
| Architecture/security boundaries | 4/4 | None | <1 s |

Commands:

```bash
npx wdio run wdio.conf.mts --spec ./e2e/plugin-load.spec.ts
npm run test:e2e
npm audit --omit=dev --audit-level=high
```

## System Semantics

| Behavior | Result | Evidence |
|----------|--------|----------|
| Offline history | PASS | Prompt and answer render from local v2 transcript with all ACP clients uninitialized. |
| Continuation candidate | PASS | Binding Agent, cwd and static configuration produce Ready to continue without spawning an Agent. |
| Successful continuation | PASS | Explicit Continue invokes ACP resume with the original opaque ID, enables composer and does not call newSession. |
| Failed continuation | PASS | Unsupported restore exits restoring, preserves visible history and all identities, and calls newSession zero times. |
| Backend unavailable | PASS | Missing Agent is identified in-workspace while history remains readable. |
| Version and corruption handling | PASS | v1 entry and missing transcript produce explicit persistent errors without fallback or Agent startup. |

## Visual Review

Read-only, Ready to continue and Backend unavailable states were captured from the isolated Obsidian test vault at a 1024x768 viewport. At a roughly 368 px target leaf width, status copy, action buttons, prompt and answer remained readable without overlap, clipping or layout shift. The unavailable state used the existing error color token without obscuring transcript content.

## Specialized Checks

- Runtime dependency audit: zero vulnerabilities.
- ACP SDK imports occur only under `src/acp/`.
- `src/services/` contains no React imports.
- `src/` contains no Claude Code, Codex or Pi private history paths or parsers.
- Repository scan found no literal OpenAI-style secret values; key names are configuration metadata only.
- Paid dependency validation was not applicable: offline/system tests do not call model APIs.

## Failure Classification

| Category | Count | Notes |
|----------|-------|-------|
| Test infrastructure defect | 0 | All test layers stable on merged develop. |
| Design defect | 0 | Frozen Spec/AC/ADR semantics held. |
| Local bug | 0 | No SYSTEM_TEST repair branch required. |
| Blocking defect | 0 | Release transition is allowed. |

The optional Relay workflow remains unable to run without repository OpenClaw secrets. It is not part of the plugin build, transcript runtime or release gate.

## Decision

[PASS] All applicable system test layers passed. `develop` is ready to enter RELEASE.
