---
title: ADR-0011: Session Navigator 测试基建复用
description: Session Navigator 复用既有 Vitest、WDIO Obsidian Service、GitHub Actions、coverage 和 delivery gates，不新增测试框架或依赖。
type: adr
status: accepted
created: 2026-07-26T05:39:33Z
---

# ADR-0011: Session Navigator 测试基建复用

## 背景

Spec-0006、AC-0005 和 ADR-0010 已定义 Session Navigator。仓库已经通过
[ADR-0004](0004-test-infra.md) 与 Plan-0025 建立 Vitest、WDIO Obsidian Service、
GitHub Actions、V8 coverage、故障注入 storage、E2E fixture 和 submission gate。

初版 ADR-0011 曾计划增加 happy-dom、Testing Library、WDIO Visual Service 和 jscpd。
复核后确认这些工具不是实现本功能的必要前置条件，会重复现有 WDIO UI 验证能力并扩大
TEST_INFRA 范围。AC-0005 的产品预期不变，仅将验证层改为现有 Vitest + WDIO。

## 决策

**Session Navigator 不新增测试框架、开发依赖或 TEST_INFRA 执行 Plan，直接复用现有基建。**

| 验证层 | 现有能力 | 本轮用法 |
|--------|----------|----------|
| 纯逻辑/服务集成 | Vitest + Obsidian stub + MemoryDataAdapter | Catalog 排序、状态合并、竞态、reconciliation、失败保留和搜索 |
| UI/交互/可访问性 | WDIO Obsidian Service | 真实 ItemView 中验证 Projects、Recents、搜索、菜单、键盘和状态图标 |
| 视觉/布局 | WDIO `saveScreenshot` + DOM geometry | 在 SYSTEM_TEST 固定 260/420 px 与明暗主题截图，由 Agent/人类对照批准设计审查 |
| 性能 | Vitest monotonic timing + storage spy | 运行时生成 500 条脱敏 fixture，验证冷加载、搜索和零写入预算 |
| 架构边界 | Vitest architecture test + ESLint | 按既有 `session-import-boundary.test.ts` 模式检查 ADR-0010 禁止依赖 |
| MR/提测门禁 | `gate:mr` + `gate:submission` | 复用 coverage 80% 和 AC 场景 PASS 证据检查 |

具体 fixtures、测试和截图脚本属于 Session Navigator 的 DEVELOP Plan，与业务实现共同编写；
不在 TEST_INFRA 预先制造一套抽象 harness。

## 测试执行边界

- DEVELOP MR gate：Vitest 单元/集成、lint、build、coverage 和 submission report 检查。
- SYSTEM_TEST：WDIO E2E、截图审查和 500 条性能专项各执行一次，不在 MR gate 重复。
- 测试不启动真实 Agent、不访问网络、不读取用户 vault/home/Agent history。
- 本功能没有外部 API、付费依赖或新部署平台；Mock 服务、沙箱账号和部署底座变更不适用。

## 备选方案

### A. 新增 happy-dom + Testing Library

可以做隔离 React 组件测试，但需要扩展 Obsidian DOM/Menu/Icon stub，并与真实 ItemView E2E
重复覆盖。拒绝，交互行为统一在现有 WDIO 中验证。

### B. 新增 WDIO Visual Service

可自动像素 diff，但当前固定视觉基线尚未建立，工具会增加环境绑定和依赖维护。拒绝；本轮由
WDIO 保存截图并结合 DOM geometry 做确定性布局断言，SYSTEM_TEST 审查实际截图。

### C. 新增 jscpd/architecture 工具

本轮只有明确的少量依赖边界，现有 ESLint 和 Vitest repository-boundary 测试可以表达。
拒绝新增工具；若未来出现跨模块规则规模化需求，再单独设计。

## 后果

### 正面

- 直接进入业务开发，无依赖安装和重复测试工具维护成本。
- UI 验证发生在真实 Obsidian，而不是日益复杂的 DOM stub。
- 继续使用已经自证的 coverage、故障注入和 delivery gate。

### 负面

- WDIO 反馈慢于 DOM 组件测试，因此纯逻辑必须尽量下沉到 service 并由 Vitest 覆盖。
- 截图审查不是每次 MR 自动像素 diff，需要 SYSTEM_TEST 明确保存和审阅证据。

## 验证

无需新增基建代码。既有能力已由以下证据验证：

- Plan-0005 Report：lint、Vitest、build、WDIO 均通过；
- Plan-0025 Report：MR 正反门禁、coverage 准确性、submission gate 正反例和 WDIO 9/9 通过；
- `e2e/offline-transcript.spec.ts` 已证明 WDIO 可在真实 `.session` FileView 中注入 fixture、
  查询 DOM、切换状态并完成 teardown；
- WebdriverIO 自带 `saveScreenshot`，无需额外 service 即可产出 SYSTEM_TEST 审查图片。

因此本轮 TEST_INFRA 无增量产出，不创建执行容器；进入 DEVELOP 后按 AC-0005 编写具体测试。

## 约束范围

Session Navigator DEVELOP Plan、Vitest tests、WDIO E2E、SYSTEM_TEST 截图与性能报告；
不修改全局测试框架或依赖。

## 约束规则

| 规则编号 | 规则 | 适用范围 | 违反时如何检出 |
|----------|------|----------|----------------|
| AR-011-01 | 不新增 Session Navigator 专用测试框架或开发依赖 | package/config | lockfile review |
| AR-011-02 | 纯逻辑和故障分支使用 Vitest，真实 UI 行为使用 WDIO | DEVELOP tests | test location review |
| AR-011-03 | 截图和性能只在 SYSTEM_TEST 执行一次 | CI/scripts | workflow review |
| AR-011-04 | fixtures 为运行时生成的脱敏数据，不读取用户环境 | tests/e2e | fixture boundary test |
| AR-011-05 | ADR-0010 依赖边界使用现有 ESLint/Vitest 机器化 | architecture tests | MR gate |

## 与既有决策的关系

| 既有规则 | 处理 |
|----------|------|
| ADR-0004：Vitest + WDIO + GitHub Actions | 原样复用 |
| ADR-0007：fixture 脱敏且 CI 不访问真实 harness | 原样复用 |
| ADR-0010：Catalog/runtime/UI 依赖边界 | 由现有 ESLint + Vitest architecture test 验证 |
