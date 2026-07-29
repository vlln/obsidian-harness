---
title: Plan-0055-01: Agent Config Test Infra
description: v0.6.0 TEST_INFRA 增量——扩建 Obsidian stub（secretStorage）、校准 coverage 白名单、搭建 Obsidian 原生设置页 E2E helper。
type: plan
status: pending
created: 2026-07-28T07:42:34Z
---

# Plan-0055-01: Agent Config Test Infra

## Context

v0.6.0 迭代（BL-0009 统一 Agent 配置模型 + BL-0010 Navigator 切换按钮）的 AC 已冻结：
AC-0028/AC-0030（`devdocs/ac/0007-agent-configuration-unification.md`）需要 Vitest 侧的
secretStorage stub、coverage 白名单覆盖 settings 相关服务；AC-0029 需要驱动 Obsidian 原生
设置页的 WDIO E2E 能力。增量检查确认 ADR-0004/0011 的框架选型（Vitest + WDIO + GitHub
Actions）完全覆盖本轮需求，无新框架/依赖；本地 `npm run test` 202 passed 全绿，CI 门禁配置
无漂移。缺口只有三个基建组件。

## Request

搭建三个测试基建组件，均不含任何 AC 具体测试用例（用例属 DEVELOP 职责）：

1. **secretStorage stub**：扩建 `test/stubs/obsidian.ts`（现仅 14 行、只有 `Platform`），
   增加 Obsidian secretStorage 的内存实现：`getSecret`/`setSecret`/`deleteSecret`，
   支持故障注入（下次读取抛错）与调用记录（spy），供 AC-0028/AC-0030 的单元与集成测试使用。
   参照 `test/support/memory-data-adapter.ts` 的 `failNext` 模式。
2. **coverage 白名单校准**：`vitest.config.mts` 的 coverage include 增补
   `src/services/session-helpers.ts` 与 `src/services/settings-normalizer.ts`
   （二者是 AC-0028/0030 的直接测试目标；`src/plugin.ts` 是否纳入由 DEVELOP 的规范化抽离
   决策决定，本 Plan 不动）。增补后 `npm run gate:mr` 必须保持全绿——若阈值不足，
   为这两个**既有纯服务**补充覆盖面单测（属覆盖率校准，非 AC 用例）。
3. **设置页 E2E helper**：在 `e2e/support/` 新增 helper，封装打开插件设置页
   （`app.setting.openTabById(plugin.manifest.id)`，用法先例见 `src/ui/ChatPanel.tsx:421`）、
   等待设置 DOM 就绪、按名称定位 Setting 行三项基础能力。不编写任何 AC-0029 用例。

## Output Format

- `test/stubs/obsidian.ts` 扩展（保持向后兼容：既有 `Platform` 导出与全部现有测试不受影响）
- `vitest.config.mts` coverage include 更新
- `e2e/support/` 新 helper 文件
- Report：逐项记录门禁自证结论 + 依据 + 证据路径

## Constraints

- 不编写 AC-0027~0030 的任何具体测试用例；不修改 `src/` 业务代码、Spec 或 ADR。
- 不新增测试框架或 npm 依赖（ADR-0004/0011 边界）。
- AR-012-1~5 的静态 boundary 检查**不在本容器**——其断言目标态在实现落地前必然红，
  作为 DEVELOP feat 分支内交付物（已记录在增量检查结论中）。
- stub 故障注入/调用记录 API 风格与 `test/support/memory-data-adapter.ts` 一致。
- 文档变更与代码变更分开 commit；分支 `test/0055-agent-config-test-infra` 从 `develop` 拉出。

## Checkpoint

若出现以下情况停止并上报：扩建 stub 导致任一既有测试失败；coverage 白名单增补后无法在不
大规模补测既有服务的情况下维持门禁阈值；本机无法启动 WDIO（此时 helper 仍交付源码，
冒烟自证项在 Report 中标注为环境受限并说明依据）。

## Steps

1. 创建分支 `test/0055-agent-config-test-infra`。
2. 扩建 `test/stubs/obsidian.ts`：secretStorage 内存实现 + `failNext` 式故障注入 +
   调用记录。为 stub 写自证单测（roundtrip、故障注入只生效一次、spy 记录准确），
   放在 `test/` 下（如 `test/obsidian-stub.test.ts`）。
3. `vitest.config.mts` coverage include 增补两个 service 文件；跑 `npm run gate:mr`，
   若覆盖率阈值不足则为这两个既有纯服务补校准单测，直至门禁全绿。
4. 编写 `e2e/support/` 设置页 helper；用一段临时 scratch spec 冒烟验证能打开设置页并定位
   到 `Node.js path` 设置行，随后删除 scratch spec（helper 冒烟证据记入 Report）。
5. 自证汇总写入 `01-report-agent-config-test-infra.md`（结论 + 依据 + 证据路径），
   更新容器 README 状态表。
6. 提交（代码与文档分开 commit），保持分支待合并。
