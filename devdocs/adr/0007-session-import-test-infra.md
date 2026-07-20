---
title: ADR-0007: Session Importer 测试基建
description: 复用 Vitest/WDIO 并增加 Python unittest、跨语言 contract vectors、发布点故障注入与脱敏 harness fixtures。
type: adr
status: accepted
created: 2026-07-20T13:46:13Z
---

# ADR-0007: Session Importer 测试基建

## 背景

[AC-0004](../ac/0004-harness-session-importer.md) 同时覆盖 Python converter、跨语言 bundle contract、插件 materializer、五阶段中断恢复和 Obsidian UI。现有 Vitest、内存 Vault adapter、WDIO Obsidian E2E、V8 coverage 与提交门禁已经稳定，不应为本轮替换。新增风险是 Python/TypeScript 对同一 canonical 输入产生不同摘要，以及测试数据泄漏真实用户 session。

## 决策

**复用 Vitest、WDIO、现有故障注入 adapter 和 GitHub Actions；converter 使用 Python 标准库 `unittest`，Python/TypeScript 共享脱敏 JSON vectors 与 bundle fixtures。**

### 1. 测试层级

| 层级 | 能力 | 位置 |
|------|------|------|
| Python 单元/CLI 集成 | adapter parsing、branch、report、JCS、bundle staging、vault boundary | `skills/harness-session-importer/tests/` |
| TypeScript 单元/集成 | descriptor/bundle validation、identity、receipt、materializer、journal recovery、index queue | `test/` |
| Architecture boundary | 私有 schema/default path 仅位于 skill，converter 不读取 PJ/Folder Bridge | `test/session-import-boundary.test.ts` |
| Obsidian E2E | descriptor preview、确认、冲突、只读 receipt warning、无 Agent spawn | `e2e/session-import.spec.ts` |

### 2. Contract Vectors

共享 vectors 位于 `test/fixtures/session-import/contracts/`，包括：

- RFC 8785 官方代表性向量与项目特有的 turn/usage/cost/Unicode 向量；
- identity input、固定 namespace、importId/entryId/historyId/entryFile golden 值；
- sourceDigest、conversionDigest、descriptor/manifest/report/receipt/journal 合法与损坏样本；
- schema version、path traversal、symlink escape 与 digest mismatch 样本。

Python 和 TypeScript 测试读取同一文件，不各自复制 expectation。

### 3. 私有 Harness Fixtures

每个 adapter 使用人工最小化、脱敏的 source fixture，位于 skill 自己的 `tests/fixtures/<harness>/`。Fixture 保留结构特征，不保留真实 prompt、路径、token、密钥、账号或原始工具输出。

边界 fixture 至少能表达：Codex 双格式与 nested custom tool；Claude parentUuid/sidechain；Pi parentId leaf；Kimi temporal loop event；大输出由测试运行时确定性生成，不提交巨型文件。

### 4. 故障注入

扩展现有 in-memory adapter，使测试可按 operation + occurrence 或命名 checkpoint 注入 write/rename/remove/read failure，并保留可审计 operation log。新增 import harness 可以模拟插件重载，重复运行 recovery，并断言 blob/history/receipt/entry/index/journal 全状态。

故障注入 helper 只提供机制；AC-0018 各发布点的具体业务断言在 DEVELOP 测试中编写。

### 5. E2E Fixture

扩展现有 offline transcript materializer，增加来源无关 `.harness-import` descriptor/bundle/receipt 生成 helper。Helper 不解析私有 harness，不复用业务 materializer，避免测试实现与生产实现同错。

E2E 增加 Agent spawn 计数与 import workspace 状态查询 helper。系统测试在真实 Obsidian 中只使用 generic bundle fixture。

### 6. 命令与门禁

新增：

```text
npm run test:importer:python
npm run test:importer:contracts
npm run test:importer:coverage
```

Vitest V8 include 扩展到本轮新增的 `src/types/session-import.ts`、`src/services/session-import*.ts` 与 receipt/journal materializer 模块，继续使用项目 line coverage 下限。Python 使用 pinned test-only `coverage.py`（记录于 skill 的 `requirements-dev.txt`）生成独立 JSON report，importer scripts line coverage 下限为 85%。该依赖只用于仓库测试，不进入 SKILL.md runtime requirements，converter 运行仍只需 Python 3 标准库。

`gate:mr` 同时运行 V8 与 Python coverage，任一测试失败或任一下限未达到都阻断。`gate:submission` 继续从 AC 文档提取 N/B/E/F，并分别读取 V8 summary 与 Python coverage JSON；本轮 Report 必须覆盖 AC-0014 至 AC-0019。两种语言的覆盖率不得加权合并成一个百分比。

CI 不访问用户 home 下的真实 harness storage，不启动外部 Agent，不访问网络。

## 备选方案

### A. 全部测试改用 Python

无法覆盖插件 TypeScript 与 Obsidian UI。拒绝。

### B. Converter 改写 TypeScript 以共用测试框架

可以减少跨语言 contract，但降低 skill 在不同 Agent 环境中的可运行性，且不能消除插件/adapter 边界。拒绝。

### C. 提交真实 session 作为 fixture

覆盖面高，但包含隐私、体积大且格式噪声使断言不稳定。拒绝；使用脱敏最小 fixture，并以本机样本做不提交的探索验证。

### D. 引入第三方 JCS 库

可以减少实现工作，但 Python skill 将新增安装依赖。拒绝；两端以小型项目实现和共享 RFC 向量自证。

## 后果

### 正面

- 跨语言摘要与身份错误在业务实现前即可被 contract vectors 检出。
- 私有格式 fixture 与插件 generic E2E fixture 严格分离，architecture boundary 可自动验证。
- 五阶段故障恢复可以参数化且确定性重放。
- CI 不依赖用户机器、外部 Agent 或网络。

### 负面

- 同一仓库维护 Python unittest 与 Vitest 两套测试入口。
- JCS 项目实现需要持续跑标准向量。
- 最小 fixture 无法覆盖所有未来供应商格式变化，需要 adapter 变更时补充。

## 验证

基建完成后验证：Python 与 TypeScript 对全部共享 vectors 输出相同 digest/UUID；故障 adapter 可在指定 occurrence 精确失败并保留日志；WDIO 能打开最小 descriptor workspace；MR gate 在故意失败的 Python test 以及人为未覆盖的 Python/TypeScript importer fixture 时分别非零退出；coverage summary 与人工可执行行统计一致。验证结果记录在 Plan-0029 Report。

## 约束范围

Importer tests/fixtures、共享 contract fixtures、Vitest support、WDIO support、package scripts、GitHub Actions 与提交门禁。

## 约束规则

| 规则编号 | 规则 | 适用范围 | 违反时如何检出 |
|----------|------|----------|----------------|
| AR-007-01 | Python/TypeScript 使用同一 contract vectors | digest + identity | contract smoke |
| AR-007-02 | 私有 fixture 只在 skill tests，generic E2E 不解析来源 | repository | architecture smoke |
| AR-007-03 | 真实 session、真实 home path 和用户 prompt 不提交 | fixtures | fixture lint |
| AR-007-04 | Python importer tests 进入 MR gate | CI | intentional failure proof |
| AR-007-05 | 故障注入按命名点/次数确定性触发并记录操作 | storage harness | support self-test |
| AR-007-06 | 具体 AC 业务断言留在 DEVELOP | test infra branch | code review |
| AR-007-07 | V8 与 Python coverage 分别覆盖本轮模块并独立过阈值 | coverage + gates | known-line baseline + negative gate proof |
