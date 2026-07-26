## 当前系统状态

| 字段 | 值 |
|------|-----|
| **当前阶段** | `DESIGN`：修正 Session Navigator 的测试层约束，复用既有 Vitest/WDIO 基建，不引入第二套组件/视觉工具链 |
| **当前版本** | `v0.4.0` 刚发布（导入 session 可续聊） |
| **设计评估** | 业务架构不变；发现 AC-0005 将“组件测试”写成硬性验证层会迫使项目新增重复测试工具，退回 DESIGN 改为现有 Vitest + WDIO E2E/截图验证。参见 [Spec-0006](spec/0006-session-navigator.md)、[AC-0005](ac/0005-session-navigator.md)、[ADR-0010](adr/0010-session-catalog-projection.md) |

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
