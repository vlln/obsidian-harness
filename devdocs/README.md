## 当前系统状态

| 字段 | 值 |
|------|-----|
| **当前阶段** | `RELEASE`：`release/v0.4.0` 正在执行 Session Navigator staging 制品与冒烟验证；尚未替换旧 draft/tag、执行 production 发布或合并 |
| **当前版本** | `v0.3.0` 为当前公开稳定版；新的 `v0.4.0` 为 Session Navigator 发布候选，取代同版本号下未公开且无运行时变化的旧 draft |
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
