# 探索报告：迭代三修复 — 会话管理 + 主布局

## 问题

迭代三完成了 Agent Loop 和流式对话的后端 + 前端组件，但没有会话管理入口，用户无法实际使用：
- MainLayout 只有一个占位 NavRail（聊天图标不可点击）和空白主区域
- ChatPage 是独立全屏视图，没有集成到主布局
- chat-store 没有会话概念，只有扁平 messages 数组
- ModelSwitcher 用 `window.__selectedProvider` 全局变量传值
- 没有"新建会话"按钮、会话列表、会话切换

## 现有代码分析

### 前端布局
- `App.tsx`：view 切换 splash / main / chat / settings，chat 是独立视图
- `MainLayout.tsx`：NavRail（仅图标占位 + Settings）+ MainContent（空白占位）
- `ChatPage.tsx`：左聊天 + 右活动面板，但作为独立全屏视图运行
- `WindowControls.tsx`：自定义窗口标题栏按钮

### chat-store（当前）
- 无会话概念：`messages: ChatMessage[]` 扁平数组
- `sendMessage` 直接调 `agent/run`，用 `window.__selectedProvider` 和 `window.__sessionId`
- `handleEnvelope` 按 `currentRunId` 过滤事件
- 无会话创建/删除/切换/列表

### OpenCowork 参考
- `Layout.tsx`：NavRail + WorkspaceSidebar + 主内容区（ChatHomePage / SessionConversationPane / RightPanel）
- `NavRail.tsx`：左侧 48px 图标栏，chat/tasks/resources/skills/souls/sync/draw/codegraph/ssh + settings
- `WorkspaceSidebar.tsx`（2371行）：会话列表 + 项目列表 + 搜索 + 新建按钮
- `SessionListPanel.tsx`（1884行）：完整的会话列表组件，含搜索/置顶/删除/重命名/导出
- `ChatHomePage.tsx`：新对话首页，含输入框 + 快捷提示 + 项目选择器
- `chat-store.ts`：Session + Project 概念，DB 持久化（SQLite），createSession/deleteSession/duplicateSession 等

### 已有 UI 组件
button, input, dialog, alert-dialog, context-menu, dropdown-menu, select, badge, separator, switch, textarea, tooltip, sonner, spinner

## 设计决策

### 精简策略
OpenCowork 的 WorkspaceSidebar（2371行）和 SessionListPanel（1884行）太重，包含大量不需要的功能（项目/SSH/搜索/置顶/导出/频道/插件等）。需要精简到最小可用：

**保留**：新建会话按钮 + 会话列表 + 切换会话 + 删除会话 + 会话标题自动生成
**砍掉**：项目/SSH/搜索/置顶/导出/频道/插件/模式切换/分离窗口

### 会话持久化
迭代五才做 SQLite 持久化。本次用内存存储（Zustand），关闭应用后丢失。这足够测试迭代三的 Agent Loop。

### 布局结构
```
┌─────┬──────────────┬─────────────────────────┐
│Nav  │ Sidebar      │ Main Content            │
│Rail │              │                         │
│48px │ ~260px       │                         │
│     │              │  ChatPage (聊天+活动面板) │
│ 💬  │ + New Chat   │                         │
│ ⚙️  │ Session 1    │                         │
│     │ Session 2    │                         │
│     │ Session 3    │                         │
└─────┴──────────────┴─────────────────────────┘
```

### ModelSwitcher 修复
从 `window.__` 全局变量改为 chat-store 中的 `selectedProvider` 状态。

## 风险
- chat-store 重构会影响 ChatPage/InputArea/MessageList 等已有组件，需要适配
- AgentStreamReceiver 的 handleEnvelope 需要按 sessionId 分发，不再只按 runId
