---
title: AC-0006: Session Workspace Experience
description: Project-aware Session creation, synchronized per-user-message turn navigation and Navigator action menu refinements through v0.5.1.
type: ac
status: active
created: 2026-07-27T02:47:58Z
---

# AC-0006: Session Workspace Experience

本文件承接 [Spec-0007](../spec/0007-session-workspace-experience.md)，项目级验收项从
AC-0024 开始。每个验收项分别覆盖正常、边界、异常和失败场景。

本文件激活后，AC-0024 取代 [AC-0021-N-1](0005-session-navigator.md#AC-0021-Session-导航与管理操作)
的直接创建预期；AC-0026-N-1 取代 AC-0021-N-2 中 Open 的菜单入口预期，Open 能力改由行点击或
键盘激活验收。AC-0021-N-2 的 Reveal 和 Rename 行为继续有效。

[Spec-0004](../spec/0004-acp-turn-transcript.md) 和
[AC-0003](0003-acp-turn-transcript.md) 已取代早期 AC-0006-N-3、AC-0003-* 与 AC-0004-N-1 中
`sessions/{sessionId}/main.jsonl` 及按 backend session ID 定位/删除 history 的预期。本文件只验收
v2 transcript：本地身份为 `historyId`，manifest 精确路径为 `sessions/{historyId}/manifest.json`。

## AC-0024: Project-aware Session 创建

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0024-N-1 | Navigator 已打开，`~/Documents/atlas` 不存在 | 点击 `New session`；输入 Project name `atlas`；确认 Location；点击 Create | 弹窗打开时磁盘写入为 0；Location 实时显示 `~/Documents/atlas`；提交严格执行 validate → 创建默认目录 → 预留唯一 entryId/historyId → `sessions/{historyId}/manifest.json` → `.session` → 串行幂等 index reconciliation/confirmation。manifest.historyId = `.session`.historyId = index.historyId；`.session`.entryId = index.entryId；三者 cwd/metadata.cwd = `~/Documents/atlas`；index.entryFile = 新 `.session` 的 vault path；各 artifact 恰好 1 份。全部完成后才打开 FileView，Catalog 在 500 ms 内出现该 Session | Vitest 路径规则 + WDIO E2E + 存储调用顺序/字段身份断言 |
| AC-0024-N-2 | 原生 picker 可返回存在的 `/work/demo` | 添加 source folder `/work/demo` 后提交 | 只显示一个 source folder；Project name 显示并锁定为 `demo`；Location 显示 `/work/demo`；Add folder 不再可用且不存在多目录 Agent access 控件；不创建或修改该目录；新 Session 的三份持久 artifact 均使用该 cwd | WDIO E2E + 文件系统写入 spy |
| AC-0024-N-3 | Navigator 有 cwd 为 `/work/demo` 的 Project | 从 Project 菜单执行 `New session here` | 打开同一创建弹窗并预选 `/work/demo`，提交前不创建 Session；用户确认后按 AC-0024-N-2 创建 | WDIO E2E |
| AC-0024-N-4 | 明暗主题和 260、520、800、1200 px 宿主宽度矩阵已准备 | 分别从全局 `New session` 和 Project ellipsis 的 `New session here` 打开弹窗；仅用键盘填写、打开/取消 picker、移除目录；正反向遍历焦点；分别用 Escape、Cancel 和关闭按钮退出 | 初始焦点位于 Project name；Tab/Shift+Tab 在 Project name、Add folder 或 source-folder remove、Cancel、Create、关闭按钮之间按视觉顺序循环且不逸出 modal；picker 取消后焦点回到 Add folder；每个控件有可读名称和可见焦点；三种关闭方式分别把焦点返回准确的全局 `New session` 或 Project ellipsis；Create 在无效或 pending 时禁用；两种主题和各宽度下无嵌套卡片、渐变、大圆角营销布局、文本重叠或水平溢出 | WDIO 键盘/可访问性/计算样式断言 + 截图审查 |
| AC-0024-B-1 | 创建弹窗已填写名称，磁盘写入受监控 | 依次取消 folder picker、取消弹窗、通过关闭按钮退出 | picker 取消保留当前表单；弹窗退出后 Project 目录、`.session`、transcript 和 index 均无新增 | WDIO E2E + 写入 spy |
| AC-0024-B-2 | `~/Documents/atlas` 已存在 | 输入 `atlas`；随后通过 picker 显式选择该目录 | 未显式选择时 Create 禁用并显示目标已存在；显式选择后名称锁定为 basename，允许按 selected target 创建；不得覆盖目录内文件 | Vitest + WDIO E2E + 目录快照断言 |
| AC-0024-B-3 | picker 返回值和名称输入可参数化 | 依次输入空白、`.`、`..`、路径分隔符、控制字符、尾部点/空格；再提交相对路径、普通文件、不存在路径、POSIX `/`、Windows drive root、UNC share root | 每个无效名称均在字段附近显示具体原因且 Create 禁用；source target 必须是存在的绝对目录；平台原生 path 规范化后等于 `path.parse(normalized).root` 的目录被拒绝；校验不解析 symlink | 跨平台参数化单元测试 + WDIO E2E |
| AC-0024-B-4 | 有效表单已填写，第一次提交处于 pending，未注入故障 | 连续触发 Create 两次 | 第二次触发被禁用或忽略；最终恰好产生一个 entryId、一个 historyId、各一份 manifest/`.session`/index mapping 和一个 FileView | 并发单元测试 + E2E |
| AC-0024-B-5 | 已选择一个 basename 和路径均超长的有效目录 | 查看 Location 和 Project name；移除 source folder | 两者单行省略且 tooltip/accessible name 提供完整值；移除后 Project name 恢复可编辑、Add folder 恢复可用，Location 改为随名称派生的默认 cwd | WDIO DOM 几何/可访问性断言 |
| AC-0024-E-1 | 已选择一个存在目录 | 在提交前从磁盘删除该目录，再点击 Create | 提交停止，source folder 标记为不存在；不创建 `.session`、transcript 或 index，不回退到 vault root | 故障注入 E2E |
| AC-0024-E-2 | homedir 或 Documents 路径解析被注入失败，未选择 source folder | 打开创建弹窗并输入有效名称 | Location 显示无法确定默认目录的具体错误，Create 禁用；cwd 不回退到 vault root | Vitest 故障注入 + WDIO E2E |
| AC-0024-F-1 | 默认目标目录不存在，目录创建被注入拒绝 | 提交有效默认 target | 弹窗和输入保留并显示 OS 错误摘要；不创建 `.session`、transcript 或 index | 故障注入集成测试 |
| AC-0024-F-2 | 分别在 transcript、`.session`、index confirmation 阶段注入失败，并允许 create/delete reconciliation 交错执行 | 提交有效 target，记录已预留的 entryId/historyId 和 entryFile，等待补偿与 Catalog refresh 完成 | 不打开 FileView；该 entryId 的 materialization/compensation 串行结束；本次 `.session` 先失效或删除，排队 create reconciliation 不得重建具有该 entryId/historyId/entryFile 的 mapping；`sessions/{historyId}/`、对应 entryFile 的 `.session` 和对应 entryId 的 index mapping 最终均不存在；cwd 目录及其原有内容保留 | 并发故障注入集成测试 + 最终磁盘/Catalog 断言 |
| AC-0024-F-3 | transaction 失败；分别只对 `.session`、transcript 或 index artifact 注入补偿删除失败 | 等待补偿和 Catalog refresh 结束 | 三组均不打开 FileView、不显示 Created Notice、不显示正常 Catalog 行，且弹窗错误列出失败阶段、残留类型和精确路径。`.session` 删除失败组仅对应 entryFile 存在，`sessions/{historyId}/` 和 index mapping 不存在；transcript 删除失败组仅 `sessions/{historyId}/` 存在，entryFile 和 index mapping 不存在；index 删除失败组仅对应 entryId/historyId/entryFile 的 mapping 存在，entryFile 和 `sessions/{historyId}/` 不存在，Catalog 错误摘要列出缺失 entryFile 并尝试既有孤儿清理；其他 Catalog 行不变 | 参数化故障注入集成测试 + WDIO E2E |

## AC-0025: Turn Navigator

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0025-N-1 | `.session` FileView 含 3 条 user message、assistant/tool/plan 消息，宿主宽度 800 px | 打开 Session；依次 hover 和键盘 focus 各节点 | MessageList 左缘恰好显示 3 个固定点击区域的可聚焦 button 节点和连续细线；顺序与 user message 一致；非 user 消息不生成节点；aria-label 含 turn 序号和纯文本 preview | Vitest projection + WDIO E2E + 可访问性/几何断言 |
| AC-0025-N-2 | 三个 user message 的 index 已知 | 点击第二节点，再用键盘激活第三节点并滚动消息区 | 两次均将对应 messageId 的 user message 起始位置带入 viewport 并最终按 `align=start` 精确落点；active 节点按 viewport 上部锚点之前最近的 user message 更新；不得跳到同 index 的其他消息 | WDIO E2E + virtualizer spy |
| AC-0025-N-3 | 分别启用和关闭 `prefers-reduced-motion` | 激活同一远距离节点；再从顶部点击回到底部 | 普通模式下两类动作都调用同一个 `coordinateSmoothMessageScroll` 入口，各使用 1 次原生平滑主滚动、最多 1 次平滑修正；末端修正保持同一 action identity，不触发该动作的 cleanup、重新启动主滚动或重置 3.2 s 总时限；每阶段在 1.6 s 内结束，Turn 目标在主阶段进入 viewport 并在完整动作 3.2 s 内按 `align=start` 精确落点；reduced motion 的 Turn 立即跳转且 100 ms 内进入 viewport | MessageList coordinator invocation/action identity spy + 代码审查 + 假时钟 + WDIO 动画/几何断言 |
| AC-0025-N-4 | 明暗主题下轨道有 active 节点，preview 含长文本，宿主宽度 520、800、1200 px | 依次 hover、focus 节点并滚动消息 | 每个键盘 focus 节点有可见焦点；active 同时以尺寸和主题色区别，active/hover 使用 120-180 ms CSS transition；hover/focus preview 不遮挡当前节点且不越出 viewport；轨道显示与滚动不改变 InputArea 宽度；各宽度下轨道、消息和滚动条不重叠 | WDIO 计算样式/可见焦点/DOM 几何断言 + 截图审查 |
| AC-0025-N-5 | 普通动态效果下，长 Session 已滚动到顶部且回到底部按钮可见，消息高度在滚动期间完成测量 | 记录 message viewport 的原生平滑滚动调用、每次调用时的容器几何并点击回到底部 | 主平滑滚动的 target 等于点击时 `max(0, scrollHeight - clientHeight)`；只有最终实时最大 offset 与当前位置相差超过 1 px 时才执行第 2 次末端平滑修正，每阶段在 1.6 s 内结束且完整动作不超过 3.2 s；最终 `scrollHeight - clientHeight - scrollTop <= 35`、按钮隐藏且原生平滑调用总数不超过 2 | WDIO E2E + scrollTo spy + DOM 几何/时限断言 |
| AC-0025-B-1 | 分别准备 0 条 user message；宿主宽度 260、519、520、800、1200 px | 渲染 MessageList | 0 条 user message 时不显示轨道；260/519 px 时隐藏且消息恢复原左边距；520 px 及以上允许显示；所有宽度下 InputArea 宽度不变，无水平溢出或消息/滚动条重叠 | Vitest + WDIO DOM 几何断言 + 截图审查 |
| AC-0025-B-2 | user message 含超过 160 字符的混合文本和仅附件内容 | 查看节点 preview | 文本合并空白并截断到最多 160 字符；仅附件消息显示可读类型摘要；DOM、aria-label 和 tooltip 均不含 base64 或完整资源 URI | Projection 单元测试 + WDIO DOM 断言 |
| AC-0025-B-3 | `.session` 含 500 条 ChatMessage，streaming 导致消息高度连续变化 | 滚动并持续接收 chunks | projection 在 16 ms 内完成；active 更新按 animation frame 合并；节点数量与 messageId 映射不抖动 | 性能测试 + 假 RAF 单元测试 |
| AC-0025-B-4 | viewport 可滚动到第一条 user message 之前和最后一条之后 | 分别滚动到两个边界 | 第一条之前 active 为第一条 user message；最后一条之后 active 为最后一条 user message | WDIO E2E + active messageId 断言 |
| AC-0025-B-5 | 分别处于已到底部状态和 `prefers-reduced-motion: reduce` 且未到底部状态 | 检查按钮；在 reduced motion 场景点击回到底部 | 已到底部时不显示按钮且不发起滚动；reduced motion 下只执行一次到实时 `max(0, scrollHeight - clientHeight)` 的即时容器滚动，不调用原生平滑滚动，最终 bottom distance 不超过 35 px 且按钮隐藏 | WDIO E2E + motion media/scroll spy + DOM 几何断言 |
| AC-0025-E-1 | 用户已聚焦一个 turn 节点 | 点击前切换到另一 Session，使原 messageId 消失；随后激活新 Session 中一个已知 messageId 的节点 | 旧导航请求被忽略且不得跳到新 Session 的相同 index；后续请求将新 Session 的已知 messageId 滚动到 viewport 起始位置 | 并发 E2E |
| AC-0025-E-2 | 同一消息数据分别渲染在 floating chat、旧 ChatView 和 `.session` FileView | 打开三个宿主 | 只有 `.session` FileView 显示 Turn Navigator；其他宿主不给消息区预留轨道空白 | WDIO E2E + DOM 几何断言 |
| AC-0025-E-3 | Turn 或回到底部平滑滚动尚未结束 | 分别启动另一个 Turn/回到底部动作；用 wheel/trackpad、触摸、滚动条拖动和滚动键直接滚动；另行替换当前 Session 消息或卸载 MessageList；再触发旧动作已排队的 scrollend/timeout | 新导航先清理旧动作且只有新目标允许修正和精确落点；每种直接输入都取消旧动作并继续按实际 viewport 更新 active messageId；目标变化或卸载时旧动作的 listener 和 timer 均已清理；被取消的动作均不执行迟到修正或 exact landing，不把 viewport 拉回旧目标 | WDIO 输入/E2E + 假时钟组件测试 + listener/scroll spy |
| AC-0025-F-1 | virtualizer 的一个目标测量失败或返回不可用尺寸，另一个节点可正常测量 | 依次激活失败节点和正常节点 | 失败节点使用该 index 的 estimate 尝试一次定位且不进入重复滚动循环，active 不错误指向其他 messageId；随后正常节点完成滚动并成为 active | Vitest 故障注入 + WDIO E2E |
| AC-0025-F-2 | 回到底部目标的容器几何读取抛错或返回不可用值 | 点击回到底部，随后恢复正常几何并再次从顶部点击 | 首次只执行一次即时 bottom fallback，不调用原生平滑滚动或进入重试循环，MessageList 保持可操作；后续正常动作满足 AC-0025-N-5 | Vitest 故障注入 + WDIO E2E |

## AC-0026: Navigator action menus

| 编号 | 前置条件 | 操作步骤 | 预期结果 | 验证方式 |
|------|---------|---------|---------|---------|
| AC-0026-N-1 | Navigator 含有效 Session | 打开 Session ellipsis 菜单；随后点击 Session 行并用 Enter/Space 激活 | 菜单只含 `Reveal in file explorer`、`Rename`、`Delete`，不含 `Open`；行点击和两个键盘键均打开准确的 `.session` FileView | WDIO E2E + 菜单文本断言 |
| AC-0026-N-2 | Navigator 含 cwd `/work/demo` 的 Project | 打开 Project ellipsis 和右键菜单，依次执行三个命令 | 两个入口显示同一固定菜单：`New session here`、`Open in system file manager`、`Copy path`，不含 Rename/Delete；New session 打开预选 cwd 的创建弹窗；系统动作打开 `/work/demo`；Copy path 写入完整 cwd | WDIO E2E + host/clipboard spy |
| AC-0026-N-3 | macOS、Windows、Linux host 矩阵中，同一 Project 下有 `.session` entryFile 与外部 cwd | 分别执行 Session Reveal 和 Project 系统打开 | Session Reveal 在 Obsidian vault 文件树定位 `.session`；Project 动作分别通过 Finder、Windows Explorer、Linux 桌面文件管理器打开 cwd；两者图标和文案可区分 | 三平台 Host 集成测试 + WDIO E2E + 截图审查 |
| AC-0026-N-4 | 明暗主题和 260、520、800、1200 px 宿主宽度矩阵已准备 | 仅用键盘聚焦 Project/Session ellipsis；打开菜单，以方向键遍历并用 Enter/Space 激活；重开后按 Escape | Project 与 Session ellipsis 尺寸、hover/focus 规则和菜单样式一致；每个按钮/菜单项可聚焦、有可读名称和可见焦点；方向键按视觉顺序移动焦点，Escape 关闭并把焦点返回对应 ellipsis；菜单不越出 viewport，文字/图标不重叠 | WDIO 键盘/可访问性/计算样式/几何断言 + 截图审查 |
| AC-0026-B-1 | Project 当前为折叠或展开状态 | 点击 ellipsis 并选择空白关闭；再右键 Project 行 | 两种菜单操作均不改变 Project 展开状态；ellipsis 与 chevron 是相邻 button，无嵌套交互元素 | WDIO E2E + DOM 结构断言 |
| AC-0026-B-2 | Project cwd 已从磁盘删除 | 执行 `Copy path` | clipboard 仍收到完整 cwd；不尝试创建目录、打开系统文件管理器或修改 Catalog | WDIO E2E + host 写入 spy |
| AC-0026-E-1 | Project cwd 在菜单打开后被删除 | 依次执行 `New session here` 和 `Open in system file manager`；随后执行 `Copy path` 并展开/折叠 Project | 前两个动作停止并显示包含 cwd 的可定位错误，不打开创建弹窗或错误目录；随后 clipboard 收到完整 cwd，Project 展开状态按点击切换 | 故障注入 E2E |
| AC-0026-F-1 | 第一次系统文件管理器调用被拒绝，clipboard 可用 | 执行 `Open in system file manager`；确认焦点后重开菜单并执行 `Copy path` | 显示包含 cwd 的非阻断 Notice；菜单关闭后焦点返回 Project ellipsis；Session、Catalog 和展开状态不变；重开菜单后 clipboard 收到完整 cwd | Host 故障注入 + WDIO E2E |
| AC-0026-F-2 | 第一次 clipboard 写入被拒绝，系统文件管理器 API 可用 | 执行 `Copy path`；确认焦点后重开菜单并执行 `Open in system file manager` | 显示 Copy path 失败；菜单关闭后焦点返回 Project ellipsis；Session 和 Catalog 不变；重开菜单后系统文件管理器收到准确 cwd | Clipboard/Host 故障注入 + WDIO E2E |
