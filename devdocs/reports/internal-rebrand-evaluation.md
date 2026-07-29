# 内部代码标识 Rebrand 评估

> 背景:本项目 fork 自 `RAIT-09/obsidian-agent-client`,已在 manifest 层重命名为 **Obsidian Harness**(id `obsidian-harness`、author `vlln`)。但源码内部仍大量使用 `agent-client` / `AgentClient` 标识。因产品哲学已与上游完全不同,评估是否彻底重命名内部标识。

## 现状清单(按数据持久化风险分桶)

| # | 桶 | 规模 | 改名风险(无迁移) |
|---|----|------|--------------------|
| 1 | CSS 类名(`agent-client-*`,TSX className + styles.css 选择器) | ~252 distinct 类;styles.css 492 行;TSX ~280 处 | **低** — 仅样式,需 TSX+CSS 协同替换 |
| 2 | View type 常量(`agent-client-chat-view`、`agent-client-session-manager`) | 2 个(`harness-session-view` 已改) | **中** — 持久化在 workspace.json |
| 3 | 命令 ID | 0 | 无 — 已是 `obsidian-harness:` 前缀 |
| 4 | Keychain fallback key(`agent-client-claude/openai/gemini-api-key`) | 3 | **低-中** — 仅碰撞兜底路径;受影响用户旧 key 孤立 |
| 5 | Settings JSON 键名 | 0(仅默认**值**含 token:`agent_client_{date}_{time}`、`agent-client` tag) | **无** — 不涉及存储键 |
| 6 | 文件/目录路径 | 0 | 无 — 插件目录已随 manifest id 为 `obsidian-harness` |
| 7 | Workspace 事件名(`agent-client:*`,6 个) | 6 | **低** — 内部触发/监听,不持久化 |
| 8 | 其它(`AgentClientPlugin` 类/~30、`AgentClientPluginSettings`/~8、`AgentClientSettingTab`/~3、`agentClient` 变量/~65、ACP client name `"obsidian-agent-client"`、`[AgentClient]` 日志前缀、HTML id) | ~110 | 混合 — 纯内部 TS 标识;ACP client name 发给 agent 进程,改名安全但仅观感 |

## 关键风险点

### 桶 2 — View type(workspace.json 持久化)
`VIEW_TYPE_CHAT = "agent-client-chat-view"`、`VIEW_TYPE_SESSION_MANAGER = "agent-client-session-manager"` 的字符串值会被 Obsidian 写入 `workspace.json` 的 leaf 状态。直接改名后,老用户的 workspace 里残留旧 type 字符串 → 重开时这些 leaf 无法重建,显示空白/丢失。

**缓解(已存在的天然路径)**:`plugin.ts:305,308` 在 `onload` 对三个 view type 调了 `detachLeavesOfType()`。改名时只需在过渡期 `onload` 额外 `detachLeavesOfType("agent-client-chat-view")` / `detachLeavesOfType("agent-client-session-manager")` 一次,清掉旧 leaf,再注册新 type。**无数据丢失,仅丢失 pin 位置**。

### 桶 4 — Keychain fallback key
主 keychain id 是共享的 `claude-api-key` 等;`agent-client-*-api-key` 仅在主 id 与他插件冲突时作兜底存储。改名会让走了兜底路径的用户的旧兜底 key 读不到。

**迁移**:onload 时若新 fallback id 无 secret 且旧 `agent-client-*-api-key` 有 secret → 拷贝到新 id → 删旧。影响面小(仅碰撞子集),但无迁移会丢这些用户的 key。

### 桶 5 — 默认值(非存储键)
`exportSettings.filenameTemplate` 默认 `"agent_client_{date}_{time}"`、`frontmatterTag` 默认 `"agent-client"`。这些是**新装默认值**,不写入 data.json 键名。已自定义的用户值不动;未自定义的新用户拿到新默认。**改名零数据风险**,但会改变新用户导出文件名/tag 前缀(需在 changelog 标注)。

## 建议:分三阶段执行

**Phase 1 — 纯机械、零迁移(可立即做)**
- CSS 类名 `agent-client-` → `harness-`(src/** + styles.css 协同 sed;注意保留 `harness-session-view` 已有命名,避免重复前缀)
- Workspace 事件名 `agent-client:` → `harness:`(emit+listen 同提交改)
- TS 标识:`AgentClientPlugin` → `HarnessPlugin`、`AgentClientPluginSettings` → `HarnessPluginSettings`、`AgentClientSettingTab` → `HarnessSettingTab`、`agentClient` 变量 → `harness`
- ACP client name `"obsidian-agent-client"` → `"obsidian-harness"`(acp-client.ts)
- 日志前缀 `[AgentClient]` → `[Harness]`
- HTML id `agent-client-project-name` → `harness-project-name`
- 默认值 `agent_client_{date}_{time}` → `harness_{date}_{time}`、`agent-client` tag → `harness`

**Phase 2 — 需一次性迁移(view type)**
- 改 `VIEW_TYPE_CHAT`/`VIEW_TYPE_SESSION_MANAGER` 值为 `harness-chat-view`/`harness-session-manager`
- `onload` 过渡期追加 `detachLeavesOfType(旧字符串)` 一次,清旧 leaf
- 跑 e2e + 手测升级路径

**Phase 3 — 需一次性迁移(keychain fallback)**
- 改三个 fallback id 为 `harness-claude-api-key` 等
- onload 迁移:旧 fallback 有 secret 且新 id 无 → 拷贝 → 删旧
- 覆盖 `migrateLegacyApiKey` 路径的单测

## 必须保留不动
- npm scope `@agentclientprotocol/*`(上游协议 SDK 包名,不是本项目标识)
- 协议名 "Agent Client Protocol (ACP)"(Zed 的协议,文档/对外描述保留)
- `agentclientprotocol/agent-client-protocol`(协议仓库 URL)

## 风险与回报
- **回报**:产品哲学已不同,内部 `agent-client` 残留会让调试、CSS 诊断、日志过滤、用户报错都带上游烙印;彻底改名后代码与品牌一致。
- **主要成本**:Phase 1 的 CSS sed 是最大机械量(492 行 + 280 处),但纯替换、可脚本化、有 e2e 兜底。
- **真实风险面**:仅 Phase 2/3 涉持久化,且都有明确的一次性迁移路径(已有 `detachLeavesOfType` 钩子 + 可加 secret 拷贝)。

## 结论
**建议执行,分三阶段**。Phase 1 可独立合入(零迁移、纯机械);Phase 2/3 各自带一次性迁移逻辑后合入。若只追求"对外品牌一致",Phase 1 + docs(已完成)已足够;若追求"代码内部也彻底脱钩上游",则 Phase 2/3 必做。
