## 当前系统状态

| 字段 | 值 |
|------|-----|
| **当前阶段** | `DESIGN`：v0.6.0 已发布（[Release Report v0.6.0](reports/release-v0.6.0.md)）——统一 `agents[]` 配置模型 + 单一 Agents 分区、Session 视图 header Navigator 切换按钮、importer 覆盖率恢复；tag workflow / 资产哈希 / 公开 manifest 冒烟全部通过，无回滚。可开启新一轮迭代设计 |
| **当前版本** | `v0.6.0` 为当前公开稳定版，统一 Agent 配置模型并在 Session 视图 header 提供 Navigator 切换按钮 |
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
