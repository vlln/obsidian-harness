# 0057 Agent Config Unification

v0.6.0 主体需求（BL-0009）实现容器。分支 `feat/0057-agent-config-unification`，从 `develop` 拉出，完成后合并回 `develop`。

范围：[Spec-0008](../../spec/0008-agent-configuration-unification.md) 全部四个模块（统一类型、持久化、配置解析、Settings UI）+ [ADR-0012](../../adr/0012-unified-agent-config-model.md) 约束落地。AC-0028/AC-0030 的单元/集成测试随本分支交付；AC-0029（WDIO E2E）属 SYSTEM_TEST 层，另行建容器。

| Task | Status | Plan | Report |
|------|--------|------|--------|
| Unified agents[] model + single Agents settings UI | done | [01-plan-agent-config-unification.md](01-plan-agent-config-unification.md) | [01-report-agent-config-unification.md](01-report-agent-config-unification.md) |
