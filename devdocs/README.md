## 当前系统状态

| 字段 | 值 |
|------|-----|
| **当前阶段** | `DEVELOP`：`v0.5.0` 增量测试基建检查与补丁已完成，开始按 AC-0024 至 AC-0026 执行业务 Plan |
| **当前版本** | `v0.4.0` 为当前公开稳定版，交付 Codex 风格的全局 Session Navigator |
| **设计评估** | `v0.5.0` 增加 Project-aware Session 创建、Turn Navigator 与 Project/Session 菜单调整；复用现有 Electron host、virtualizer、SessionStorage reconciliation 和 Vitest/WDIO/CI。增量基建审计修正 AC 定义行发现和新增服务 coverage 目标，无新增测试基建 ADR。参见 [Spec-0007](spec/0007-session-workspace-experience.md)、[AC-0006](ac/0006-session-workspace-experience.md)、[ADR-0010](adr/0010-session-catalog-projection.md)、[Report-0041](plans/0041-session-workspace-test-infra-audit/01-report-session-workspace-test-infra-audit.md) |

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
