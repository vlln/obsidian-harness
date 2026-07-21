## 当前系统状态

| 字段 | 值 |
|------|-----|
| **当前阶段** | `RELEASE` 导入 session 续聊迭代待发布；SYSTEM_TEST 全绿，等待发布决策 |
| **当前版本** | `v0.3.0` 已发布，下一版待定 |
| **设计评估** | ADR-0009 取代 ADR-0008 的"只读、无 binding"约定：导入产物写入指向原生后端会话的 `acpBinding`，E2 手测（pi-acp）验证可续聊；后端不可达时 continuation state 自然降级。Spec-0005 v3 / AC-0004 / Interface-0001 已同步。develop 已合并本迭代，MR/E2E/CLI 端到端全绿，详见 [reports/system-test-imported-session-continuation.md](reports/system-test-imported-session-continuation.md) |

## 子目录

| 路径 | 用途 |
|------|------|
| [vision.md](vision.md) | 全局顶层愿景 |
| [spec/](spec/) | Spec 需求规格 |
| [interface/](interface/) | 接口定义 |
| [adr/](adr/) | 架构决策记录 |
| [plans/](plans/) | 任务执行计划 |
| [ac/](ac/) | 验收标准 |
