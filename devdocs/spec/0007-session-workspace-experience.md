---
title: Spec-0007: Session Workspace Experience
description: Codex-inspired project-aware Session creation, synchronized turn navigation, non-redundant Navigator action menus through v0.5.1, and a Navigator toggle button in the Session view header for v0.6.0.
type: spec
status: proposed
version: 3
created: 2026-07-27T02:26:04Z
---

# Spec-0007: Session Workspace Experience

## 一、概述

`v0.4.0` 已提供按 `cwd` 分组的全局 Session Navigator，但创建入口仍会立即生成
`.session`，用户无法在创建前选择 Agent 工作目录；长 Session 也缺少按用户消息快速定位的
结构导航。Navigator 的菜单同时存在两个不一致点：Session 行点击已经等价于 Open，Project
行却没有针对真实工作目录的操作。

本 Spec 为 `v0.5.0` 定义三个相互关联的体验改进：

1. New session 打开 Codex 风格创建弹窗，最多选择一个 Project 工作目录；
2. `.session` FileView 在足够宽时显示按用户消息派生的 turn 导航轨道；
3. Session 菜单移除冗余 Open，Project 行增加作用于真实 `cwd` 的非破坏性菜单。

本轮不新增持久化 Project 实体。Project 继续是
[Spec-0006](0006-session-navigator.md) 与
[ADR-0010](../adr/0010-session-catalog-projection.md) 定义的 `cwd` 投影；`.session` 仍由
[Spec-0001](0001-session-entry.md) 定义并保存在 vault。需求来源为
[BL-0003](../backlog.md)、[BL-0005](../backlog.md) 和 [BL-0006](../backlog.md)。

`v0.5.1` 在不改变上述数据与模块边界的前提下承接 [BL-0008](../backlog.md)：修复手动滚动时
current turn 的既有同步语义，并让 Turn 跳转与回到底部动作使用同一个连续平滑滚动协调机制。

`v0.6.0` 承接 [BL-0010](../backlog.md)：打开 Session Navigator 的 GUI 入口目前只在 Obsidian
最左侧 ribbon，用户在 Session 视图内想切换 Session 时视线与鼠标需横跨整个窗口。本轮在
`.session` FileView 的 sidebar header 顶部恢复一个 Navigator 切换按钮（早期版本曾在顶部，
后移至 ribbon），提供上下文就近入口；ribbon 图标保留，两者指向同一激活动作。

### 1.1 对现行规范的增量关系

本 Spec 激活后按以下范围覆盖现行规则，未列出的上游规则继续有效：

| 现行规则 | v0.5.0 关系 |
|----------|-------------|
| Spec-0001 BR-008：materialization 未指定 cwd 时回退 vault root | 保留。创建弹窗在调用 materialization 前总会计算并显式传入 `effectiveCwd`，因此不触发该 fallback |
| Spec-0006 BR-036：Navigator New session 复用现有直接创建流程 | 由本 Spec BR-042 至 BR-050 取代；仍复用同一 materialization，但在前面增加确认、目录校验与准备 |
| Spec-0006 §6.2：Session 菜单至少包含 Open、Reveal、Rename、Delete | 菜单项集合由本 Spec BR-058 和 §6.3 取代；行点击仍保留 Open 能力，菜单不再重复显示 Open |

## 二、用户故事

| 编号 | 角色 | 需求 | 目的 | 优先级 |
|------|------|------|------|--------|
| US-027 | Harness 用户 | 点击 New session 后先查看并确认 Project 名称与工作目录 | 避免在错误目录中启动 Agent | P0 |
| US-028 | Harness 用户 | 不选择现有目录时，以 Project 名称在 `~/Documents` 下创建默认目录 | 无需预先准备文件夹即可开始新工作 | P0 |
| US-029 | Harness 用户 | 为新 Session 选择一个已有目录 | 让 Agent 在指定项目根目录工作 | P0 |
| US-030 | Harness 用户 | 在长 Session 左侧按每条用户消息浏览 turn 节点 | 快速了解对话结构和当前位置 | P0 |
| US-031 | Harness 用户 | 预览 turn 摘要并跳转到对应用户消息 | 不必反复滚动查找上下文 | P0 |
| US-032 | Harness 用户 | 从 Project 菜单在系统文件管理器中打开真实工作目录 | 直接查看项目文件，而不是定位 vault 中的 `.session` | P1 |
| US-033 | Harness 用户 | 从 Project 菜单创建同目录 Session 或复制完整路径 | 快速复用 Project 上下文 | P1 |
| US-034 | Harness 用户 | Session 菜单只显示不能由行点击直接完成的操作 | 降低重复命令造成的理解成本 | P1 |
| US-035 | Harness 用户 | 手动浏览长 Session 时让 current turn 跟随 viewport，并连续平滑地回到底部 | 保持导航位置可信且避免虚拟测量造成分段停顿 | P0 |
| US-036 | Harness 用户 | 在 Session 视图顶部一键打开 Session Navigator | 切换 Session 时不必移动视线和鼠标到窗口最左侧 ribbon | P1 |

## 三、模块划分

| 模块 | 提供的能力 | 拥有的数据实体 | 目录路径 | 优先级 |
|------|-----------|----------------|----------|--------|
| Session Creation Dialog | 收集 Project 名称和单一 source directory，展示派生 cwd、校验输入并提交创建请求 | `SessionCreationDraft`（瞬时 UI 状态） | `src/ui/SessionCreationModal.ts` | P0 |
| Project Directory Rules | 规范化 Project 名称，计算默认目录，校验单目录选择并生成可测试的主机操作请求 | `ProjectDirectoryTarget`（瞬时值对象） | `src/services/project-directory.ts` | P0 |
| Session Entry Lifecycle | 先完成目录准备，再复用现有 `.session` materialization；协调系统文件管理器和剪贴板命令 | `SessionFileData`（沿用既有 ownership） | `src/plugin.ts` | P0 |
| Session Storage | 初始化 transcript 并维护 index，继续作为创建流程中唯一的存储服务 | `SessionIndexEntry`、`TranscriptManifest` 与 turn records（沿用既有 ownership） | `src/services/session-storage.ts` | P0 |
| Turn Navigation Projection | 从当前 `ChatMessage[]` 派生用户 turn、纯文本预览和 message index，不读写 transcript | `TurnNavigationItem`（内存投影） | `src/services/turn-navigation.ts` | P0 |
| Turn Navigator UI | 渲染节点、预览、键盘交互和当前 turn 状态 | 无持久化实体 | `src/ui/TurnNavigator.tsx` | P0 |
| Virtual Message Navigation | 将 turn 与回到底部动作映射到既有 virtualizer，发布滚动锚点、合并测量修正并处理 reduced motion | 无持久化实体 | `src/ui/MessageList.tsx` | P0 |
| Navigator Action Menus | 精简 Session 菜单，渲染 Project 尾部菜单并阻止菜单点击触发展开/折叠 | 无持久化实体 | `src/ui/SessionManagerView.tsx` | P1 |
| Session View Header | 在 sidebar 变体 header 提供 Navigator 切换按钮，调用既有 Navigator 激活命令 | 无持久化实体 | `src/ui/ChatHeader.tsx` | P1 |

模块依赖拆为三条无环链：

1. `SessionManagerView` → `SessionCatalog`（只读 Project snapshot），且
   `SessionManagerView` → `SessionCreationModal` → `Project Directory Rules`；提交 callback →
   plugin 的 `Session Entry Lifecycle` → `Session Storage`；
2. `.session` 的 `HarnessSessionView` → `ChatPanel` → `MessageList`；`MessageList` →
   `Turn Navigation Projection`，同时由 `MessageList` 渲染
   `TurnNavigator` 并向其注入 navigation callback；`TurnNavigator` 不反向导入 MessageList；
3. `SessionManagerView` 的 Project/Session menus → plugin commands → 必要的纯目录规则或
   `Session Storage`；plugin commands 不导入 React UI；`.session` FileView 的
   `Session View Header`（`ChatHeader` sidebar 变体）→ plugin 的 `activateSessionManager`
   动作，仅单向调用，不回读 Navigator 状态。

纯规则/投影服务没有指向 UI 或 plugin 的依赖。`src/services/` 不得导入 React；Turn Navigator
不得读取 transcript 文件；Project 菜单不得直接修改 Catalog snapshot。`SessionFileData` 只由
既有 Session Entry Lifecycle 写入，`SessionIndexEntry`、`TranscriptManifest` 与 turn records
只由 Session Storage 写入；本 Spec 不建立第二个 owner。

## 四、数据模型

### 4.1 SessionCreationDraft

仅存在于创建弹窗打开期间，关闭后销毁。

| 字段 | 类型 | 约束 | 含义 |
|------|------|------|------|
| `projectName` | `string` | 去除首尾空白后非空 | 未选择目录时用于默认目录名 |
| `sourceDirectory` | `string \| null` | 最多一个存在的绝对非根目录 | 用户选择的现有 Project 路径 |
| `effectiveCwd` | `string \| null` | 由前两字段派生 | 最终写入 `.session.cwd` 的目录 |
| `validationIssue` | `string \| null` | 可展示、无凭据 | 阻止创建的具体原因 |

当 `sourceDirectory` 非空时，Project 名称由该目录 basename 显示并锁定；移除所选目录后恢复
可编辑名称。名称不单独持久化，也不覆盖 Project 的 cwd basename 投影。

### 4.2 ProjectDirectoryTarget

| 字段 | 类型 | 含义 |
|------|------|------|
| `kind` | `"selected" \| "default"` | 使用已有目录或创建默认目录 |
| `cwd` | `string` | 规范化绝对路径 |
| `needsCreate` | `boolean` | 提交前是否需要创建目录 |

### 4.3 TurnNavigationItem

| 字段 | 类型 | 含义 |
|------|------|------|
| `messageId` | `string` | 对应用户 `ChatMessage.id` |
| `messageIndex` | `number` | 对应当前 MessageList virtualizer index |
| `preview` | `string` | 从用户可见内容派生的纯文本摘要 |
| `ordinal` | `number` | 从 1 开始的 turn 序号 |

该投影只由 `ChatMessage[]` 计算，不写回 `.session`、transcript、Catalog 或 settings。

### 4.4 持久化边界

本轮不新增或修改持久化 schema。创建成功后仍只写既有 `SessionFileData.cwd`、transcript
metadata 和 Session index；Project 菜单与 turn 导航不产生持久化写入。

## 五、业务规则

### 5.1 Session 创建

| 规则编号 | 描述 |
|----------|------|
| BR-042 | Navigator 的 New session 和 Project 的 New session here 都必须先打开创建弹窗；打开弹窗不得创建目录、`.session`、transcript 或 index |
| BR-043 | 创建弹窗只允许零个或一个 source directory，不显示 Codex 的多目录 Agent access 能力 |
| BR-044 | 未选择目录时，Project name 必填；默认 cwd 为 `path.join(os.homedir(), "Documents", projectName)` |
| BR-045 | 默认目录名不得包含当前平台禁止的路径字符、路径分隔符、`.`、`..`、控制字符或会被 trim 的尾部点/空格；无效时就地显示原因并禁用 Create |
| BR-046 | 默认目标已存在时不得静默复用或覆盖；用户必须改名或通过 folder picker 显式选择该现有目录 |
| BR-047 | 选择目录时必须返回一个存在的绝对目录且 basename 非空；使用当前平台 `path` 规范化但不解析 symlink 后，若 `normalized === path.parse(normalized).root`，则判为文件系统根目录并拒绝，覆盖 POSIX `/`、Windows drive root 和 UNC share root。Project name 显示其 basename 并在该选择移除前不可编辑 |
| BR-048 | 提交顺序为 validate → 必要时创建默认目录 → materialization transaction → 打开 FileView；transaction 先预留 entryId/historyId，再按 transcript manifest → `.session` → index reconciliation/confirmation 发布。有效 `.session` 的 create reconciliation 与显式 index 写入复用 ADR-0010 AR-010-10 的同一串行幂等操作；全部成功才允许打开 |
| BR-049 | materialization 与 compensation 必须在 Session Entry Lifecycle 中按 `entryId` 共用同一串行操作。任一步失败时，补偿先删除或使本次 `.session` 无效，等待或作废该 entry 已排队的 create reconciliation，再幂等删除精确的 index mapping 和 transcript artifacts；既有 delete cascade 与显式补偿允许重复执行，但缺失 entry 不得重建 mapping，全部结束后才 refresh Catalog。不得删除或递归清理 cwd；补偿本身部分失败时不打开 FileView，并显示未清理 artifact |
| BR-050 | Cancel、关闭弹窗或 folder picker 取消均无副作用；重复点击 Create 在第一次提交结束前不得产生第二个 Session |

### 5.2 Turn 导航

| 规则编号 | 描述 |
|----------|------|
| BR-051 | 每个 `role=user` 的 ChatMessage 恰好生成一个节点，assistant、tool call 和 plan 不单独生成节点 |
| BR-052 | preview 合并用户可见文本并压缩空白，最长 160 个字符；仅附件消息使用可读的附件类型摘要，不暴露 base64 或完整资源 URI |
| BR-053 | 点击或键盘激活节点时，MessageList 以该 item 的 `messageIndex` 作为 BR-065 的目标并按 `align=start` 滚动到起始位置；普通模式使用连续平滑滚动，`prefers-reduced-motion` 下立即跳转 |
| BR-054 | 当前 turn 是位于消息 viewport 上部锚点之前最近的一条用户消息；在第一条之前取第一条，在最后一条之后取最后一条 |
| BR-055 | active turn 更新按 animation frame 合并，不因 streaming content 的高度变化产生节点抖动或改变 messageId 映射 |
| BR-056 | 没有用户消息时不显示轨道；消息区容器宽度小于 520 px 时隐藏轨道且不给消息内容预留空白 |
| BR-057 | Turn Navigator 只在 `.session` FileView 中启用；floating chat 和兼容用旧 ChatView 不显示该轨道 |
| BR-064 | 回到底部按钮必须把消息容器的最大 scroll offset `max(0, scrollHeight - clientHeight)` 作为 BR-065 的目标，而不是只对齐最后一条消息；按钮沿用既有出现条件，完成后 `scrollTop` 与最大 offset 相差不超过既有 35 px bottom threshold 且按钮隐藏 |
| BR-065 | `coordinateSmoothMessageScroll` 是 Turn 跳转与回到底部共用的 MessageList-local 协调机制。Turn 目标由 virtualizer 的 index/alignment 解析 offset 并最终精确对齐；底部目标由 BR-064 的实时容器几何解析并最终精确对齐。普通模式执行 1 次原生平滑主滚动，结束后最多执行 1 次基于新测量几何的平滑修正；每阶段至多等待 1.6 s，完整动作至多 3.2 s；reduced motion 下立即对齐。新的用户导航动作、目标消息身份变化、unmount，或 wheel/trackpad、触摸、滚动条拖动和滚动键产生的直接用户滚动输入，必须清理上一动作的 listener/timer 并禁止其末端修正和精确落点；直接用户滚动仍按 BR-054/BR-055 更新 current turn。协调器自身的末端修正不得被视为新的用户导航动作；offset 或测量不可用时只允许 1 次即时回退，不得循环重启 |

### 5.3 Navigator 菜单

| 规则编号 | 描述 |
|----------|------|
| BR-058 | Session 行点击和 Enter/Space 继续执行 Open；Session 尾部菜单删除 Open，只保留 Reveal in file explorer、Rename、Delete |
| BR-059 | Project 行尾部提供独立 ellipsis 按钮；按钮点击不得触发 Project 展开/折叠，右键 Project 行打开同一菜单 |
| BR-060 | Project 菜单固定包含 New session here、Open in system file manager、Copy path；不包含 Rename 或 Delete |
| BR-061 | New session here 打开同一个创建弹窗并预选 Project cwd，不得绕过创建确认 |
| BR-062 | Open in system file manager 打开 `cwd` 对应的 Finder/Explorer/文件管理器目录，不定位 Obsidian vault 文件树 |
| BR-063 | Copy path 写入完整 cwd；目录已不存在时仍允许复制，但 New session here 和系统打开必须停止并显示可定位的错误 |

### 5.4 Navigator 入口

| 规则编号 | 描述 |
|----------|------|
| BR-066 | `.session` FileView 的 sidebar header 提供 Navigator 切换按钮；点击或键盘激活调用 plugin 的既有 `activateSessionManager` 动作（与命令 `open-session-manager`、ribbon 图标同一入口），不新建第二套打开逻辑 |
| BR-067 | 切换按钮只在 sidebar 变体（`.session` FileView）显示；floating chat 与兼容用旧 ChatView 不渲染该按钮；ribbon 入口保留 |

## 六、UI 约束

### 6.1 创建弹窗

```text
Create project                                      [x]
┌ folder icon  Project name / selected basename ─────┐
└─────────────────────────────────────────────────────┘
Location
  ~/Documents/<projectName>
Source folder
┌ selected folder path                            [x] ┐
├ Add folder                                          ┤
└─────────────────────────────────────────────────────┘
                              Cancel  Create project
```

- 外观、密度和字段顺序参考 Codex，但只显示一个 source folder；选中后 Add folder 不再允许
  添加第二个目录。
- Location 是随 Project name 或 source folder 更新的只读 `effectiveCwd` 预览；长路径单行省略并
  通过 tooltip/可访问名称提供完整值。无法解析默认目录时在此处显示具体错误且不得显示伪路径。
- 弹窗打开后焦点进入 Project name；Create 在输入无效或提交中禁用。
- validation issue 显示在对应字段附近，不以全局 Notice 代替可修正的表单错误。
- 文件夹选择使用原生 OS directory picker；取消 picker 后保留当前表单状态。
- 弹窗不使用嵌套卡片、渐变或大圆角营销式布局，并支持 Obsidian 明暗主题。

### 6.2 Turn 导航轨道

```text
┌ rail ┐ ┌──────────────── message viewport ──────────┐
│  ●   │ │ user message                               │
│  │   │ │ assistant response                         │
│  ○   │ │ ...                                        │
│  │   │ │                                            │
│  ○   │ │                                            │
└──────┘ └─────────────────────────────────────────────┘
```

- 轨道位于 MessageList 内容左缘，不成为 Obsidian 全局侧栏，也不改变 InputArea 宽度。
- 节点使用固定点击区域和细线连接；active 节点通过尺寸与主题色共同区分。
- hover 或键盘 focus 显示纯文本 preview 浮层；浮层不得遮住当前节点，也不得越出 viewport。
- 节点必须是可聚焦 button，aria-label 至少包含 turn 序号和 preview。
- 节点 active/hover 过渡为 120-180 ms 的 CSS transition；不引入新的动画库。
- 轨道隐藏时消息列表恢复原有左边距，任何宽度均不得与消息或滚动条重叠。
- 回到底部按钮沿用既有外观和出现条件，只复用 BR-064 的滚动协调行为，不新增第二套控件。

### 6.3 Project 与 Session 行

- Project ellipsis 与 Session ellipsis 使用相同尺寸、hover/focus 可见规则和菜单样式。
- Project 的展开按钮仍包含 chevron、folder icon 和 displayName；ellipsis 是相邻按钮，不允许
  button 嵌套。
- 系统文件管理器动作使用外部打开图标；Session 的 vault Reveal 保持 folder-search 图标和原文案，
  使两种目的地可区分。

### 6.4 Session 视图 header 的 Navigator 切换按钮

- 按钮位于 sidebar header 的 `nav-buttons-container` 内、More 菜单按钮之前，复用既有
  `nav-action-button` 图标按钮模式，与原生 sidebar 面板的视觉密度一致。
- 图标使用 `panel-left`，aria-label 与 tooltip 文案为 `Open session navigator`。
- 按钮是可聚焦元素，Enter/Space 激活；激活后焦点管理交给 workspace 的视图切换，
  本按钮不自行移动焦点。
- 按钮的出现或消失不得改变 header 中 Agent 标签与 More 按钮的布局。

## 七、异常与失败语义

| 场景 | 结果 |
|------|------|
| homedir 或 Documents 无法解析 | Create 禁用并显示无法确定默认目录；不回退到 vault root |
| 默认目录创建失败 | 保留弹窗和输入，显示 OS 错误摘要；不创建 `.session` |
| 选中目录在提交前被删除 | 停止创建并标记 source folder 无效 |
| `.session`、transcript 或 index 写入失败 | 执行 BR-049 的精确补偿；保留已成功创建的空 Project 目录，不递归删除 cwd；显示失败阶段和未清理 artifact |
| system file manager API 不可用或拒绝打开 | 显示包含 cwd 的非阻断 Notice；Navigator 保持可用 |
| clipboard 写入失败 | 显示 Copy path 失败，不执行其他 Project 命令 |
| turn 目标在点击前因 Session 切换消失 | 忽略旧目标，不跳转到同 index 的其他消息 |
| virtualizer 无法完成目标测量 | 使用 index estimate 定位并保持 UI 可操作，不进入重复滚动循环 |
| 回到底部期间目标消息被替换或 MessageList 卸载 | 取消该动作的 listener/timer；不得对旧容器执行迟到修正 |
| Navigator 切换按钮激活时 workspace 无法 reveal 或创建 Navigator leaf | 显示非阻断 Notice；Session 视图保持可用，不重复创建 leaf |

## 八、非功能指标

| 维度 | 指标 | 目标值 |
|------|------|--------|
| 数据安全 | 打开或取消创建弹窗的磁盘写入 | 0 次 |
| 一致性 | 每次成功创建产生的 `.session` / transcript / index | 各 1 份，cwd 一致 |
| 性能 | 从 500 条 ChatMessage 派生 turn navigation | 16 ms 内 |
| 交互 | 消息滚动协调器收敛 | reduced motion 下 100 ms 内；平滑模式每阶段至多 1.6 s、完整动作至多 3.2 s；Turn 目标在主阶段结束时进入 viewport，最终阶段结束时精确对齐 |
| 交互 | 回到底部的原生平滑滚动调用 | 1 次主滚动，测量变化时最多 1 次末端修正 |
| 响应式 | 260-1200 px 宿主宽度 | 无水平溢出、菜单/轨道/消息不重叠 |
| 可访问性 | 创建表单、Project 菜单、turn 节点、Navigator 切换按钮 | 完整键盘操作、可见焦点、可读 aria-label |
| 兼容性 | 支持的桌面平台 | macOS、Windows、Linux 使用各自系统文件管理器语义 |

## 九、依赖与决策复用

| 依赖/决策 | 用途 |
|-----------|------|
| Node.js `os` / `path` / `fs` | homedir、默认目录计算与目录创建 |
| Obsidian Modal / Menu | 创建表单与行尾菜单 |
| Obsidian 桌面宿主提供的 Electron runtime | 原生 folder picker 与系统文件管理器打开 |
| `@tanstack/react-virtual` | 已有 MessageList 定位和虚拟滚动 |
| [ADR-0003](../adr/0003-session-entry.md) | `.session` 与 index 生命周期边界 |
| [ADR-0005](../adr/0005-turn-transcript-storage.md) | ChatMessage 恢复与 transcript 真相边界 |
| [ADR-0010](../adr/0010-session-catalog-projection.md) | Project 是 cwd 内存投影、Catalog 不执行命令 |

本轮不引入新依赖、协议、持久化模型或跨模块 ownership。原生目录选择模式已由
`ChangeDirectoryModal` 使用，virtualizer 的 `scrollToIndex` 已由 MessageList 使用；因此无需新增
技术选型 ADR 或 spike。新增纯服务用于把路径规则和 turn 投影从 UI 中隔离并可单元测试。

## 十、术语表

| 术语 | 定义 | 代码标识符 |
|------|------|------------|
| Project | 由相同 cwd 的 Session 派生的 Navigator 分组，不是独立持久化实体 | `SessionProjectGroup` |
| Session Creation Dialog | 创建 `.session` 前确认 Project 名称和单一工作目录的弹窗 | `SessionCreationModal` |
| Session creation draft | 创建弹窗生命周期内的名称、目录、派生 cwd 与校验状态 | `SessionCreationDraft` |
| Project name | 未选择现有目录时用于生成默认文件夹名的瞬时输入 | `projectName` |
| Source directory | 用户通过原生 picker 选择的一个现有 Project 根目录 | `sourceDirectory` |
| Effective cwd | 经校验后最终写入 `.session.cwd` 的绝对目录 | `effectiveCwd` |
| Project Directory Target | 已选择或待创建的工作目录值对象 | `ProjectDirectoryTarget` |
| Turn navigation item | 一条用户消息对应的导航节点投影 | `TurnNavigationItem` |
| Turn Navigator | 在 `.session` 消息区左缘呈现 turn 节点、preview 与 active 状态的 UI | `TurnNavigator` |
| Current turn | viewport 上部锚点之前最近的用户消息 | `activeMessageId` |
| Smooth message scroll coordinator | Turn 跳转与回到底部共用的有界原生平滑滚动及精确落点机制 | `coordinateSmoothMessageScroll` |
| Navigator action menu | Session 或 Project 行尾部针对该行目标的命令菜单 | `NavigatorActionMenu` |
| System file manager | Finder、Windows Explorer 或 Linux 桌面文件管理器 | `openProjectInSystemFileManager` |
| Vault reveal | 在 Obsidian 文件树中定位 `.session` 入口文件 | `revealNavigatorSession` |
| Navigator toggle button | Session 视图 sidebar header 中激活 Session Navigator 的图标按钮 | `activateSessionManager` |
