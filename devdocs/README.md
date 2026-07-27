## 当前系统状态

| 字段 | 值 |
|------|-----|
| **当前阶段** | `RELEASE`：`release/v0.5.0` 已通过干净安装、生产/文档构建、运行时依赖审计、版本一致性与核心 Obsidian 冒烟；等待 production 发布、`main` 合并与 tag 的人工批准 |
| **当前版本** | `v0.4.0` 为当前公开稳定版，交付 Codex 风格的全局 Session Navigator |
| **设计评估** | `v0.5.0` 增加 Project-aware Session 创建、Turn Navigator 与 Project/Session 菜单调整；复用现有 Electron host、virtualizer、SessionStorage reconciliation 和 Vitest/WDIO/CI。DEVELOP 证据见 [Report-0042](plans/0042-session-creation/01-report-session-creation.md)、[Report-0043](plans/0043-turn-navigator/01-report-turn-navigator.md) 与 [Report-0044](plans/0044-navigator-actions/01-report-navigator-actions.md)，完整运行时证据见 [Report-0045](plans/0045-session-workspace-system-test/01-report-session-workspace-system-test.md)；不新增业务 ADR。 |

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
