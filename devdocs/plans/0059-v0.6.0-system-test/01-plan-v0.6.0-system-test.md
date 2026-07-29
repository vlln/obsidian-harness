---
title: Plan-0059-01: v0.6.0 System Test
description: 交付 AC-0029/AC-0027 的 WDIO E2E 用例并在 develop 上执行全量系统测试回归，产出 SYSTEM_TEST 测试报告与失败分类。
type: plan
status: pending
created: 2026-07-29T07:35:40Z
---

# Plan-0059-01: v0.6.0 System Test

## Context

v0.6.0 SYSTEM_TEST。DEVELOP 已闭环：0057（BL-0009，AC-0028/AC-0030 单元/集成层 PASS）、
0058（BL-0010 实现）。按测试执行边界，本阶段交付 WDIO 系统测试层用例：
[AC-0007](../../ac/0007-agent-configuration-unification.md) 的 AC-0029（全部场景）与
[AC-0006](../../ac/0006-session-workspace-experience.md) 的 AC-0027（全部场景）。

既有基建（已就绪）：
- `e2e/support/settings-tab.ts`（0055）：`openPluginSettingsAndWait`、
  `findSettingItemByName` 等设置页 helper；本机冒烟已通过。
- 既有 e2e 模式：`browser.execute` 取 `(window as any).app` 与插件实例
  （`app.plugins.plugins["obsidian-harness"]`）、`app.commands.executeCommandById`、
  workspace leaf 计数（`e2e/session-workspace.spec.ts:104-124`）、Notice 断言
  （`e2e/session-workspace.spec.ts:25-83`）、monkeypatch 故障注入。
- wdio 配置：`wdio.conf.mts`，vault `test/vaults/simple`，`plugins: ["."]`（构建产物，
  跑前需 `npm run build`），mocha，maxInstances 1。

## Request

1. 新增 `e2e/settings-agents.spec.ts`，覆盖 AC-0029 全部场景
   （N-1/N-2/N-3/N-4/B-1/B-2/E-1/F-1），断言精确到 AC 预期结果列
   （DOM 结构/字段顺序/文案/settings.agents 持久化/defaultAgentId 回退/空状态）。
2. 新增 `e2e/navigator-toggle.spec.ts`，覆盖 AC-0027 全部场景
   （N-1/N-2/B-1/B-2/E-1/F-1），含 workspace leaf 计数、动作一致性（按钮/ribbon/命令
   同一 `activateSessionManager`）、键盘激活与 aria-label、三宿主差异、故障注入 Notice。
   E-1（streaming/permission 中切换）若无法在黑盒层合理模拟真实 streaming，
   用最接近的可验证替代（如 monkeypatch session 状态后切换并断言状态不变），
   并在 Report 中说明替代依据，不静默降级。
3. 两个 spec 经 MR 门禁（lint/build）合并到 `develop`。
4. 在 `develop` 上执行**全量** WDIO 套件（既有全部 specs + 新增两个），一次跑完，
   提取失败用例名/断言/截图（如有）。
5. 产出测试报告：测试摘要表（各层通过/总数/失败/耗时）、失败分类（如有，
   按判定表）、阻塞级缺陷判定。

## Output Format

- `e2e/settings-agents.spec.ts`、`e2e/navigator-toggle.spec.ts`
- `01-report-v0.6.0-system-test.md`：AC 验收表（每场景 → PASS/FAIL → spec 用例名）、
  全量回归摘要表、失败分类与阻塞级判定

## Constraints

- 不新增功能代码、不改 `src/` 业务逻辑（发现 bug 走 `fix/*` 分支，先写最小复现测试）。
- 不修改 Spec/AC/ADR；用例与 AC 预期结果列逐字对齐。
- 既有 e2e specs 不改（除非因本轮 UI 变更必须适配——如 SettingsTab 结构变化影响既有
  spec，逐处在 Report 中说明）。
- 单元/Vitest 层不重复执行（DEVELOP 已归 gate 验证）。
- 代码与文档分开 commit；分支 `test/0059-v0.6.0-system-test`。

## Checkpoint

以下情况停止并上报：本机 WDIO 无法稳定运行（随机失败/环境抖动→疑似基建缺陷，
按判定表处理）；AC 预期在黑盒层无法验证且无合理替代（疑似设计缺陷）；发现阻塞级
缺陷（核心用户故事不可完成/数据丢失/安全问题）。

## Steps

1. 创建分支 `test/0059-v0.6.0-system-test`；`npm run build`。
2. 编写 `e2e/settings-agents.spec.ts` 并跑通（`npx wdio run wdio.conf.mts --spec`）。
3. 编写 `e2e/navigator-toggle.spec.ts` 并跑通。
4. MR 门禁相关项（lint/build）通过后合并到 `develop`。
5. 在 `develop` 上跑全量 `npm run test:e2e`，记录结果。
6. 写 Report + 容器 README 状态表，分开 commit。
