# 0056 Importer Coverage Restoration

`gate:mr` 前置修复容器（BL-0011）。分支 `fix/0056-importer-coverage`，从 `develop` 拉出，完成后合并回 `develop`。

背景：`d72f6f9`（importer 重写为 direct AHS conversion）后 `skills/harness-session-importer` 的 Python 覆盖率从阈值 85% 跌至 81%，develop 基线 `npm run gate:mr` 变红。本容器只补测试，不改 importer 业务逻辑。

| Task | Status | Plan | Report |
|------|--------|------|--------|
| Restore importer Python coverage to ≥85% | pending | [01-plan-importer-coverage.md](01-plan-importer-coverage.md) | — |
