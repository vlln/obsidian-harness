## 当前系统状态

| 字段 | 值 |
|------|-----|
| **当前阶段** | `DESIGN`：`v0.5.1` 已完成 production 发布、公开资产冒烟与五分钟监控；下一轮增量候选等待从 [backlog](backlog.md) 选择并标记为 `planned` |
| **当前版本** | `v0.5.1` 为当前公开稳定版，修复手动滚动的 Turn 同步与回到底部的连续平滑滚动 |
| **设计评估** | `v0.5.1` 的设计、DEVELOP、SYSTEM_TEST 与 RELEASE 已闭环；生产证据见 [Release Report v0.5.1](reports/release-v0.5.1.md)。下一轮保持现有 React/ACP/Obsidian 架构边界，候选选择前不修改 active Spec/AC/ADR。 |

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
