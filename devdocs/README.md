## 当前系统状态

| 字段 | 值 |
|------|-----|
| **当前阶段** | `SYSTEM_TEST`：AC-0023 的 DEVELOP 门禁已通过，正在 `develop` 上执行新增的 WDIO 计算样式、主题故障注入与 260/420 px 明暗主题视觉验证 |
| **当前版本** | `v0.4.0` 刚发布（导入 session 可续聊） |
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
