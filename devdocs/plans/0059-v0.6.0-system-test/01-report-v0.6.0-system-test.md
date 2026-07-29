---
title: Report-0059-01: v0.6.0 System Test
description: WDIO system-test evidence for AC-0027 and AC-0029, the full develop E2E regression, failure classifications, and the blocking-defect assessment for v0.6.0.
type: report
status: complete
created: 2026-07-29T11:45:00Z
---

# Report-0059-01: v0.6.0 System Test

## Scope And Environment

SYSTEM_TEST ran the packaged plugin in the local Obsidian desktop host through WDIO/Chromedriver on macOS
 against the shared vault `test/vaults/simple` (`copy: false`). Two new specs were delivered —
`e2e/settings-agents.spec.ts` (AC-0029) and `e2e/navigator-toggle.spec.ts` (AC-0027) — followed by the full
9-spec suite on `develop`. DEVELOP-owned unit/coverage layers (AC-0028, AC-0030) were not repeated per the
test-execution boundary. Agent processes and paid APIs were not invoked; failures used injected monkeypatches.

All v0.6.0 execution Plans (0055–0058) are `done` with green MR gates.

## Test Summary

| Test layer | Result | Evidence |
|------------|--------|----------|
| AC-0029 Agents settings section | PASS: 8/8 (0.8 s) | `e2e/settings-agents.spec.ts` |
| AC-0027 Navigator toggle | PASS: 6/6 (1.0 s, after fix 0060) | `e2e/navigator-toggle.spec.ts` |
| Full suite on develop, run 1 | 7/9 specs | demo-vault-verify (vault mismatch, see below) + offline-transcript (flake) |
| Full suite on develop, run 2 | 8/9 specs, 72 s | only demo-vault-verify; [artifacts/e2e-full-regression.log](artifacts/e2e-full-regression.log) |
| demo-vault-verify against prepared `demo-vault` | PASS: 1/1 | run with a temp wdio config pointing `vault` at `demo-vault` |
| offline-transcript standalone rerun | PASS: 7/7 | flake not reproducible in isolation |

## AC Evidence

### AC-0029 Agents 分区与统一编辑器（e2e/settings-agents.spec.ts）

| 场景 | 结果 | 用例 |
|------|------|------|
| AC-0029-N-1 | PASS | 单一 `Agents` heading、无 Built-in/Custom headings、4 内置 block、七字段固定顺序、行尾删除按钮、Path 自动探测、`Add agent` CTA |
| AC-0029-N-2 | PASS | 内置条目四字段 DOM 编辑即时持久化到 `settings.agents`；默认后端下拉实测 25–28 ms 内刷新（要求 100 ms） |
| AC-0029-N-3 | PASS | `Add agent` 新建空条目（`custom-agent` id）→ 编辑各字段 → 按 id 可查、下拉含新条目 |
| AC-0029-N-4 | PASS | 三处强制文案逐字断言（Keychain/不写 data.json、空则禁用注入、勿填密钥） |
| AC-0029-B-1 | PASS | 清空 Agent ID → 自动生成 `custom-agent`、无重复 id、默认条目时 `defaultAgentId` 同步 |
| AC-0029-B-2 | PASS | 删默认条目回退首条目 id；删空后紧凑空状态文案、`Add agent` 可用、`defaultAgentId` 为 `""`、下拉 0 选项 |
| AC-0029-E-1 | PASS | 空 `command` 条目按原值持久化（含 data.json 原文断言）、出现在列表与下拉；spawn 报错路径属 DEVELOP 集成层，不在本 spec 重复 |
| AC-0029-F-1 | PASS | 交替添加/删除（含删除刚添加条目）后 settings 与 UI 一致、无重复 id、`defaultAgentId` 有效 |

### AC-0027 Navigator 切换按钮（e2e/navigator-toggle.spec.ts）

| 场景 | 结果 | 用例 |
|------|------|------|
| AC-0027-N-1 | PASS | `nav-buttons-container` 内 More 之前渲染 `panel-left` 按钮；点击调用与 ribbon/命令同一 `activateSessionManager`（动作 spy 计数 + 代码同一入口），Navigator 可见且 Session 视图保持打开 |
| AC-0027-N-2 | PASS | 按钮可聚焦（tabIndex 0、activeElement 断言）、aria-label 断言、Enter/Space 各触发一次动作；Agent 标签与 More 布局不变 |
| AC-0027-B-1 | PASS（修复后） | 三宿主断言：仅 `.session` FileView 渲染按钮；legacy ChatView 与 floating chat 为 0 |
| AC-0027-B-2 | PASS | Navigator 已存在时再次点击 reveal 既有 leaf，leaf 计数恒为 1 |
| AC-0027-E-1 | PASS（替代验证，见下） | 切换前后 Session 视图不重挂载（React 容器标记存活）、可见状态逐字相等、leaf 计数不变 |
| AC-0027-F-1 | PASS | 注入 `activateSessionManager` 抛错 → 非阻断 Notice `Failed to open the session navigator`、无残留 leaf、Session 视图可用；故障解除后重试成功 |

**AC-0027-E-1 替代依据**：E2E 环境无 agent 后端，Session 视图停在未连接态，无法制造真实 streaming/permission
现场，黑盒模拟 streaming 会退化为测试自证。替代断言锁住切换动作的两条破坏性路径——(a) 视图重挂载
（一旦发生，React 内存中的 streaming 内容与待处理 permission 必然丢失，容器上的 dataset 标记会消失）；
(b) 可见 session 状态变化。结构上该按钮只调用 `activateSessionManager`（reveal/create navigator leaf），
不触碰任何 session 代码路径（`src/ui/ChatPanel.tsx` `handleOpenNavigator`），故替代断言与结构性论证
共同支撑 AC 预期，未静默降级。

## Failure Classification

| Failure | Classification | Basis | Resolution |
|---------|----------------|-------|------------|
| AC-0027-B-1 红：legacy ChatView 渲染了 Navigator 切换按钮 | 局部 bug（实现与契约不符） | BR-067 明确"兼容用旧 ChatView 不渲染该按钮"；实现（904914b）在 ChatPanel sidebar 变体中无条件渲染，而 legacy ChatView 与 `.session` FileView 同为 sidebar 变体 | `fix/0060-legacy-chatview-navigator-toggle`：新增 `showNavigatorToggle` opt-in prop（镜像 `showTurnNavigator` 模式），仅 `HarnessSessionView` 传入；复现测试（B-1）修复前红、修复后绿并永久保留。commit `55c110a` |
| 全量回归中 demo-vault-verify 失败 | 既有套件组成债（非本轮缺陷，非产品缺陷） | 该 spec 是 `scripts/prepare-demo-vault.mjs` 的配套 QA 校验，断言内容（harness-alpha/beta/gamma、marketing-gamma-pi.session）只存在于生成的 `demo-vault`；默认套件 vault 为 `test/vaults/simple`，二者自 c06e925（v0.6.0 之前）起即不匹配。在准备好的 `demo-vault` 下复跑 PASS（1/1），证明产品行为正确 | 非阻塞，录入 backlog（BL-0012）；vault mismatch 与 v0.6.0 变更无关 |
| 全量回归 run 1 中 offline-transcript 一红（"Offline prompt" 未出现） | 测试竞态抖动（非产品缺陷） | spec 在 `waitUntil("Ready to continue")` 后立即断言异步加载的 transcript 消息文本，无第二阶段等待；单独复跑 7/7 PASS，run 2 亦 PASS | 非阻塞，录入 backlog（BL-0013：补消息内容等待） |

## System-Test Semantic Review

断言观察用户可见的宿主行为而非组件内部：Settings DOM 结构/字段顺序/强制文案、`settings.agents` 与
data.json 原文持久化、`defaultAgentId` 回退链、空状态；header 按钮 DOM 顺序与图标、动作 spy（与
ribbon/命令同一入口）、键盘激活、workspace leaf 计数、Notice 文案与故障恢复。AC-0029-N-2 的"100 ms
内刷新"以实测延迟（25–28 ms）记录。 vault fixture 在 spec `after` 中按字节恢复（快照 raw data.json +
in-memory settings 双写回），未给共享 vault 留下状态；调试期间遗留的一个 fixture 文件已手工清除并复核
data.json 无引用。

## Blocking-Defect Assessment

逐项判定全部已知缺陷：

- BR-067 按钮泄漏（fix 0060）：已修复并回归全绿，无残留。
- demo-vault-verify 套件错配：非核心用户故事、非数据损坏、非安全问题；行为在目标 vault 下验证通过，
  workaround 明确（按既有方式在 prepared demo-vault 运行）。**非阻塞** → BL-0012。
- offline-transcript 竞态：单跑与复跑均通过，不构成"功能失效且无 workaround"。**非阻塞** → BL-0013。

核心用户故事（统一 Agent 配置的查看/编辑/增删、Session 视图顶部打开 Navigator）在真实 Obsidian 宿主中
全部可完成；无数据丢失或安全发现；无降级处理的问题遗留。v0.6.0 无发布阻塞缺陷。

## Conclusion

`[PASS]` AC-0027 与 AC-0029 全部场景通过，develop 全量回归除一项既有套件组成债外全绿，该债已在目标
环境下证伪产品嫌疑。迭代满足推进 RELEASE 的条件。
