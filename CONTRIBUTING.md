# Contributing to Obsidian Harness

## 一、开发环境

### 前置条件

- Node.js 18.x or later
- npm

### 安装

```bash
cd /path/to/your/vault/.obsidian/plugins
git clone https://github.com/vlln/obsidian-harness-frontend.git obsidian-harness
cd obsidian-harness
npm install
npm run dev
```

### 在 Obsidian 中测试

1. Clone 到 `.obsidian/plugins/obsidian-harness`，运行 `npm run dev`
2. 在 Obsidian Settings → Community Plugins 中启用插件
3. 代码变更后重新加载插件

### 可用命令

| 命令 | 用途 |
|------|------|
| `npm run dev` | 开发构建（watch 模式） |
| `npm run build` | 生产构建（含 TypeScript 类型检查） |
| `npm run lint` | 运行 ESLint |
| `npm run lint:fix` | ESLint 自动修复 |
| `npm run format` | Prettier 格式化 |
| `npm run format:check` | 格式化检查（CI 用） |
| `npm run test` | 运行 vitest |

**构建/配置入口：**

| 文件 | 用途 |
|------|------|
| `esbuild.config.mjs` | 构建入口 |
| `tsconfig.json` | TypeScript 配置 |
| `package.json` | 依赖声明 |

---

## 二、代码风格

### Prettier 配置

| 设置 | 值 |
|------|-----|
| Indentation | Tabs (width 4) |
| Semicolons | Yes |
| Quotes | Double |
| Trailing comma | All |
| Print width | 80 |
| End of line | LF |

### ESLint

使用 `eslint-plugin-obsidianmd` 和 `typescript-eslint`。

### Obsidian Plugin 规范

1. **No innerHTML/outerHTML** — Use `createEl`, `createDiv`, `createSpan`
2. **Don't detach leaves in onunload** — Anti-pattern
3. **Styles in CSS only** — No JS style manipulation
4. **Use Platform API** — Don't use `process.platform`
5. **Minimize `any`** — Use proper types

### 命名约定

| 层级 | 格式 | 目录 |
|------|------|------|
| Types | `kebab-case.ts` | `types/` |
| ACP | `kebab-case.ts` | `acp/` |
| Services | `kebab-case.ts` | `services/` |
| Hooks | `use*.ts` | `hooks/` |
| Components | `PascalCase.tsx` | `ui/` |
| Utilities | `kebab-case.ts` | `utils/` |

### devloop 文档命名

| 文档 | 格式 |
|------|------|
| Vision | `vision.md` |
| Spec | `000x-xxxx.md` |
| Interface | `000x-xxxx.md` |
| AC | `000x-xxxx.md` |
| ADR | `000x-xxxx.md` |
| 执行容器 | `000x-简短描述` |
| Plan | `0x-plan-xxx.md` |
| Report | `0x-report-xxx.md` |

### devloop Frontmatter 约定

以下文档类型使用 YAML frontmatter：

| 文档类型 | 必填字段 |
|----------|----------|
| Vision | `title`, `description`, `type: vision`, `status`, `created` |
| Spec | `title`, `description`, `type: spec`, `status`, `version`, `created` |
| Interface | `title`, `description`, `type: interface`, `status`, `created` |
| AC | `title`, `description`, `type: ac`, `status`, `created` |
| ADR | `title`, `description`, `type: adr`, `status`, `created` |
| Plan | `title`, `description`, `type: plan`, `status`, `created` |
| Report | `title`, `description`, `type: report`, `status`, `created` |

`created` 使用 ISO 8601 格式。`version` 仅 Spec 使用。

### devloop status 有效值

| 文档类型 | 状态值 | 流转 |
|----------|--------|------|
| Vision | `draft` / `proposed` / `active` | draft→proposed→active |
| Spec | `draft` / `proposed` / `active` | draft→proposed→active（同时只有一个 active） |
| AC | `draft` / `proposed` / `active` | draft→proposed→active（同时只有一个 active） |
| Interface | `draft` / `proposed` / `active` | draft→proposed→active（同时只有一个 active） |
| ADR | `draft` / `proposed` / `accepted` / `superseded` / `deprecated` | draft→proposed→accepted→superseded/deprecated |
| Plan | `pending` / `done` | pending→done |
| Report | `draft` / `complete` | draft→complete |

---

## 三、Commit 规则

### 格式

遵循 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <简短描述>
```

| type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档变更（必须独立 commit，不与代码混合） |
| `refactor` | 重构 |
| `test` | 测试相关 |
| `perf` | 性能优化 |
| `ci` | CI/CD 变更 |
| `build` | 构建系统变更 |
| `chore` | 构建/工具/依赖 |
| `style` | 格式化（无功能变更） |

### devloop 约定

- 文档变更和代码变更永远分开 commit
- 阶段推进伴随独立 commit，前缀 `docs(state):`
- 文档 commit 格式：`docs(<scope>): <简述>`

---

## 四、分支策略

遵循 Gitflow：

```
main     ─────●──────────●────→  (tag: v0.1.0, v0.2.0)
              ↑          ↑
release  ──── v0.1.0 ─── v0.2.0
              ↑          ↑
develop  ────●──●──●──●──●──→  (持续集成)
              ↑  ↑  ↑
             ci/ feat/ fix/
```

| 分支 | 用途 | 从哪拉 | 合并到哪 |
|------|------|--------|---------|
| `main` | 仅含 release 节点，始终可部署 | — | — |
| `develop` | 持续集成分支 | `main` | — |
| `feat/*` `refactor/*` `perf/*` | 功能开发 | `develop` | `develop` |
| `ci/*` `test/*` `build/*` | 基建搭建 | `develop` | `develop` |
| `fix/*` | 集成修复 | `develop` | `develop` |
| `spike/*` | ADR 技术验证 | `develop` | 不合并（保留） |
| `release/*` | 版本发布 | `develop` | `main` + `develop` |
| `hotfix/*` | 生产热修复 | `main` | `main` + `develop` |

分支命名格式：`<type>/<编号>-<描述>`，编号与执行容器对应。示例：`feat/0001-session-entry`、`spike/0001-fs-prototype`。

---

## 五、版本策略

版本格式 `MAJOR.MINOR.PATCH`（X.Y.Z），遵循 [Semantic Versioning](https://semver.org/)：

| 段 | 何时升 | 示例 |
|----|--------|------|
| MAJOR | 不兼容的 API 变更 | `0.1.0 → 1.0.0` |
| MINOR | 新增功能，向后兼容 | `0.1.0 → 0.2.0` |
| PATCH | 向后兼容的 bug 修复 | `0.1.0 → 0.1.1` |

MAJOR=0 期间（0.x.y）：MINOR 升功能，PATCH 修 bug。

devloop 特有约定：
- 首次发布从 `0.1.0` 起步
- RELEASE 阶段在 `main` 上打 tag，格式 `vX.Y.Z`
- hotfix 升 PATCH：`v0.1.0 → v0.1.1`

---

## 六、测试

### 测试命令

| 命令 | 用途 |
|------|------|
| `npm run test` | 单元测试（vitest） |
| `npm run test:watch` | 测试 watch 模式 |
| `npm run test:e2e` | E2E 测试（wdio-obsidian-service） |

### 测试目录

| 层级 | 目录路径 |
|------|---------|
| 单元测试 | `test/` |
| E2E 测试 | `e2e/` |

---

## 七、PR 流程

### 工作流

1. 从 `develop` 拉分支（`feat/*`、`fix/*` 等）
2. 在分支上开发和提交
3. 创建 PR 到 `develop`
4. 确保 CI 通过（lint、build）
5. 等待 Review

### PR Checklist

- [ ] `npm run lint` 通过
- [ ] `npm run build` 通过
- [ ] 在 Obsidian 中测试通过
- [ ] 现有功能未受影响
- [ ] 文档已更新（如需要）

### CI

PR 自动运行：
- ESLint (`npx eslint src/`)
- Build (`npm run build`)

**注意**: "Use sentence case for UI text" lint 错误对品牌名和专有名词可忽略（如 "Claude Code", "Gemini CLI"）。

---

## 八、架构原则

1. **useAgent as facade** — Composes useAgentSession + useAgentMessages. Single `onSessionUpdate` subscription.
2. **Services have zero React imports** — Pure functions and classes in `services/`
3. **ACP isolation** — All `@agentclientprotocol/sdk` imports confined to `acp/`
4. **Types have zero deps** — No `obsidian`, no SDK, no React in `types/`
5. **Single event channel** — All agent events flow through `onSessionUpdate`. No special callback paths.

## 九、ACP Notes

- 优先实现符合 ACP 规范（stable）的功能
- 实现 draft/experimental 规范前需讨论
- 实现应与官方 ACP-compatible agent 兼容（如 `@agentclientprotocol/claude-agent-acp`）

## 十、行为准则

遵守 Contributor Covenant 行为准则。

## 十一、许可证

Apache-2.0