---
title: AC-0005: Session Navigator
description: Codex 风格 Session Navigator 的结构、Catalog 实时性、状态投影、搜索和生命周期操作验收标准。
type: ac
status: active
created: 2026-07-26T05:39:33Z
---

# AC-0005: Session Navigator

本文件承接 [Spec-0006](../spec/0006-session-navigator.md)，项目级验收项从
AC-0017 开始。每个验收项分别覆盖正常、边界、异常和失败场景。

## AC-0017: Codex 风格导航结构

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0017-N-1 | Catalog 含 3 个 cwd、每组至少 1 个 Session，且存在 12 条以内最近记录 | 打开 Session Navigator | 从上到下依次显示 `Harness` 标题及搜索按钮、`New session`、`Projects`、`Recents`；不存在 `Active Sessions` 分区、卡片或欢迎页 | WDIO E2E + 截图审查 |
| AC-0017-N-2 | Project 和 Session 的 `updatedAt` 顺序已知 | 打开并展开 Projects | Project 按组内最新 `updatedAt` 降序；组内 Session 按 `updatedAt` 降序；Recents 跨 Project 按 `updatedAt` 降序 | Vitest + WDIO E2E |
| AC-0017-B-1 | Catalog 为空 | 打开 Session Navigator | 标题、搜索按钮和 `New session` 保留；主体只显示一个紧凑空状态；不显示 Projects、Recents 或错误状态 | WDIO E2E + 截图审查 |
| AC-0017-B-2 | 存在 7 个 Project、15 个最近 Session，且两个 cwd basename 相同 | 打开 Navigator，依次点击两个 `Show more` | 首屏只显示 5 个 Project 和 12 个 Recents；点击后显示全部；同名 Project 使用最短可区分路径后缀且不合并 | Vitest + WDIO E2E |
| AC-0017-E-1 | 一个 Project 的 cwd 在当前设备不存在 | 打开并展开该 Project | Project 和所属 Session 仍显示且可打开本地历史；该 Project 不被合并到空值分组或从列表移除 | WDIO E2E |
| AC-0017-F-1 | Catalog 首次读取整体失败 | 打开 Session Navigator | 标题和 `New session` 仍可操作；主体显示包含失败原因的错误状态和 Retry；不把读取失败显示成“没有 Session” | Vitest 故障注入 + WDIO E2E |

## AC-0018: Session Catalog 实时投影

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0018-N-1 | Navigator 已打开，Catalog 中有一个有效 Session | 在 vault 中依次创建、修改 title/updatedAt、重命名和删除 `.session` | 每次 vault 事件完成后 500 ms 内，Navigator 分别新增、更新、移动路径和移除对应行；无需关闭重开视图 | 假时钟单元测试 + E2E |
| AC-0018-N-2 | `.session` 与 index 字段存在差异 | 加载 Catalog | title、agentId、cwd、createdAt、updatedAt 取自 `.session`；index 只提供发现和 entryFile 映射；Catalog 不写入第二份元数据 | 单元测试 + 存储写入断言 |
| AC-0018-B-1 | Navigator 已打开 | 创建、修改、移动或删除普通 `.md` 文件 | Catalog snapshot 不变，不重新解析 Session 列表 | 单元测试 |
| AC-0018-B-2 | 同一 `entryId` 对应多个打开视图 | 刷新 Catalog | 只生成一个 `SessionCatalogItem`，Projects 和 Recents 各自最多显示一次该 Session | Vitest + WDIO E2E |
| AC-0018-E-1 | index 同时包含一个有效条目、一个缺失 entryFile 和一个损坏 `.session` | 加载 Catalog | 有效 Session 正常显示；另外两项不显示为正常 Session；错误摘要列出对应文件且提供 Retry；孤儿条目按既有规则清理 | Vitest + WDIO E2E |
| AC-0018-F-1 | 已有成功 snapshot，后续 vault 事件刷新时读取失败 | 修改一个 `.session` | 保留上一份完整 snapshot；显示刷新失败状态和 Retry；不得用空数组覆盖现有列表 | Vitest 故障注入 + WDIO E2E |

## AC-0019: 行尾运行状态与选中态

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0019-N-1 | 五个已打开 Session 的状态依次为 ready、busy、permission、error、disconnected | 打开 Projects 和 Recents | 每个 Session 行右侧固定宽度槽分别显示就绪、旋转进度、授权、错误、断开图标；图标有对应 tooltip；没有独立 Active 分区 | WDIO E2E + 截图审查 |
| AC-0019-N-2 | 一个 `.session` FileView 是 workspace 活动视图，且该 Session 同时出现在 Projects 和 Recents | 切换到该 FileView | Projects 和 Recents 中对应两行同时使用选中背景；切换到其他 Session 后原两行取消选中 | WDIO E2E + 截图审查 |
| AC-0019-B-1 | Session 当前没有打开实例，`runtimeStatus=null` | 展示该 Session | 行尾状态槽保留布局宽度但不显示图标；title 起止位置与有状态的相邻行一致 | WDIO DOM 几何断言 + 截图审查 |
| AC-0019-B-2 | 同一 `entryId` 的多个视图状态分别为 ready、busy、error、permission | 更新运行状态 | Catalog 合并结果为 permission；依次移除对应视图后结果为 error、busy、ready、null | 单元测试 |
| AC-0019-E-1 | view registry 发布一个找不到对应 Catalog Item 的 `entryId` | 更新运行状态 | Navigator 忽略该孤立状态；现有 Session 的图标、排序和选中态不变；记录 debug warning | 单元测试 |
| AC-0019-F-1 | view registry snapshot 获取或订阅失败 | 打开 Navigator | 所有持久 Session 仍按 Projects 和 Recents 展示；状态槽为空；主体显示非阻断运行状态错误，不影响打开 Session | Vitest 故障注入 + WDIO E2E |

## AC-0020: Session 搜索

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0020-N-1 | Catalog 分别有 title、Project displayName、完整 cwd、entryFile、agentId 可唯一命中的 Session | 点击搜索图标，依次输入每个查询值 | 输入框自动聚焦；每个查询均返回对应 Session；结果是无 Projects/Recents 重复项的单一扁平列表 | Vitest + WDIO E2E |
| AC-0020-N-2 | 搜索前已有展开的 Project 和已展开 Show more | 搜索并清空查询 | 搜索期间只显示匹配结果；清空或关闭后恢复搜索前的 Project 展开和 Show more 状态 | WDIO E2E |
| AC-0020-B-1 | title 为 `Release Review` | 输入前后带空格的 `  release review  ` | 忽略首尾空格并进行不区分大小写匹配，只显示该 Session | 单元测试 |
| AC-0020-B-2 | 没有字段匹配查询 | 输入查询 | 显示一个紧凑无结果状态；Navigator 宽度、标题栏和搜索关闭按钮位置不变 | WDIO E2E + 截图审查 |
| AC-0020-E-1 | 搜索结果中的 `.session` 在点击前被移动或删除 | 点击旧搜索结果 | 不打开旧路径、不作用于其他文件；该行在 500 ms 内刷新或移除，并显示目标已变化的提示 | E2E |
| AC-0020-F-1 | 搜索期间 Catalog 刷新失败 | 输入新查询并等待刷新 | 继续在最后成功 snapshot 上执行查询；显示 Catalog 刷新错误和 Retry；输入内容不丢失 | Vitest 故障注入 + WDIO E2E |

## AC-0021: Session 导航与管理操作

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0021-N-1 | Navigator 已打开 | 点击 `New session` | 调用现有 Session 创建流程；创建成功后打开对应 `.session` FileView，Catalog 在 500 ms 内出现该 Session | E2E |
| AC-0021-N-2 | 存在有效 Catalog Item | 依次执行 Open、Reveal in file explorer、Rename | Open 使用现有 `.session` FileView；Reveal 选中文件树中的对应文件；Rename 更新 vault 文件和 Catalog，entryId/historyId 不变 | E2E |
| AC-0021-N-3 | 存在有效 Catalog Item 和 transcript | 从条目菜单执行 Delete 并确认 | 使用 Obsidian 可恢复删除语义移除准确的 `.session`；index 与 transcript 按既有生命周期规则清理；Projects 和 Recents 中对应行均消失 | E2E + 存储断言 |
| AC-0021-B-1 | 用户打开 Delete 确认框 | 取消删除 | `.session`、index、transcript 和 Catalog 均不变 | WDIO E2E |
| AC-0021-B-2 | Rename 的目标文件名已存在 | 提交重命名 | 显示冲突提示；不覆盖目标；原 entryFile、entryId、historyId 和 Catalog 行保持不变 | E2E |
| AC-0021-E-1 | 打开条目菜单后目标文件被外部移动或删除 | 执行 Reveal、Rename 或 Delete | 操作根据 `entryId` 重新解析当前路径；无法解析时停止并提示，不操作旧路径或同名其他文件 | E2E |
| AC-0021-F-1 | Rename 或 Delete 的 vault/index/transcript 操作中途失败 | 执行对应操作 | 显示包含失败阶段的错误；Catalog 重新读取权威文件后展示实际状态；不得显示已成功但磁盘不存在的虚假结果 | 故障注入集成测试 |

## AC-0022: 视觉、可访问性与性能

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0022-N-1 | 明暗主题各准备一个包含 Projects、Recents、选中态和运行状态的 Catalog | 在 260 px 和 420 px 侧栏宽度渲染 Navigator | 结构、密度、缩进和高亮与批准基线一致；不出现卡片、渐变、大圆角控件或文本/图标重叠 | WDIO 截图审查 |
| AC-0022-N-2 | Navigator 已打开 | 仅使用键盘遍历搜索、New session、Project、Session 和菜单 | 每个交互元素可聚焦并触发；焦点顺序与视觉顺序一致；图标按钮具有 aria-label，状态图标具有 tooltip | WDIO E2E |
| AC-0022-B-1 | title、cwd 和 entryFile 含超长无空格文本 | 在 260 px 侧栏显示 | 主文本单行省略且不越过固定状态槽；tooltip 可读取完整值；行高与相邻项一致 | WDIO DOM 几何断言 + 截图审查 |
| AC-0022-B-2 | Catalog 含 500 个有效 Session | 冷打开 Navigator，随后输入搜索并展开 Project | 冷加载在 500 ms 内完成；输入到结果更新在 100 ms 内完成；搜索和展开不产生 vault 写入 | 性能测试 + 写入 spy |
| AC-0022-E-1 | Obsidian 图标注册表无法解析某个状态图标 | 渲染对应状态 | 状态槽保持尺寸，显示可访问的 fallback；title、菜单和相邻行不位移 | Vitest stub 故障注入 + WDIO 截图审查 |
| AC-0022-F-1 | 500 个 Session 冷加载超过 500 ms 或被中断 | 等待加载 | 稳定加载骨架保持原尺寸；超时后显示 Retry 和实际失败原因；不短暂显示空 Catalog | Vitest 性能故障注入 + WDIO 截图审查 |

## AC-0023: Navigator 视觉角色层级

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0023-N-1 | Projects 与 Recents 均有条目且显示 Show more | 在明暗主题分别打开 Navigator，并使用 Tab 与点击检查分区标题 | Projects/Recents 的计算样式为 11 px、`--text-faint`、semibold、`cursor != pointer`，且不进入 tab 顺序、无 button/link role、点击无动作；Show more 为 11 px、`--text-muted`、medium；Project/Session 行字号大于 11 px且为 `--text-normal` | WDIO 计算样式与可交互性断言 + 截图审查 |
| AC-0023-B-1 | 侧栏宽度分别为 260 px 和 420 px | 比较三个视觉角色 | 两种宽度下字号、颜色和字重角色不变；长 Session title 省略但不影响分区标题和 Show more 的位置 | WDIO DOM 几何断言 + 截图审查 |
| AC-0023-E-1 | 第三方 Obsidian 主题令 `--text-faint`、`--text-muted` 与 `--text-normal` 解析为相同颜色或缺失颜色 | 渲染并依次悬停 Projects 标题、Show more 和 Session 行 | 所有文字仍可见；Projects/Recents 仍以 11 px semibold、Show more 以 11 px medium、Project/Session 行以更大正文区分；Projects 标题无 hover，Show more 与 Session 行仍有各自 hover 背景 | WDIO 主题故障注入 + 计算样式断言 |
| AC-0023-F-1 | Obsidian 主题为按钮设置默认文字颜色、字重和居中布局 | 渲染 Navigator | Navigator 专用选择器仍使 Show more 保持 11 px、`--text-muted`、medium 和左对齐；不得退化为与 Session 行相同的正文样式 | Vitest CSS 边界断言 + WDIO 计算样式断言 |
