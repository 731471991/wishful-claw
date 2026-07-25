# 新会话启动提示语

> 复制以下内容到新会话作为第一条消息发送。

---

老大，继续 wishful-claw 开发。这是 Agent 编程软件，融合三个开源项目：OpenCowork（Agent Loop / 工具链 / Provider / 架构）、KodaClaw（记忆系统 / 人格系统设计）、OpenClaw.net（记忆主动回忆机制）。

**项目路径**：`D:\claw\wishful-claw`
**GitHub**：731471991/wishful-claw
**技术栈**：React + Electron（前端）+ .NET 10（后端）+ MessagePack（IPC 通信）

**开工前请先阅读以下文档**：
1. `AGENTS.md` — 项目结构、分层约定、参考源码路径、Git 提交规范
2. `docs/dev-workflow.md` — 六阶段开发工作流 SOP
3. `docs/plans/iter-11/plan.md` — 本次迭代的计划文档

**参考源码位置**（笔记本实际路径）：
- OpenCowork：`D:\claw\OpenCowork`（Agent Loop / 工具链 / Provider / 前端 UI）
- KodaClaw：`D:\claw\koda-claw`（记忆 / 人格设计思路）
- OpenClaw.net：`D:\claw\openclaw.net`（记忆主动回忆 / 上下文预算）

**当前状态**：
- 迭代一~十已完成，代码都在 `main` 上（最新 commit: `6f7c009`）
- 当前分支 `dev/iter-10`，已合并 main 并 push
- 本次新开 `dev/iter-11` 分支，从 main 切出
- tag 只打到 v0.5.0（v0.6.0~v0.10.0 缺失，不影响开发，后面补）

**已完成的基础设施**（迭代一~十）：
- Electron + React 前端 + .NET 10 后端 + MessagePack IPC 通信全链路打通
- Provider 配置（28 个预设 + CRUD + 连通性测试 + 模型拉取）
- Agent Loop（流式对话 + 取消 + 上下文压缩 + 工具调用循环）
- 工具链（7 个基础工具 + 工具调用 UI）
- 项目注册 + 会话历史（SQLite 持久化，实时写入）
- 人格系统（6 套 24 个预设 + PromptBuilder + 会话级切换 + AI 辅助创建）
- 记忆系统（三层 Hot/Warm/Cold + FTS5 全文搜索 + TryInjectRecall 主动回忆 + 记忆工具）
- 集成验证（全链路修复 + 日志系统 + Worker 防崩溃）
- 提示词优化器（从 OpenCowork 移植，弹窗式 3 选项）
- 子 Agent（Task 工具 + SubAgentExecutor + 事件流 + 前端 SubAgentCard/OrchestrationBlock + 并发上限双信号量 + 超限反馈）
- 前端布局完整搬自 OpenCowork（NavRail + WorkspaceSidebar + TitleBar + SessionConversationPane）
- 重试机制 UI（固定在输入框上方）+ pre-tool phase 视觉标记

**迭代十一目标：右侧面板 — 子 Agent 执行面板 + 内置浏览器**

详细计划见 `docs/plans/iter-11/plan.md`，三个 Plan：
- **11-1**：右侧面板 Tab 系统重构 — 重写 RightPanel + 新建 RightPanelHeader + ui-store 补全 + webviewTag 开启
- **11-2**：SubAgentsPanel — 搬入子 Agent 编排面板（列表/状态/详情），适配 agent-store
- **11-3**：BrowserPanel — 搬入内置浏览器面板，补全 browser-access，webview 常驻 + Agent 工具驱动

**当前右侧面板现状**：
- `RightPanel.tsx` — 硬编码 Activity + Memory 双 tab，没有动态 tab 系统
- `ui-store.ts` — `RightPanelTabKind` 类型已有 7 种（review/files/preview/browser/subagent/terminal/context），但操作方法不完整，`ensureBrowserTab` 不存在，`openFilePreview` 是 stub，浏览器状态字段不完整（缺 canGoBack/canGoForward/errorInfo/setBrowserWebviewRef）
- `openBrowserTab` / `getBrowserWebviewRef` / `getBrowserState` 都是 stub
- ActivityPanel — 简单的迭代/工具调用日志列表
- MemoryPanel — 记忆搜索/统计（已完成）
- `webviewTag: true` 未在 BrowserWindow webPreferences 中开启
- `browser-access.ts` 是 17 行 stub（只有 allow: true）

**OpenCowork 可搬的文件**（`D:\claw\OpenCowork`）：

SubAgentsPanel 相关：
- `src/renderer/src/components/layout/SubAgentsPanel.tsx`（460 行）— 列表 + 详情
- `src/renderer/src/components/layout/SubAgentExecutionDetail.tsx`（357 行）— 单个子 Agent 详情
- `src/renderer/src/components/layout/sub-agent-run-data.ts`（308 行）— 合并 session 子 Agent 数据
- `src/renderer/src/components/layout/sub-agent-visuals.tsx`（29 行）— 图标色调

BrowserPanel 相关：
- `src/renderer/src/components/layout/BrowserPanel.tsx`（411 行）— 工具栏 + webview + 错误提示
- `src/renderer/src/lib/app-plugin/browser-access.ts`（120 行）— 完整版 URL 规范化 + 域名白/黑名单
- `src/renderer/src/lib/browser/webview-helpers.ts`（32 行）— webview 工具函数

RightPanel 系统：
- `src/renderer/src/components/layout/RightPanel.tsx`（380 行）— 动态 tab + 拖拽 + 动画
- `src/renderer/src/components/layout/RightPanelHeader.tsx`（209 行）— tab 条

**wishful-claw 已有的相关基础**：
- `src/renderer/src/stores/agent-store/slices/sub-agent-slice.ts`（545 行）— 子 Agent 状态管理已有
- `src/renderer/src/stores/agent-store/types.ts`（258 行）— SubAgentState 类型已有
- `src/renderer/src/components/chat/SubAgentCard.tsx`（325 行）— 聊天区子 Agent 卡片已有
- `src/renderer/src/components/chat/OrchestrationBlock.tsx`（27 行）— 空壳
- `src/renderer/src/stores/app-plugin-store.ts`（325 行）— 插件 store 已有
- `src/renderer/src/lib/app-plugin/types.ts`— BROWSER_PLUGIN_ID 等常量已有
- `src/renderer/src/lib/tools/browser-native-ui.ts`（747 行）— 浏览器工具 UI 已有
- `src/renderer/src/lib/tools/browser-tool.ts`（253 行）— 浏览器工具定义已有
- `src/shared/browser-plugin.ts`（23 行）— BUILTIN_BROWSER_PARTITION 常量已有
- `src/renderer/src/lib/browser/webview-helpers.ts`（40 行）— 已有但可能需要补全

**执行顺序**：11-1（地基）→ 11-2（子Agent面板）→ 11-3（浏览器）

**请按 dev-workflow.md 的六阶段 SOP 执行**。

**会话开始时请先执行**（dev-workflow.md 会话边界规则）：
1. `git status` + `git log --oneline -10` — 定位当前进度
2. 读 `docs/plans/iter-11/plan.md` — 确认 Plan 和步骤
3. 报告进度摘要，然后继续执行

**Git 工作流**（AGENTS.md 中有提交规范）：
- 从 main 切 `dev/iter-11` 分支开发
- **功能单元测试通过后才 commit**，不要改一点就提交。中间反复修改不产生 commit
- Plan 执行期间只 commit 不 push
- Plan 所有功能单元完成并通过验证后，一次性 push
- 迭代验证通过后打 tag `v0.11.0`，合并回 main 并 push（**需用户确认后才执行**）

**特别注意**：
- 从 OpenCowork 搬代码时必须适配项目命名空间（`WishfulClaw.*`）和分层约定，清理不需要的功能
- 大文件搬入时按职责拆分
- `webviewTag: true` 必须在 BrowserWindow webPreferences 中开启，否则 `<webview>` 标签不工作
- 浏览器 tab 的 webview 需要常驻（切 tab 不销毁），保证 Agent 浏览器工具持续可用
- 浏览器状态（URL/loading/navState）按 session 或 project 隔离
- 搬入的组件要适配 wishful-claw 的 i18n（中英文）
- 迭代是否完结由用户确认，Agent 不得自行合并 main / 打 tag / 删分支

叫老大，我们是并肩协作的兄弟。
