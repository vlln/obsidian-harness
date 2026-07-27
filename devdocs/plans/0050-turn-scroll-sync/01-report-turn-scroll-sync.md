---
title: Report-0050-01: Turn Scroll Sync
description: Incremental test-infrastructure audit and implementation evidence for active Turn synchronization and shared continuous message scrolling.
type: report
status: draft
created: 2026-07-27T08:37:31Z
---

# Report-0050-01: Turn Scroll Sync

## Incremental Test Infrastructure Audit

| Check | Result | Basis and evidence |
|-------|--------|--------------------|
| Accepted decisions cover the required layers | PASS | ADR-0004 selects Vitest, WDIO Obsidian Service and GitHub Actions; ADR-0011 assigns pure logic/fault branches to Vitest and real Obsidian UI behavior to WDIO |
| Unit seam is supported without new DOM infrastructure | PASS | The Plan places the importable coordinator in `src/ui/message-scroll-coordinator.ts`; it can use injected container/target/timer interfaces in the existing Node Vitest environment without importing React or Obsidian APIs |
| Manual-scroll and long-Session UI verification is supported | PASS | `e2e/session-workspace.spec.ts` already creates a 48-turn `.session` fixture, opens a real FileView, changes viewport width, records `scrollTo`, observes `aria-current` and queries virtual message geometry |
| Reduced motion, fault and timer controls are supported | PASS | Existing Vitest fake timers and injected coordinator interfaces cover deadlines/fallbacks; WDIO `browser.execute` can override `matchMedia`, dispatch input events and record native scroll calls |
| Coverage and delivery gates support the increment | PASS | `test:coverage`, `gate:mr` and scenario-subset `gate:submission` already exist; no parser, threshold, config or workflow change is required |
| Architecture rules remain aligned | PASS | The helper remains UI-owned and is consumed by MessageList; no services-to-UI dependency, persistence owner or ACP boundary changes |
| Mock, paid dependency and deployment changes | NOT APPLICABLE | Scrolling is local browser/virtualizer behavior with no external API, network, paid resource or packaging change |
| New test-infrastructure ADR or execution container | NOT REQUIRED | ADR-0011 explicitly covers this UI/projection split and rejects duplicate component-test frameworks; no new dependency or test layer is introduced |

The accepted infrastructure was previously self-proven by the evidence recorded in ADR-0011 and
Report-0041. Because this increment changes no framework, configuration, gate or CI workflow, those tests are
reused rather than rerun during TEST_INFRA. Concrete Vitest and WDIO assertions belong to the DEVELOP Plan;
WDIO execution remains owned by SYSTEM_TEST.

## DEVELOP Evidence

Pending implementation.

## SYSTEM_TEST Evidence

Pending execution on `develop` under a separate SYSTEM_TEST Plan.
