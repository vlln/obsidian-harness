---
title: Report-0052-01: Turn Scroll System-Test Selector
description: Failure classification and rerun evidence for the v0.5.1 scroll WDIO leaf selector.
type: report
status: complete
created: 2026-07-27T09:38:12Z
---

# Report-0052-01: Turn Scroll System-Test Selector

## Failure Classification

| Observation | Classification | Basis |
|-------------|----------------|-------|
| First Plan 0051 run: new manual and bottom cases failed before product assertions | Local test-script bug | Both scenarios omitted the `workspaceTurnVisual` marker required by the shared width helper, so it could isolate a sibling leaf and leave the tested viewport at zero geometry |
| Failed manual teardown caused later visual tests to report zero-width screenshots | Local test-script bug | Scenario-owned marker/display cleanup did not run after an exception; failures cascaded into otherwise unrelated cases |
| Visible manual viewport remained at Turn 1 after scrolling | Local product bug, transferred to Plan 0053 | After selector/isolation fixes, diagnostic geometry showed a real scroll position and rendered virtual range while active state remained unchanged |

## Fix

- Both new scenarios now set and remove the width helper's `workspaceTurnVisual` marker.
- Suite-level `afterEach` restores leaf display and removes scroll scenario markers, preventing one failed case
  from invalidating later screenshots or geometry.
- The manual assertion retains its original expected ordinal and now reports a structured runtime snapshot on
  failure rather than only a timeout.

## Rerun Evidence

The first rerun still failed manual navigation and therefore did not establish a green system layer. The
focused diagnostic run produced:

```text
scrollTop=4691, scrollHeight=7768, clientHeight=683
first intersecting messageIndex=59, expected Turn=30, active Turn=1
virtual indexes=55..73
```

This proves the target leaf and virtual messages were visible. The remaining failure is not explained by the
selector: MessageList registered its scroll listener against the empty-state container, then history restore
replaced that DOM node without rerunning the effect. Plan 0053 owns that minimal product fix.

## Associated Commits

- `ac8e92b` `test(session): target active scroll workspace leaf`
- `75755c9` `test(session): isolate scroll scenario teardown`

## Conclusion

`[PASS]` The system-test selector and teardown defects are fixed with stronger failure diagnostics. The SYSTEM_TEST
layer remains `[FAIL]` due to a separately classified local product bug; no Spec, AC or infrastructure defect
was found.
