## 当前系统状态

| 字段 | 值 |
|------|-----|
| **当前阶段** | `RELEASE`：v0.6.0 SYSTEM_TEST 闭环——[0059](plans/0059-v0.6.0-system-test/) 交付 AC-0029（8/8）与 AC-0027（6/6）WDIO E2E，develop 全量回归通过；发现并修复局部 bug（BR-067 legacy ChatView 误渲染 Navigator 按钮，fix/0060）；两项非阻塞工程债录入 backlog（BL-0012/BL-0013）；[Report-0059-01](plans/0059-v0.6.0-system-test/01-report-v0.6.0-system-test.md) 判定无阻塞级缺陷，develop 进入待发布状态 |
| **当前版本** | `v0.5.1` 为当前公开稳定版，修复手动滚动的 Turn 同步与回到底部的连续平滑滚动 |
| **设计评估** | v0.6.0 保持现有 React/ACP/Obsidian 架构边界：Agent 配置统一为单一 `agents[]` 模型（[ADR-0012](adr/0012-unified-agent-config-model.md)，约定类决策无需 spike），Navigator 切换按钮复用既有 `activateSessionManager` 入口。上一轮生产证据见 [Release Report v0.5.1](reports/release-v0.5.1.md) |

## 子目录

| 路径 | 用途 |
|------|------|
| [vision.md](vision.md) | 全局顶层愿景 |
| [backlog.md](backlog.md) | 增量迭代需求池 |
| [spec/](spec/) | Spec 需求规格 |
| [interface/](interface/) | 接口定义 |
| [adr/](adr/) | 架构决策记录 |
| [plans/](plans/) | 任务执行计划 |
| [ac/](ac/) | 验收标准 |
