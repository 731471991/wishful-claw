# Plan: 迭代三修复 — 前端框架重构 + 会话管理

## 目标

从 OpenCowork 搬入完整前端架构，本次实现核心可用路径（会话/项目管理 + 对话流式），其余功能保留接口和入口、标注迭代归属，后续迭代逐步填充。

## 核心原则

1. **搬入 OpenCowork 完整前端框架**，不自己从头设计
2. **本次实现的**：会话/项目 CRUD、布局（NavRail + WorkspaceSidebar + TitleBar + 内容区）、ChatHomePage/ProjectHomePage、SessionConversationPane、对话流式、活动面板、动画、命令面板壳子、右侧面板壳子
3. **保留接口暂不实现的**：标注迭代归属，代码中留好接口和占位，后续迭代直接接入
4. **chat-store 拆分多文件**：按职责拆成 slices，用 Zustand combine 组合
5. **DB 持久化**：本次内存存储，但 store 结构预留 DB 接口（loadFromDb 等方法签名预留，内部用空实现），迭代五接入 SQLite
6. **所有 OpenCowork 功能入口保留**：NavRail 全部图标保留，点击暂未实现的页面显示"即将推出"占位

## 迭代归属标注

| 功能模块 | 本次 | 迭代四 | 迭代五 | 迭代六 | 迭代七 | 后续 |
|---------|------|--------|--------|--------|--------|------|
| 会话/项目 CRUD | ✅ 实现 | | | | | |
| 布局 + 动画 + 命令面板 | ✅ 实现 | | | | | |
| ChatHomePage / ProjectHomePage | ✅ 实现 | | | | | |
| SessionConversationPane | ✅ 实现 | | | | | |
| 对话流式 + 活动面板 | ✅ 实现 | | | | | |
| ModelSwitcher | ✅ 实现 | | | | | |
| DB 持久化 | 接口预留 | | ✅ 实现 | | | |
| 工具调用 UI | 接口预留 | ✅ 实现 | | | | |
| 右侧面板（完整功能） | 壳子+占位 | ✅ 填充 | | | | |
| 记忆面板 | 入口保留 | | | ✅ 实现 | | |
| 人格切换面板 | 入口保留 | | | | ✅ 实现 | |
| SSH | 入口保留 | | | | | ✅ |
| CodeGraph | 入口保留 | | | | | ✅ |
| Skills 页面 | 入口保留 | | | | | ✅ |
| Souls 页面 | 入口保留 | | | | ✅ 实现 | |
| Sync 页面 | 入口保留 | | | | | ✅ |
| Draw 页面 | 入口保留 | | | | | ✅ |
| Translate 页面 | 入口保留 | | | | | ✅ |
| Tasks 页面 | 入口保留 | | | | | ✅ |
| Terminal | 入口保留 | | | | | ✅ |
| Git 页面 | 入口保留 | | | | | ✅ |
| Plugin/Channel | 入口保留 | | | | | ✅ |
| 分离窗口 | 接口预留 | | | | | ✅ |
| 智能标题 (Smart Rename) | 首条消息截断 | | ✅ LLM | | | |

## 验证标准

1. 应用启动后进入 SplashPage → 进入主布局
2. NavRail 显示所有图标（chat/settings 等可点击，其余 tooltip 显示名称）
3. WorkspaceSidebar 显示 New Chat 按钮 + 项目分组会话列表
4. 点击 New Chat → ChatHomePage（欢迎语 + 输入框 + 快捷提示）
5. 输入消息发送 → 创建会话 → 流式回复 → 活动面板显示迭代进度
6. 创建项目（选择工作文件夹）→ ProjectHomePage → 输入消息 → 流式回复
7. 切换会话/项目 → 消息独立保留
8. 右键会话 → 菜单（重命名/删除/清除/置顶）
9. 右键项目 → 菜单（重命名/删除/置顶/修改文件夹）
10. 命令面板（Ctrl+P 或 Ctrl+Shift+P）打开，显示占位命令
11. 动画过渡正常（页面切换、侧边栏折叠）
12. `npm run typecheck` + `electron-vite build` 通过

## 步骤清单

- [x] 步骤1：安装依赖 + 搬入基础设施
  - 安装 `nanoid` `motion`（framer-motion 替代）
  - 新建 `src/renderer/src/components/layout/right-panel-defs.ts` — 从 OpenCowork 搬入（宽度常量 + clamp 函数）
  - 新建 `src/renderer/src/components/animate-ui/transitions.tsx` — 从 OpenCowork 搬入（PageTransition/PanelTransition/FadeIn/SlideIn 等），animationsEnabled 暂时硬编码 true
  - 新建 `src/renderer/src/components/error-boundary.tsx` — 简单 ErrorBoundary
  - 新建 `src/renderer/src/lib/utils/export-chat.ts` — 占位函数（导出 Markdown/JSON，迭代八完善）
  - 新建 `src/renderer/src/lib/session-window.ts` — 占位函数（openSessionOrFocusDetached，分离窗口后续实现）
  - 新建 `src/renderer/src/lib/chat-route.ts` — 占位（parseChatRoute/replaceChatRoute，内存路由）
  - 新建 `src/renderer/src/lib/settings-route.ts` — 占位
  - 验证：`npm run typecheck` 通过

- [x] 步骤2：重构 ui-store — 从 OpenCowork 搬入完整布局状态
  - 修改 `src/renderer/src/stores/ui-store.ts`
    - 从 OpenCowork 搬入完整 UIStore 接口和实现
    - 本次实现：mode/activeNavItem/leftSidebar(leftOpen/width/toggle)/rightPanel(open/toggle/width)/chatView/navigateTo*/settings(skills/souls/sync/resources/draw/translate/tasks/codeGraph page open/close)/shortcutsOpen/conversationGuideOpen
    - 接口预留但空实现：browser*/previewPanel*/detailPanel*/subAgentExecutionDetail*/orchestration*/autoModel*/bottomTerminalDock*/agentFiles*/selectedFiles/planMode
    - 保留现有 `view` (splash/main/settings) / `settingsTab` / `openSettings` / `closeSettings` / `enterMain`
    - 添加 `selectedProvider` + `setSelectedProvider`
    - AppMode 暂时只有 `'chat'`（后续迭代扩展）
    - ChatView：`'home' | 'project' | 'archive' | 'channels' | 'git' | 'session'`
    - syncSessionScopedState 简化实现（只记录 sessionId/projectId）
    - persist 中间件保留（用现有的 ipcStorage），但只持久化布局相关字段
    - 砍掉：路由 URL 同步（replaceChatRoute 改为空操作，内部状态驱动）
  - 参考：OpenCowork ui-store.ts 全文
  - 验证：`npm run typecheck` 通过

- [x] 步骤3：重构 chat-store — 拆分多文件 + 从 OpenCowork 搬入
  - 拆分为：
    - `src/renderer/src/stores/chat-store/types.ts` — Session/Project/SessionMode/CreateSessionOptions 等类型定义
    - `src/renderer/src/stores/chat-store/session-slice.ts` — Session CRUD（createSession/deleteSession/setActiveSession/updateSessionTitle/clearSessionMessages/togglePinSession/duplicateSession 等）
    - `src/renderer/src/stores/chat-store/project-slice.ts` — Project CRUD（createProject/deleteProject/renameProject/setActiveProject/setActiveProjectHome/togglePinProject/updateProjectDirectory/ensureDefaultProject）
    - `src/renderer/src/stores/chat-store/message-slice.ts` — Message 操作（addMessage/updateMessage/appendTextDelta/appendThinkingDelta/beginUserTurn/appendToolUse 等，本次实现核心几个，其余接口预留）
    - `src/renderer/src/stores/chat-store/streaming-slice.ts` — 流式状态（streamingMessageId/streamingMessages/setStreamingMessageId/generatingImage*）
    - `src/renderer/src/stores/chat-store/db-helpers.ts` — DB 持久化占位（dbCreateSession/dbDeleteSession/dbUpdateSession 等空函数，迭代五接入 SQLite）
    - `src/renderer/src/stores/chat-store/index.ts` — 组合所有 slices，导出 useChatStore
  - 从 OpenCowork chat-store.ts 搬入：
    - Session 接口（保留全部字段，未用的字段给默认值）
    - Project 接口（保留全部字段）
    - 所有 CRUD 方法签名和逻辑（去掉 DB 调用，改为内存操作 + db-helpers 空调用）
    - sortSessions/sortProjects/formatRelativeTime 等辅助函数
    - sessionsById 索引 + syncSessionsById
    - 砍掉：Team/Task/Plan/AgentStore/BackgroundSession 联动调用、agentStream 可见性通知、scheduleDeferredSessionMaintenance、immer（用原生 set）、UnifiedMessage 改用现有 ChatMessage
  - sendMessage/cancelStream/handleEnvelope 从现有 chat-store 保留，适配到 Session 结构
  - 验证：`npm run typecheck` 通过

- [x] 步骤4：创建 use-chat-actions hook — 从 OpenCowork 搬入（精简）
  - 新建 `src/renderer/src/hooks/use-chat-actions.ts`
    - 搬入 sendMessage/stopStreaming/abortSession 等核心 action
    - 适配到 wishful-claw 的 agent/run IPC（不是 OpenCowork 的 agentStream）
    - 砍掉：pendingSessionMessages/backgroundSession/imageAttachments 相关
  - 验证：`npm run typecheck` 通过

- [x] 步骤5：创建 WorkspaceSidebar — 从 OpenCowork 搬入（保留结构，精简实现）
  - 新建 `src/renderer/src/components/layout/WorkspaceSidebar.tsx`
    - 从 OpenCowork 搬入完整框架
    - 保留：导航图标栏 + New Chat 按钮 + 项目分组会话列表 + 侧边栏折叠 + 拖拽宽度
    - 保留：Project 分组（头部 + 会话列表）+ 无项目会话分组
    - 保留：右键菜单（Rename/Delete/Clear/Pin for Session, Rename/Delete/Pin/Change Folder for Project）
    - 保留：sortProjects/sortSessions/formatRelativeTime
    - 保留：WorkingFolderSelectorDialog 调用
    - 保留：拖拽文件夹到侧边栏创建项目（接口预留，本次实现本地文件夹）
    - 暂不实现：SSH 连接选择、搜索框、导入导出、排序下拉菜单、Smart Rename
    - 目标 ~800行（OpenCowork 2371行，保留约 1/3）
  - 验证：`npm run typecheck` 通过

- [x] 步骤6：创建 TitleBar + 其他 layout 组件
  - 新建 `src/renderer/src/components/layout/TitleBar.tsx` — 从 OpenCowork 搬入（标题 + 侧边栏切换 + mode 切换 + WindowControls）
  - 新建 `src/renderer/src/components/layout/CommandPalette.tsx` — 从 OpenCowork 搬入壳子，命令列表精简（New Chat/Settings/Switch Theme 等基本命令）
  - 新建 `src/renderer/src/components/layout/RightPanel.tsx` — 壳子，显示占位内容
  - 新建 `src/renderer/src/components/layout/RightPanelHeader.tsx` — 壳子
  - 新建 `src/renderer/src/components/layout/SessionConversationPane.tsx` — 从 OpenCowork 搬入（会话内容区，MessageList + InputArea + 顶部操作栏）
  - 新建 `src/renderer/src/components/layout/RuntimeStatusPanel.tsx` — 占位
  - 验证：`npm run typecheck` 通过

- [x] 步骤7：创建 ChatHomePage + ProjectHomePage + WorkingFolderSelectorDialog
  - 新建 `src/renderer/src/components/chat/ChatHomePage.tsx` — 从 OpenCowork 搬入（欢迎语 + InputArea + 快捷提示 + NewSessionProjectSelector）
  - 新建 `src/renderer/src/components/chat/ProjectHomePage.tsx` — 从 OpenCowork 搬入（项目信息 + InputArea + 工作文件夹）
  - 新建 `src/renderer/src/components/chat/WorkingFolderSelectorDialog.tsx` — 从 OpenCowork 搬入（本地文件夹选择，SSH 部分保留入口但禁用）
  - 新建 `src/renderer/src/components/chat/NewSessionProjectSelector.tsx` — 项目选择器
  - 验证：`npm run typecheck` 通过

- [x] 步骤8：重构 MainLayout + App.tsx
  - 重构 `src/renderer/src/components/layout/MainLayout.tsx` → 从 OpenCowork Layout.tsx 搬入
    - WorkspaceSidebar + TitleBar + 内容区路由（ChatHomePage/ProjectHomePage/SessionConversationPane/RightPanel）
    - 各功能页面（Skills/Souls/Sync/Draw/Translate/Tasks/CodeGraph）显示占位组件
    - CommandPalette + 动画
  - 修改 `src/renderer/src/App.tsx` — 移除独立 chat 视图，AppView 改为 splash/main/settings
  - 修改 `src/preload/index.d.ts` — 移除 `__selectedProvider` / `__sessionId`
  - 添加 IPC：`dialog:openFolder` — Main 进程打开文件夹选择对话框
  - 修改 `src/main/index.ts` — 注册 dialog IPC handler
  - 修改 `src/preload/index.ts` — 暴露 openFolderDialog
  - 验证：`npm run typecheck` + `electron-vite build` 通过

- [x] 步骤9：适配已有组件
  - 修改 `src/renderer/src/components/chat/ChatPage.tsx` — 合并到 SessionConversationPane 或适配
  - 修改 `src/renderer/src/components/chat/InputArea.tsx` — 从 ui-store 读 selectedProvider，适配 ChatHomePage/SessionConversationPane 两种场景
  - 修改 `src/renderer/src/components/chat/MessageList.tsx` — 从 chat-store 读活跃会话 messages
  - 修改 `src/renderer/src/components/chat/AssistantMessage.tsx` — 适配新的 message 结构
  - 修改 `src/renderer/src/components/chat/ModelSwitcher.tsx` — 存到 ui-store
  - 修改 `src/renderer/src/components/SplashPage.tsx` — enterMain 进入主布局
  - 补充 `src/renderer/src/locales/en/layout.json` + `zh/layout.json` — 从 OpenCowork 搬入需要的 key
  - 新建 `src/renderer/src/locales/en/chat.json` + `zh/chat.json` — 从 OpenCowork 搬入
  - 验证：`npm run typecheck` + `electron-vite build` 通过

- [ ] 步骤10：集成验证
  - 启动应用 → SplashPage → 主布局
  - NavRail 图标 + WorkspaceSidebar + New Chat
  - 新建会话 → ChatHomePage → 发消息 → 流式回复 → 活动面板
  - 创建项目 → 选择文件夹 → ProjectHomePage → 发消息
  - 切换会话/项目 → 消息独立保留
  - 右键菜单（会话/项目）
  - 命令面板打开
  - 动画过渡正常
  - 产出验证报告

## 涉及文件

### 新建
- `src/renderer/src/stores/chat-store/types.ts`
- `src/renderer/src/stores/chat-store/session-slice.ts`
- `src/renderer/src/stores/chat-store/project-slice.ts`
- `src/renderer/src/stores/chat-store/message-slice.ts`
- `src/renderer/src/stores/chat-store/streaming-slice.ts`
- `src/renderer/src/stores/chat-store/db-helpers.ts`
- `src/renderer/src/stores/chat-store/index.ts`
- `src/renderer/src/hooks/use-chat-actions.ts`
- `src/renderer/src/components/layout/WorkspaceSidebar.tsx`
- `src/renderer/src/components/layout/TitleBar.tsx`
- `src/renderer/src/components/layout/CommandPalette.tsx`
- `src/renderer/src/components/layout/RightPanel.tsx`
- `src/renderer/src/components/layout/RightPanelHeader.tsx`
- `src/renderer/src/components/layout/SessionConversationPane.tsx`
- `src/renderer/src/components/layout/RuntimeStatusPanel.tsx`
- `src/renderer/src/components/layout/right-panel-defs.ts`
- `src/renderer/src/components/animate-ui/transitions.tsx`
- `src/renderer/src/components/error-boundary.tsx`
- `src/renderer/src/components/chat/ChatHomePage.tsx`
- `src/renderer/src/components/chat/ProjectHomePage.tsx`
- `src/renderer/src/components/chat/WorkingFolderSelectorDialog.tsx`
- `src/renderer/src/components/chat/NewSessionProjectSelector.tsx`
- `src/renderer/src/lib/utils/export-chat.ts`
- `src/renderer/src/lib/session-window.ts`
- `src/renderer/src/lib/chat-route.ts`
- `src/renderer/src/lib/settings-route.ts`
- `src/renderer/src/locales/en/chat.json`
- `src/renderer/src/locales/zh/chat.json`

### 修改
- `src/renderer/src/stores/ui-store.ts`
- `src/renderer/src/stores/chat-store.ts` → 改为 re-export from chat-store/
- `src/renderer/src/components/layout/MainLayout.tsx`
- `src/renderer/src/components/chat/ChatPage.tsx`
- `src/renderer/src/components/chat/InputArea.tsx`
- `src/renderer/src/components/chat/MessageList.tsx`
- `src/renderer/src/components/chat/AssistantMessage.tsx`
- `src/renderer/src/components/chat/ModelSwitcher.tsx`
- `src/renderer/src/components/SplashPage.tsx`
- `src/renderer/src/App.tsx`
- `src/renderer/src/locales/en/layout.json`
- `src/renderer/src/locales/zh/layout.json`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/main/index.ts`
- `package.json`

## 参考源码

### OpenCowork（直接搬入，保留结构精简实现）
- `D:\gy\OpenCowork\src\renderer\src\stores\ui-store.ts` — 完整布局状态（2237行）
- `D:\gy\OpenCowork\src\renderer\src\stores\chat-store.ts` — Session+Project CRUD（5409行，拆分搬入）
- `D:\gy\OpenCowork\src\renderer\src\hooks\use-chat-actions.ts` — 聊天 action（7438行，精简搬入核心）
- `D:\gy\OpenCowork\src\renderer\src\components\layout\Layout.tsx` — 主布局（972行）
- `D:\gy\OpenCowork\src\renderer\src\components\layout\WorkspaceSidebar.tsx` — 侧边栏（2371行）
- `D:\gy\OpenCowork\src\renderer\src\components\layout\TitleBar.tsx` — 标题栏（506行）
- `D:\gy\OpenCowork\src\renderer\src\components\layout\CommandPalette.tsx` — 命令面板（418行）
- `D:\gy\OpenCowork\src\renderer\src\components\layout\RightPanel.tsx` — 右侧面板（488行）
- `D:\gy\OpenCowork\src\renderer\src\components\layout\SessionConversationPane.tsx` — 会话内容区（646行）
- `D:\gy\OpenCowork\src\renderer\src\components\layout\right-panel-defs.ts` — 宽度常量
- `D:\gy\OpenCowork\src\renderer\src\components\animate-ui\transitions.tsx` — 动画组件
- `D:\gy\OpenCowork\src\renderer\src\components\chat\ChatHomePage.tsx` — 新对话首页（361行）
- `D:\gy\OpenCowork\src\renderer\src\components\chat\ProjectHomePage.tsx` — 项目首页（172行）
- `D:\gy\OpenCowork\src\renderer\src\components\chat\WorkingFolderSelectorDialog.tsx` — 文件夹选择
- `D:\gy\OpenCowork\src\renderer\src\components\chat\NewSessionProjectSelector.tsx` — 项目选择器
- `D:\gy\OpenCowork\src\renderer\src\locales\en\layout.json` + `chat.json` — i18n
- `D:\gy\OpenCowork\src\renderer\src\locales\zh\layout.json` + `chat.json` — i18n
