## 当前系统状态

| 字段 | 值 |
|------|-----|
| **当前阶段** | `DEVELOP`：`v0.5.1` 增量测试基建检查无缺口，正在实现 Turn 滚动同步与共享协调器 |
| **当前版本** | `v0.5.0` 为当前公开稳定版，交付 Project-aware Session 创建、Turn Navigator 与聚焦的 Project/Session 操作 |
| **设计评估** | `v0.5.1` 复用既有 React/ACP/Obsidian 架构，只为 MessageList 增加共享滚动协调规则；Spec-0007 v2 与 AC-0006 已经独立审查并获人类确认。 |

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
