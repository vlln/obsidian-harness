# 0059 v0.6.0 System Test

v0.6.0 SYSTEM_TEST 容器。分支 `test/0059-v0.6.0-system-test`，从 `develop` 拉出，E2E 脚本经 MR 门禁后合并回 `develop`，并在 `develop` 上执行全量系统测试。

范围：[AC-0007](../../ac/0007-agent-configuration-unification.md) 的 AC-0029（Agents 分区与统一编辑器）与 [AC-0006](../../ac/0006-session-workspace-experience.md) 的 AC-0027（Navigator 切换按钮）的 WDIO E2E 交付；随后执行 develop 全量 E2E 回归（既有 specs 不重复改，只跑）。单元/开发集成层已在 DEVELOP 完成，按测试执行边界不重复。

| Task | Status | Plan | Report |
|------|--------|------|--------|
| AC-0029/AC-0027 WDIO E2E + develop 全量回归 | pending | [01-plan-v0.6.0-system-test.md](01-plan-v0.6.0-system-test.md) | — |
