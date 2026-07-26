---
title: ADR-0011: Session Navigator Test Infrastructure
description: 复用 Vitest/WDIO/GitHub Actions，补充 React 组件 harness、Obsidian 视觉回归、Catalog 事件与性能 fixtures、质量和架构门禁。
type: adr
status: proposed
created: 2026-07-26T05:39:33Z
---

# ADR-0011: Session Navigator Test Infrastructure

## 背景

[Spec-0006](../spec/0006-session-navigator.md)、
[AC-0005](../ac/0005-session-navigator.md) 和
[ADR-0010](0010-session-catalog-projection.md) 已冻结。现有
[ADR-0004](0004-test-infra.md) 确定 Vitest、WDIO Obsidian Service 和 GitHub Actions，
仓库已有 V8 coverage、故障注入 DataAdapter、真实 Obsidian E2E 与 submission gate。

本轮新增风险不是测试框架缺失，而是现有 Node-only Vitest 无法渲染 React、WDIO 没有截图
基线比较、Catalog 缺少可控 vault/runtime 事件和 500 条数据工厂、ADR-0010 的依赖方向尚未
机器化。需要增量补齐这些能力，不重建已稳定的测试栈，也不在 TEST_INFRA 编写具体业务断言。

## 决策

**继续使用 Vitest、WDIO Obsidian Service 和 GitHub Actions；新增 happy-dom + React Testing
Library 组件项目、WDIO Visual Service、确定性 Session Catalog harness，以及作用于本轮模块
的 ESLint/jscpd 质量与架构门禁。**

### 1. 测试层级与执行点

| 层级 | 目的 | 框架 | 位置 | 唯一执行点 |
|------|------|------|------|------------|
| 单元测试 | Catalog 排序、去重、状态优先级、generation、搜索纯函数 | Vitest node | `test/` | DEVELOP MR gate |
| 组件测试 | Navigator 结构、键盘、搜索、状态槽、错误/空/loading state | Vitest happy-dom + Testing Library | `test/components/` | DEVELOP MR gate |
| 开发集成测试 | SessionStorage reconciliation、vault/runtime 订阅和故障恢复 | Vitest node + harness | `test/` | DEVELOP MR gate |
| Obsidian E2E | FileView、workspace、vault create/rename/delete、真实主题和侧栏 | WDIO Obsidian Service | `e2e/` | SYSTEM_TEST |
| 视觉回归 | 260/420 px、明暗主题、长文本、状态和选中态截图 | WDIO Visual Service | `e2e/visual/` | SYSTEM_TEST |
| 性能专项 | 500 条冷加载与搜索预算、磁盘 read/write spy | Vitest performance harness | `test/performance/` | SYSTEM_TEST |

组件测试不替代真实 Obsidian E2E；视觉回归不进入高频 MR gate，避免操作系统字体和 Electron
渲染差异造成噪声。SYSTEM_TEST 在同一固定 Obsidian/Electron/macOS 基线环境运行一次。

### 2. Vitest 组件项目

保留现有 `vitest.config.mts` 的 Node 项目，新增 `vitest.component.config.mts`：

- environment 使用 `happy-dom`；
- React 渲染、查询和用户交互使用 `@testing-library/react` 与
  `@testing-library/user-event`；
- `obsidian` 继续 alias 到测试 stub，stub 扩展 `setIcon`、`Menu`、`TFile`、`Notice` 和
  最小 workspace/vault 类型行为；
- 每个测试自动 cleanup DOM、fake timer 和 subscriber；
- 不通过测试专用分支改变生产组件行为。

新增 `test:unit`、`test:component` 和 `test:coverage` 入口；`test` 运行 unit + component。
V8 coverage 合并两个项目的报告，并覆盖本轮 `session-catalog.ts`、runtime registry 和
`SessionManagerView.tsx`。本轮新增/修改模块 lines 下限为 80%，不得用既有高覆盖模块稀释。

### 3. Catalog 测试数据与事件 Harness

新增纯测试支持模块，不导入生产实现：

| Harness | 能力 |
|---------|------|
| Session factory | 确定性生成 0、1、跨 cwd、同 basename、长标题和 500 条 v2 entry/index |
| Vault event harness | create、modify、rename、delete，带虚拟时间和事件日志 |
| Runtime harness | 按 entryId + viewId 发布所有状态及多实例组合 |
| Async read controller | 控制 read resolve/reject 顺序、并发峰值和 generation 竞态 |
| Storage spy | 记录 read/write/append/rename/remove，支持现有 occurrence/checkpoint failure |
| Performance budget | 使用 monotonic clock 记录 cold load/search，并输出数据量和耗时 |

fixtures 使用固定时间、UUID、cwd 和 entryFile；不得读取用户 vault、home 或真实 Agent history。
500 条 fixture 在测试运行时生成，不再提交数百个 `.session` 文件。

### 4. Obsidian E2E 与视觉回归

继续使用 `wdio-obsidian-service` 启动真实 Obsidian。新增通用 E2E helper：

- 原子创建/清理一组 v2 `.session` 和 index；
- 打开 Session Navigator，设置 left leaf 宽度并返回稳定 root selector；
- 切换 Obsidian light/dark theme；
- 发布测试 runtime status，不启动 Agent；
- 等待 Catalog generation settled，禁止使用固定长 pause 判断完成；
- 在 teardown 恢复 workspace、主题、entry、index 和 plugin-local test data。

视觉比较使用 `@wdio/visual-service`，只截取 Navigator root，不截取整个桌面。基线位于
`e2e/visual/baselines/<platform>/`，固定 Obsidian/Electron 版本、device scale factor、字体、
动画和光标。允许的像素差阈值记录在配置中，默认 mismatch percentage 为 0.1%；任何阈值
调整必须在 Report 中附 before/after diff，不能用提高阈值掩盖布局回归。

TEST_INFRA 只提供一个独立的视觉 smoke fixture 证明截图、比较和 diff artifact 可用；
Session Navigator 的具体四组产品基线由 DEVELOP 编写，SYSTEM_TEST 执行。

### 5. 质量与架构门禁

现有 ESLint 增加只作用于 Session Navigator 新增/重写模块的保守阈值：

| 规则 | 阈值 |
|------|------|
| `complexity` | 15 |
| `max-depth` | 4 |
| `max-lines-per-function` | 120，跳过空行和注释 |
| `max-lines` | 600，跳过空行和注释 |

重复代码使用 `jscpd`，扫描本轮 Catalog、runtime registry、Navigator UI 与测试 support，
`min-lines=12`、`min-tokens=70`、总重复率上限 5%。扫描路径由配置显式列出，不扫描生成产物、
fixtures、baselines 或既有 importer 代码。

架构规则使用 ESLint `no-restricted-imports` 机器化 ADR-0010：

- `src/services/session-catalog.ts` 不得导入 React、UI 或 ACP SDK；
- runtime registry 不得导入 React、Obsidian view 子类或 ACP SDK；
- `SessionManagerView.tsx` 不得直接导入 SessionStorage 或 ACP SDK；
- Catalog/UI 不得写入 runtime status 或持久化 Catalog snapshot。

最后一项通过 architecture smoke 对禁止的写入 API/标识符做结构化 TypeScript AST 检查，
使用仓库已有 `typescript` parser API，不使用正则解析 imports。`gate:quality` 汇总 ESLint、
jscpd 和 architecture smoke，进入 `gate:mr`。

### 6. CI、覆盖率与提测门禁

保留 GitHub Actions `pull_request` MR gate 与现有 importer checks：

```text
gate:mr
├── lint + gate:quality
├── build
├── test:unit + test:component
├── V8 coverage >= 80% lines
└── importer fixture/Python coverage（既有）
```

WDIO E2E、视觉回归和 500 条性能专项不在 MR gate 重复运行；它们由 SYSTEM_TEST 的独立命令
一次执行并上传 screenshot/diff/trace/performance JSON artifacts。

现有 `gate:submission` 已能从 AC 文档提取所有 N/B/E/F ID，本轮复用并以
`devdocs/ac/0005-session-navigator.md` 作为 `--ac-file`。Report 必须逐场景记录 PASS 证据，
并读取本轮 V8 coverage summary；没有 Python 新模块，因此不要求新增 Python coverage。

新增通用 `check:system-ac-coverage`：用 Markdown parser 提取 AC 文件中的场景 ID，再检查
指定 E2E/视觉/性能测试清单中的场景标签，报告缺失、重复和未知 ID。TEST_INFRA 用人工最小
AC/test manifest fixture 证明正例通过、缺失场景失败；Session Navigator 的真实标签和断言由
DEVELOP 添加，SYSTEM_TEST 在执行前静态检查一次。

### 7. 自证方式

基建 Plan 必须提供以下正反证据：

1. component smoke 能渲染、查询、键盘触发并 cleanup 一个测试组件；
2. visual smoke 首次基线匹配通过，注入 2 px 位移后比较失败并产生 diff；
3. fake vault/runtime 事件顺序确定，500 条 factory 每次输出相同 identity/order；
4. async controller 能让旧 generation 后完成，并证明 harness 可观察 stale completion；
5. MR gate 对故意失败的 unit/component test、低 coverage、超复杂函数、重复块和禁用 import
   分别返回非零；临时反例不提交；
6. submission gate 拒绝缺少任一 AC-0017 至 AC-0022 场景或覆盖率不足的 Report；
7. coverage summary 与一个已知 10 行、执行 8 行的临时基线一致为 80%；
8. WDIO/visual smoke 在固定环境启动、比较并完成 teardown。

### 8. 适用性实例化

| 基建项 | 本轮处理 |
|--------|----------|
| 单元/组件/系统/视觉/性能 | 适用，按本 ADR 增量搭建 |
| CI、MR、质量、架构、coverage、submission gate | 适用，扩展现有 GitHub Actions 与 scripts |
| 测试数据策略 | 适用，使用确定性脱敏 factory 和隔离 vault fixture |
| Mock 服务/契约测试 | 不适用；本功能没有外部服务/API，Obsidian stub 是本地运行时替身而非服务 contract |
| 付费依赖与沙箱账号 | 不适用；测试不启动 Agent、不访问网络、不调用计费 API |
| 部署底座 | 沿用现有 `.github/workflows/release.yaml` 的插件打包/release 流程；本轮无新部署平台 |

## 备选方案

### A. 所有 UI 验收只用 WDIO

真实度高，但每个键盘、空状态和搜索组合都启动 Electron，反馈慢且难注入竞态。拒绝；组件
行为走 happy-dom，Obsidian 集成和视觉走 WDIO。

### B. 使用 Playwright Component/Chromium 截图

工具成熟，但 Obsidian CSS variables、ItemView、Electron 字体和主题与浏览器页面不同，还会
引入第二套 E2E runner。拒绝，沿用 WDIO Obsidian Service。

### C. 使用 jsdom

React Testing Library 支持成熟，但本需求不依赖复杂浏览器布局；happy-dom 启动更轻，足以
覆盖事件、焦点、ARIA 和条件渲染。真实布局仍由 WDIO 验证。拒绝 jsdom。

### D. 手工截图审查

可发现明显问题，但没有可重复基线、diff artifact 或门禁。拒绝。

### E. 将视觉测试放入每次 MR gate

发现更早，但当前 GitHub Actions 与本地固定 macOS Obsidian 基线不同，会产生字体和 Electron
噪声，并违反同一提交不重复执行系统/视觉层的原则。拒绝；SYSTEM_TEST 执行一次。

### F. 引入 dependency-cruiser

能表达完整依赖图，但本轮只有三条定向边界，TypeScript ESLint 已安装。拒绝新增该依赖，
使用 `no-restricted-imports` + TypeScript AST smoke。

## 后果

### 正面

- 纯逻辑、React 行为、Obsidian 集成和像素布局各有唯一测试层，反馈速度与真实度平衡。
- Catalog 竞态、事件突发、读取失败和 500 条性能边界可确定性复现。
- Codex 风格布局有固定主题/宽度基线，不依赖主观肉眼判断。
- ADR-0010 的边界进入 MR gate，业务实现无法绕过 service 直接读写存储。
- 复用现有 CI、coverage、fault adapter 和 submission gate，增量成本受控。

### 负面

- 新增 happy-dom、Testing Library、WDIO Visual Service 和 jscpd 开发依赖。
- 视觉基线绑定固定 Obsidian/Electron/macOS 环境，升级时需要显式审核更新。
- component 与 E2E helper 都需要维护最小 Obsidian stub，但不得复制生产业务逻辑。
- SYSTEM_TEST 需要能运行固定 macOS Obsidian 环境；GitHub Linux MR runner 不执行视觉层。

## 验证

待 `test/0032-session-navigator-infra` 完成后回填：组件 smoke、视觉正反比较、事件/竞态
harness、质量与架构负例、coverage 80% 已知基线、submission gate 负例及 WDIO teardown 的
复现命令、结果和 commit。全部自证通过后，本 ADR 才能由人类确认并提升为 `accepted`。

## 约束范围

Vitest/WDIO 配置、test/e2e support、visual baselines、ESLint/jscpd/architecture gate、
package scripts、GitHub Actions、CONTRIBUTING.md 和 Plan-0032；不包含 Session Navigator 业务实现。

## 约束规则

| 规则编号 | 规则 | 适用范围 | 违反时如何检出 |
|----------|------|----------|----------------|
| AR-011-01 | Node unit 与 happy-dom component 分项目，MR gate 均运行 | Vitest + CI | component intentional failure proof |
| AR-011-02 | Catalog fixtures 和事件 harness 确定性且不读取用户数据 | `test/support/` | repeated-output smoke + fixture lint |
| AR-011-03 | 视觉比较只在固定环境截取 Navigator root，阈值默认 0.1% | WDIO visual | baseline match + 2 px negative proof |
| AR-011-04 | 具体 AC 产品测试和视觉基线不在 TEST_INFRA 编写 | test infra branch | code review |
| AR-011-05 | MR gate 执行本轮 ESLint complexity、jscpd 和 architecture smoke | quality gate | intentional violation proofs |
| AR-011-06 | 本轮新增/修改模块 V8 lines coverage 不低于 80% | coverage + submission | known-line baseline + low coverage proof |
| AR-011-07 | E2E/视觉/性能专项只在 SYSTEM_TEST 执行，不进入 MR gate 重复运行 | package scripts + CI | script/CI inspection |
| AR-011-08 | E2E helper teardown 恢复 workspace、主题和所有测试数据 | E2E support | teardown smoke |
| AR-011-09 | 测试 support 不复制 Catalog 排序、状态合并或搜索业务算法 | fixtures/harness | code review |

## 与既有决策的关系

| 既有规则 | 处理 |
|----------|------|
| ADR-0004：Vitest + WDIO Obsidian Service + GitHub Actions | 保留并扩展 component/visual 能力 |
| ADR-0004：单元测试位于 `test/`、E2E 位于 `e2e/` | 保留；新增子目录表达层级 |
| ADR-0007：共享 fixtures 脱敏、CI 不访问真实 harness | 保留；Catalog fixtures 全部人工确定性生成 |
| ADR-0010：Catalog/service/runtime/UI 依赖边界 | 转换为 ESLint + TypeScript AST architecture gate |
