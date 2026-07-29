---
title: Report-0056-01: Importer Coverage Restoration
description: harness-session-importer Python 覆盖率从 81% 恢复至 90%，gate:mr 恢复全绿（BL-0011）。
type: report
status: complete
created: 2026-07-29T05:12:23Z
---

# Report-0056-01: Importer Coverage Restoration

## 结论

`npm run gate:mr` 恢复全绿（exit=0）。Python importer 总覆盖率 81% → **90%**
（阈值 85%），新增 20 个单元测试（27 → 47），全部有真实行为断言。

## 修复前状态

- `python3 -m coverage`：TOTAL 489 stmts / 94 miss / **81%**，`fail_under=85` 触发
  `Coverage failure: total of 81 is less than fail-under=85`。
- 根因：`d72f6f9`（importer 重写为 direct AHS conversion）后未补测试；该提交晚于
  fork 最后一次 CI 绿跑，develop 从未跑过 CI，门禁静默变红。

## 缺口分析（修复前 missing 行分布）

| 缺口 | 位置 | 性质 |
|------|------|------|
| 175-229（约 55 行） | `_run_ahs_export` subprocess 包装 | 既有测试整体 mock 掉该函数，函数体零覆盖 |
| 246-252、286-291 | `_read_ahs_archive` manifest/records 错误路径 | 异常分支未测 |
| 587-599 | `_project_ahs_to_turns` 的 model_change/compaction/goal_update 跳过分支 | fixture 不含这些记录类型 |
| 311-342、611-633 零散行 | `_tool_kind` 其他桶、`_ahs_usage_to_obsidian` 边界 | 分支未覆盖 |
| 46-63 | `ImportFailure.as_dict` 可选字段 | 未直接测 |

## 新增测试（`skills/harness-session-importer/tests/test_exporter.py`，20 个）

- `RunAhsExportTest`（8 个）：mock `subprocess.run` 覆盖 `_run_ahs_export` 全矩阵——
  成功路径 stdout 解析与命令构造、adapter_not_found、node_not_found、export_timeout、
  source_not_found（含 Node 警告行过滤断言）、source_invalid、generic export_failed、
  stdout 不可解析。
- `ReadAhsArchiveErrorTest`（5 个）：manifest 缺失/JSON 损坏、records 行损坏（断言
  行号）、空行跳过、records 文件 open 失败（定向 mock `Path.open`，不拦截 manifest 读取）。
- `ProjectionSkipTypesTest`（1 个）：三种跳过记录类型不产生 turn/item。
- `ToolKindTest`（1 个）：五个 kind 桶 + None 输入。
- `UsageConversionTest`（3 个）：非 dict 输入、used 合成、cost 透传与默认值。
- `ImportFailureTest`（2 个）：as_dict 可选字段有无两种情况。

## 门禁证据

```
Ran 47 tests in 0.037s — OK
TOTAL 489 stmts / 51 miss / 90%（阈值 85%）
npm run gate:mr → exit=0（lint、build、vitest coverage 82.2%、importer coverage 全过）
```

## 偏差与说明

- 修复过程中修正了自身一个测试设计错误：初版 `test_records_file_open_failure_raises`
  整体 mock `Path.open` 误拦截 manifest 读取，改为按路径定向注入。无业务代码改动。
- 未发现的疑似 bug；剩余 10% 未覆盖行为多为 CLI 入口、平台分支与深层防御性分支，
  未强行 mock 凑数（遵守 Plan Checkpoint）。
