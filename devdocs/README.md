## 当前系统状态

| 字段 | 值 |
|------|-----|
| **当前阶段** | `DESIGN`：Session Navigator 的 `v0.4.0` 迭代已完成发布闭环；下一轮增量迭代候选尚未选定 |
| **当前版本** | `v0.4.0` 为当前公开稳定版，交付 Codex 风格的全局 Session Navigator |
| **设计评估** | Session Navigator 使用 `.session` 权威元数据 + index 发现 + 内存 Catalog/Runtime Registry；复用现有 Vitest/WDIO/CI，不新增测试工具。参见 [Spec-0006](spec/0006-session-navigator.md)、[AC-0005](ac/0005-session-navigator.md)、[ADR-0010](adr/0010-session-catalog-projection.md)、[ADR-0011](adr/0011-session-navigator-test-infra.md) |

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
