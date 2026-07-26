## 当前系统状态

| 字段 | 值 |
|------|-----|
| **当前阶段** | `DESIGN` 新一轮迭代：v0.4.0 已发布，进入下一轮设计 |
| **当前版本** | `v0.4.0` 刚发布（导入 session 可续聊） |
| **设计评估** | ADR-0009 已落地：导入产物写入 `acpBinding` 指向原生后端，可续聊，后端不可达时 continuation state 降级。已知增强项：换设备场景用 `session/list` 预检提前降级（另开 plan）。参见 [ADR-0009](adr/0009-imported-session-continuation.md) |

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
