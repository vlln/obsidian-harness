---
title: Plan-0056-01: Importer Coverage Restoration
description: 补齐 harness-session-importer Python 测试，恢复 gate:mr 覆盖率阈值 85%（BL-0011）。
type: plan
status: done
created: 2026-07-28T07:42:34Z
---

# Plan-0056-01: Importer Coverage Restoration

## Context

`d72f6f9`（refactor: harness-session-importer 重写为 direct AHS conversion）后，
`skills/harness-session-importer` 的 Python 覆盖率降至 81%（`python3 -m coverage`、
`.coveragerc` fail_under=85），`npm run gate:mr` 在干净 develop 上变红。该提交晚于 fork
最后一次 CI 绿跑，develop 从未跑过 CI，问题静默存在至今。BL-0011 记录为工程债，
是 v0.6.0 DEVELOP 的前置阻塞。

## Request

为 `skills/harness-session-importer` 补充 Python 单元测试，使
`npm run test:importer:coverage` 总覆盖率回到 ≥85% 且 `npm run gate:mr` 全绿。

## Output Format

- `skills/harness-session-importer/tests/` 下新增/扩展测试文件
- Report：记录修复前覆盖率、覆盖缺口分析（哪些行/分支未覆盖）、新增测试清单、
  修复后 `gate:mr` 全绿输出摘要

## Constraints

- 只新增/修改测试代码；不改 `skills/harness-session-importer` 的业务逻辑
  （若发现疑似 bug，记录在 Report 中上报，不顺手修）。
- 不降低 `.coveragerc` 的 fail_under 阈值，不通过 exclude 注释规避缺口。
- 新增测试必须测试真实行为断言，不写只调用不断言的空测试凑覆盖率。
- 沿用既有测试风格（`python3 -m unittest discover`，`test_*.py`）。
- 分支 `fix/0056-importer-coverage` 从 `develop` 拉出；代码与文档分开 commit。

## Checkpoint

若覆盖率缺口集中在无法用单元测试合理触达的代码路径（如真实 ACP 进程交互），
停止并上报，不强行 mock 到失真。

## Steps

1. 创建分支 `fix/0056-importer-coverage`。
2. 跑 `npm run test:importer:coverage`，用 `coverage report -m`（或 html/json）定位未覆盖行。
3. 按缺口补测试，迭代直至总覆盖率 ≥85%。
4. 跑完整 `npm run gate:mr` 确认全绿。
5. 写 `01-report-importer-coverage.md`（frontmatter: title/description/type: report/
   status: complete/created），更新容器 README 状态表，分开 commit。
