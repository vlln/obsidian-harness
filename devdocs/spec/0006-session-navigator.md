---
title: Spec-0006: Session Navigator
description: Codex 风格全局 Session 导航器，统一浏览、搜索、创建和管理 vault Session，并区分分区标签、展开命令与可选择行的视觉角色。
type: spec
status: proposed
version: 2
created: 2026-07-26T05:39:33Z
---

# Spec-0006: Session Navigator

## 一、概述

Obsidian Harness 已有 `SessionManagerView`，但它只在挂载时读取一次
`session_index.jsonl`，将运行中的视图与已保存的 Session 分成两个列表，并主要展示
文件路径。用户难以从一个稳定位置按项目浏览所有 Session，也无法快速搜索、创建或识别
各 Session 的当前运行状态。

本 Spec 将现有视图升级为全局 Session Navigator。外观与信息结构尽量参考 Codex GUI
左侧边栏：顶部是产品标题、搜索和 New session；主体依次是 Projects 与 Recents。
运行状态是 Session 行的瞬时属性，以右侧小图标表达，不建立独立 Active 分区。

Session Navigator 是 vault 中 `.session` 文件的实时投影和导航入口，不成为第二套 Session
数据库，也不取代文件浏览器、wikilink 或 `.session` 的 FileView。

参考：[Vision](../vision.md)、[Spec-0001](0001-session-entry.md)、
[Spec-0002](0002-session-lifecycle.md)、[ADR-0003](../adr/0003-session-entry.md)、
[BL-0001](../backlog.md)、[BL-0002](../backlog.md)。

## 二、用户故事

| 编号 | 角色 | 需求 | 目的 | 优先级 |
|------|------|------|------|--------|
| US-020 | Harness 用户 | 在左侧边栏按 Project 浏览 vault 中的所有 Session | 不必在文件树中逐个寻找 `.session` 文件 | P0 |
| US-021 | Harness 用户 | 查看最近更新的 Session 并直接打开 | 快速回到近期工作 | P0 |
| US-022 | Harness 用户 | 从同一个页面搜索 Session 标题、Project 或 Agent | 在 Session 数量增长后仍能快速定位 | P0 |
| US-023 | Harness 用户 | 在 Session 行右侧看到运行、等待授权或失败状态 | 不改变 Session 所在位置即可判断当前状态 | P0 |
| US-024 | Harness 用户 | 从导航器创建新的 Session | 以与 Codex GUI 一致的高频入口开始工作 | P1 |
| US-025 | Harness 用户 | 对 Session 执行打开、在文件列表中显示、重命名和删除操作 | 在保留 vault 文件语义的前提下集中完成常用管理 | P1 |
| US-026 | Harness 用户 | 一眼区分静态分区标题、列表展开操作和可选择的 Project/Session 行 | 不把结构标签误认为 Session，也不遗漏 Show more 操作 | P1 |

## 三、模块划分

| 模块 | 提供的能力 | 拥有的数据实体 | 目录路径 | 优先级 |
|------|-----------|----------------|----------|--------|
| Session Catalog | 读取并校验索引和 `.session` 元数据，监听 vault 变化，生成可订阅的排序、分组和搜索投影 | `SessionCatalogItem`、`SessionProjectGroup`（均为内存投影） | `src/services/session-catalog.ts` | P0 |
| Runtime Status Projection | 将已打开视图的瞬时状态按 `entryId` 合并到 Catalog，不持久化运行状态 | `SessionRuntimeStatus`（内存态） | `src/services/view-registry.ts` | P0 |
| Session Navigator View | 呈现 Codex 风格侧边栏，处理展开、搜索、Show more、选择与条目菜单交互 | 无持久化实体 | `src/ui/SessionManagerView.tsx` | P0 |
| Session Lifecycle Commands | 复用现有创建、打开、重命名、删除和文件定位能力，并维护 entry、index 与 transcript 一致性 | `SessionFileData`、`SessionIndexEntry`（沿用现有 ownership） | `src/plugin.ts`、`src/services/session-storage.ts` | P1 |

依赖方向固定为：`SessionManagerView` → `SessionCatalog` → Session storage/vault；
`SessionCatalog` 只读取 `view-registry` 的运行时快照。服务层不得依赖 React，
`view-registry` 不依赖 UI 组件，依赖关系不得反向或成环。

## 四、数据模型

### 4.1 SessionCatalogItem

`SessionCatalogItem` 是从 `SessionFileData`、`SessionIndexEntry` 和可选运行时状态合成的
内存投影，不写回磁盘。

| 字段 | 类型 | 来源 | 含义 |
|------|------|------|------|
| `entryId` | `string` | `.session` | Session 入口稳定身份 |
| `historyId` | `string` | `.session` | Transcript 稳定身份 |
| `entryFile` | `string` | index | vault-relative 文件路径 |
| `title` | `string` | `.session` | Session 显示标题 |
| `agentId` | `string` | `.session` | 首选 Agent 标识 |
| `cwd` | `string` | `.session` | Project 分组键 |
| `createdAt` | ISO 8601 string | `.session` | 创建时间 |
| `updatedAt` | ISO 8601 string | `.session` | 最近活动时间 |
| `runtimeStatus` | `SessionRuntimeStatus \| null` | view registry | 当前设备上的瞬时状态；未打开时为 `null` |
| `isSelected` | `boolean` | workspace/view registry | 对应 FileView 是否为当前活动视图 |

### 4.2 SessionProjectGroup

| 字段 | 类型 | 含义 |
|------|------|------|
| `cwd` | `string` | 稳定 Project 分组键 |
| `displayName` | `string` | 默认取 cwd basename；冲突时使用最短可区分路径后缀 |
| `sessions` | `SessionCatalogItem[]` | 按 `updatedAt` 降序排列的 Session |
| `updatedAt` | ISO 8601 string | 组内最近一次 Session 活动时间 |

Project 是导航投影，不新增持久化 Project 实体，也不将 vault 文件夹误认为 cwd。

### 4.3 SessionRuntimeStatus

| 值 | 含义 | 行尾表现 |
|----|------|----------|
| `ready` | 已连接且空闲 | 低强调度就绪图标 |
| `busy` | Agent 正在处理 | 旋转进度图标 |
| `permission` | 等待用户授权 | 警示色授权图标 |
| `error` | 当前运行实例失败 | 错误图标 |
| `disconnected` | 已打开但连接断开 | 断开连接图标 |
| `null` | 当前设备上没有运行实例 | 不显示状态图标 |

运行状态不得改变 Session 的 Project、排序键或列表位置，也不得形成独立 Active 列表。

## 五、业务规则

| 编号 | 描述 | 约束 |
|------|------|------|
| BR-029 | `.session` 是 Session 用户元数据的唯一权威来源 | Catalog 不持久化 title、agentId、cwd、时间或运行状态副本 |
| BR-030 | `session_index.jsonl` 只用于发现和身份映射 | 索引与 `.session` 冲突时不得用索引覆盖 `.session` 内容 |
| BR-031 | Projects 按组内最新 `updatedAt` 降序排列 | 组内 Session 同样按 `updatedAt` 降序；相同时间以 `entryFile` 升序稳定排序 |
| BR-032 | Recents 是跨 Project 的最近 Session 投影 | 与 Projects 中出现同一 Session 是有意的导航重复，不产生第二份实体 |
| BR-033 | 运行状态按 `entryId` 合并并显示在 Session 行右侧 | 不建立 Active 分区，不因状态变化移动列表项 |
| BR-034 | Catalog 必须响应 vault 中 `.session` 的 create、modify、rename、delete 以及 index 变化 | 无需关闭重开侧边栏即可看到更新 |
| BR-035 | 搜索不区分大小写 | 匹配 `title`、Project displayName、完整 cwd、entryFile 和 agentId |
| BR-036 | New session 复用现有 Session 创建流程 | Navigator 不另建不兼容的创建语义或存储路径 |
| BR-037 | 打开 Session 必须复用 `.session` FileView | Navigator 不在自身内部渲染聊天工作区 |
| BR-038 | 重命名和删除通过统一生命周期命令执行 | 必须保持 `.session`、index 与 transcript 的既有一致性规则 |
| BR-039 | 无法解析或缺失的条目不得作为正常 Session 展示 | Navigator 显示可观察的失败摘要和重试入口；不得因单条失败阻断其余列表 |
| BR-040 | 当前选中状态来自 workspace 活动 FileView | 同一 Session 出现在 Projects 和 Recents 时，两处均使用相同选中态 |
| BR-041 | Navigator 的静态标签、命令和可选择行必须具有不同视觉角色 | Obsidian 默认按钮样式不得抹平字号、颜色、字重或 hover 差异 |

## 六、UI 约束

### 6.1 页面结构

从上到下固定为：

1. 标题栏：左侧显示 `Harness`，右侧为搜索图标按钮。
2. `New session` 命令行：图标加文字，整行可点击。
3. `Projects`：Project 行使用文件夹图标，可展开其 Session 子项。
4. `Show more`：Project 超过首批 5 个时出现，展开剩余 Project。
5. `Recents`：跨 Project 展示最近更新的 12 个 Session。
6. `Show more`：存在更多最近 Session 时展开完整列表。

不显示独立 `Active Sessions`、统计卡片、欢迎页或说明性功能文案。

### 6.2 Session 行

- 主文本是 `title`，单行省略；不得以完整 entryFile 代替有效 title。
- 左侧层级和缩进表达 Project 归属，不使用卡片容器。
- 右侧保留固定宽度状态槽，状态图标出现或消失不得改变文本宽度或整行布局。
- 当前活动 Session 使用整行背景高亮；hover 使用更弱的背景反馈。
- 状态图标使用 Obsidian/Lucide 图标并提供 tooltip，不显示额外状态文字。
- hover 或右键打开条目菜单；菜单至少包含 Open、Reveal in file explorer、Rename、Delete。
- 删除必须使用 Obsidian 可恢复的文件删除语义，并在执行前明确确认目标 Session。

### 6.3 搜索状态

- 点击搜索图标后在标题栏位置显示输入框并自动聚焦。
- 搜索结果使用单一扁平 Session 列表，避免同时展示 Projects 和 Recents 重复结果。
- 清空或关闭搜索后恢复之前的 Project 展开状态和 Show more 状态。
- 无结果时只显示紧凑的空结果文案，不改变侧边栏整体宽度。

### 6.4 视觉边界

- 尽量复用 Codex GUI 的紧凑列表密度、低强调分隔、稳定缩进和克制高亮。
- 使用 Obsidian CSS variables 适配明暗主题，不硬编码 Codex 的平台窗口外观。
- 不使用嵌套卡片、渐变、插画、超大字号或大圆角按钮。
- 在 Obsidian 左侧窄栏和浮动宽栏中，标题、图标和菜单不得重叠。

### 6.5 视觉角色层级

- `Projects` 与 `Recents` 是不可交互的分区标题：使用 11 px、`--text-faint`、
  `--font-semibold`，不进入 tab 顺序、不声明 button/link role，也不显示 hover 背景或指针反馈。
- `Show more` 是可交互命令：使用 11 px、`--text-muted`、`--font-medium`；hover 时使用
  列表 hover 背景并将文字提升为 `--text-normal`；文字与分区内容左侧对齐。
- Project 与 Session 行是可选择内容：沿用正常 UI 小字号和 `--text-normal`，字号必须大于
  分区标题及 Show more。
- 上述角色必须在 260 px 与 420 px、明暗主题下保持一致；共享按钮 reset 的选择器优先级
  不得覆盖 Show more 的专用文字颜色、字重和左对齐。
- 第三方主题令 `--text-faint`、`--text-muted` 与 `--text-normal` 解析为相同或缺失颜色时，
  字号、字重和 hover 背景仍须提供至少两种非颜色区分，文字不得不可见。

## 七、错误与边界行为

| 情况 | 行为 |
|------|------|
| 没有 Session | 保留标题栏和 New session，只在主体显示紧凑空状态 |
| Project cwd 不存在 | Session 仍可浏览和离线打开；Project 不因本机目录缺失而消失 |
| index 指向缺失文件 | 不展示为正常 Session，记录失败并沿用既有孤儿索引清理规则 |
| `.session` JSON 损坏或版本不支持 | 其余 Session 正常展示；失败摘要包含文件名和可重试操作 |
| 两个 cwd basename 相同 | 使用最短可区分路径后缀，不合并两个 Project |
| 同一 Session 有多个打开视图 | 合并为一个 Catalog 条目；状态取需要用户优先处理的实例，优先级为 permission、error、busy、ready、disconnected |
| Session 在列表显示期间被移动或删除 | 通过 vault 事件刷新；旧行不可继续执行针对旧路径的操作 |

## 八、非功能指标

| 维度 | 指标 |
|------|------|
| 一致性 | vault create/modify/rename/delete 事件完成后 500 ms 内更新已打开的 Navigator |
| 首次展示 | 500 个有效 Session 的冷加载目标不超过 500 ms；加载期间保留稳定骨架，不显示错误空状态 |
| 交互 | 搜索、展开 Project 和 Show more 不触发磁盘写入；输入到结果更新目标不超过 100 ms |
| 稳定性 | 单个损坏、缺失或不支持版本的 Session 不得阻断其他 Session 展示和打开 |
| 可访问性 | 所有图标按钮有 `aria-label`/tooltip，列表行可通过键盘聚焦和触发 |
| 主题兼容 | 明暗主题均仅使用 Obsidian variables 表达文字、背景、边框和状态色 |
| 架构 | 新增 service 不导入 React；ACP SDK 依赖仍只存在于 `src/acp/` |

## 九、范围外

- 新增独立 Active Sessions 页面或分区
- 将 Session 内容嵌入 Navigator
- 新增持久化 Project、标签、置顶或归档模型
- 跨 vault 汇总 Session
- 自动概括 Session 标题或内容
- 改变 `.session`、transcript 或 ACP continuation 的既有身份模型
- 像素级复制 Codex 的 macOS 窗口框架、品牌或非 Session 功能

## 十、术语表

| 术语 | 代码标识符 | 定义 |
|------|------------|------|
| Session Navigator | `SessionManagerView` | 左侧全局 Session 浏览与管理视图；沿用现有 view type |
| Session Catalog | `SessionCatalog` | 从权威文件与运行时状态生成的可订阅内存投影 |
| Catalog Item | `SessionCatalogItem` | 一个 Session 在 Navigator 中的规范化投影 |
| Project | `SessionProjectGroup` | 以完整 cwd 为稳定键的 Session 分组，不是持久化实体 |
| Recents | `recentSessions` | 所有 Catalog Item 按 updatedAt 排序后的跨 Project 投影 |
| Runtime Status | `SessionRuntimeStatus` | 当前设备上打开实例的瞬时状态，不持久化 |
| Selected Session | `isSelected` | 当前 workspace 活动 FileView 对应的 Session |
| Session Entry | `SessionFileData` | vault 中作为唯一用户元数据真相的 `.session` 文件 |
| Section Label | `agent-client-navigator-section-title` | Projects/Recents 静态结构标签，不可交互 |
| Expansion Command | `agent-client-navigator-show-more` | 展开当前分区剩余条目的可交互命令 |
