## 当前系统状态

| 字段 | 值 |
|------|-----|
| **当前阶段** | `TEST_INFRA`：v0.6.0 设计已冻结（Spec-0008、Spec-0007 v3、AC-0007、AC-0006、ADR-0012 均已 promote）；进入测试基建增量检查，复用既有基建，仅对 BL-0009/BL-0010 增量需求搭建 |
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
