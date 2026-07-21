# Plan: 迭代三修复 — 会话管理 + 主布局（基于 OpenCowork 做减法）

## 目标

直接搬 OpenCowork 的布局和会话管理结构，做减法砍掉不需要的功能。让迭代三的 Agent Loop 对话功能实际可用：用户能新建会话/项目、在多个会话间切换、每个会话独立保持消息历史。

## 验证标准

1. 应用启动后进入主布局，左侧 WorkspaceSidebar 显示导航 + "New Chat" 按钮 + 项目分组会话列表
2. 点击"New Chat"创建新会话，进入 ChatHomePage（空白对话首页）
3. 能创建项目（指定工作文件夹），项目下可以创建会话
4. 输入消息发送，流式看到模型回复
5. 在多个会话/项目间切换，各自消息独立保留
6. 可以删除会话/项目（右键菜单）
7. ModelSwitcher 选择模型后，状态保持在 store 中
8. 活动面板正常工作
9. `npm run typecheck` + `electron-vite build` 通过

## 减法清单

### 从 OpenCowork 搬入（保留）
- Layout 三栏结构：WorkspaceSidebar + TitleBar + 内容区
- WorkspaceSidebar 主体：导航图标栏 + 会话列表（按 Project 分组）+ New Chat 按钮 + 侧边栏折叠 + 拖拽宽度
- chat-store：Session + Project 概念和完整 CRUD（createSession/deleteSession/setActiveSession/updateSessionTitle/createProject/deleteProject/renameProject/setActiveProject/togglePinProject/updateProjectDirectory）
- ui-store：布局状态（leftSidebarOpen/leftSidebarWidth/chatView/navigateToHome/navigateToSession/navigateToProject）
- ChatHomePage：无项目的新对话首页
- ProjectHomePage：项目首页（含工作文件夹显示 + 选择）
- WorkingFolderSelectorDialog：选择本地工作文件夹（砍 SSH 部分）
- 会话列表项：标题 + 相对时间 + 右键菜单（删除/重命名/置顶）
- TitleBar：标题栏 + 侧边栏切换 + WindowControls
- nanoid 生成 ID
- sortSessions / sortProjects（pinned 优先 + updatedAt 降序）
- formatRelativeTime（相对时间显示）

### 砍掉（不做）
- SSH 连接（WorkingFolderSelectorDialog 只保留本地文件夹选择）
- 会话搜索
- 导出/导入/备份
- SessionMode（clarify/cowork/code/acp），只保留 chat
- Plugin/Channel/外部聊天
- DB 持久化（内存存储，迭代五加 SQLite）
- Smart Rename（LLM 生成标题），用首条消息截断做标题
- Team/Task/Plan/BackgroundSession/AgentStore 联动
- 命令面板/快捷键对话框/权限对话框
- 动画过渡（PageTransition/PanelTransition/AnimatePresence）
- 分离窗口（DetachedSession）
- 拖拽文件夹到侧边栏
- 右侧面板（RightPanel/SubAgentExecutionDetail）
- Git 页面/归档页面/频道页面
- CodeGraph/Skills/Souls/Sync/Draw/Translate/Tasks 等页面
- confirm-dialog 组件（用已有的 AlertDialog 替代）
- ipcClient / IPC channels（用已有的 workerRequest）
- immer middleware（用原生 set）
- persist middleware（不持久化，迭代五加）
- chat-route 路由同步

## 步骤清单

- [ ] 步骤1：重构 ui-store — 从 OpenCowork 搬布局状态（做减法）
  - 修改 `src/renderer/src/stores/ui-store.ts`
    - 搬入：`activeNavItem` / `leftSidebarOpen` / `leftSidebarWidth` / `toggleLeftSidebar` / `setLeftSidebarOpen` / `setLeftSidebarWidth` / `chatView` / `navigateToHome` / `navigateToSession` / `navigateToProject`
    - 保留现有 `view` (splash/main/settings) / `settingsTab` / `openSettings` / `closeSettings`
    - 添加 `selectedProvider` + `setSelectedProvider`
    - ChatView：`'home' | 'project' | 'session'`（砍 archive/channels/git）
    - 砍掉：AppMode/persist/路由/RightPanel/各种页面开关/syncSessionScopedState
  - 参考：OpenCowork ui-store.ts 第 318-330 行、第 955-975 行、第 2051-2090 行
  - 验证：`npm run typecheck` 通过

- [ ] 步骤2：重构 chat-store — 从 OpenCowork 搬 Session + Project（做减法）
  - 修改 `src/renderer/src/stores/chat-store.ts`
    - 搬入 Session 接口（精简：id/title/messages/messageCount/createdAt/updatedAt/pinned/projectId）
    - 搬入 Project 接口（id/name/createdAt/updatedAt/workingFolder/pinned/sessionCount）
    - 搬入 Session CRUD：createSession / deleteSession / setActiveSession / updateSessionTitle / clearSessionMessages / togglePinSession
    - 搬入 Project CRUD：createProject / deleteProject / renameProject / setActiveProject / setActiveProjectHome / togglePinProject / updateProjectDirectory / ensureDefaultProject
    - 搬入 sessions / projects / activeSessionId / activeProjectId / streamingMessages / streamingMessageId
    - 搬入 sortSessions / sortProjects / formatRelativeTime
    - 保留现有 sendMessage / cancelStream / handleEnvelope，适配到 Session 结构
    - 砍掉：DB 持久化/SessionMode/modelSelectionMode/pluginId/sshConnectionId/promptSnapshot/immer/Team/Task/Plan/AgentStore 联动/agentStream 可见性通知/scheduleDeferredSessionMaintenance
    - createSession 生成标题：首条消息前 30 字符截断，或默认"New Conversation"
  - 参考：OpenCowork chat-store.ts 第 85-130 行、第 2567-2870 行、第 3565-3780 行、第 3971-4000 行、第 4294-4330 行
  - 验证：`npm run typecheck` 通过

- [ ] 步骤3：创建 WorkspaceSidebar — 从 OpenCowork 搬入（大幅减法）
  - 新建 `src/renderer/src/components/layout/WorkspaceSidebar.tsx`
    - 搬入主体框架：导航图标栏（chat + settings）+ New Chat 按钮 + 项目分组会话列表 + 侧边栏折叠 + 拖拽宽度
    - 按 Project 分组显示会话，无项目的会话归到"Chat"分组
    - 会话列表项：图标 + 标题 + 相对时间 + 右键菜单（Rename/Delete/Clear/Pin）
    - Project 分组头部：项目名 + 工作文件夹 + 右键菜单（Rename/Delete/Pin/Change Folder）
    - 当前活跃会话/项目高亮
    - 砍掉：SSH/搜索框/导入导出/排序下拉/拖拽文件夹/插件会话/模式图标/频道/命令面板
    - 保留 context-menu 和 dropdown-menu（已有组件）
  - 参考：OpenCowork WorkspaceSidebar.tsx 全文（2371行 → 目标 ~500行）
  - 验证：`npm run typecheck` 通过

- [ ] 步骤4：创建 TitleBar + WorkingFolderSelectorDialog
  - 新建 `src/renderer/src/components/layout/TitleBar.tsx`
    - 搬入：标题栏 + 侧边栏切换按钮 + WindowControls
    - 显示当前会话标题或"New Chat"或项目名
    - 砍掉：mode 切换/updateInfo/同步状态
  - 新建 `src/renderer/src/components/chat/WorkingFolderSelectorDialog.tsx`
    - 搬入：本地文件夹选择对话框
    - 砍掉：SSH 连接选择部分
    - 使用 Electron dialog.showOpenDialog 选择文件夹（通过 IPC）
  - 参考：OpenCowork TitleBar.tsx / WorkingFolderSelectorDialog.tsx
  - 验证：`npm run typecheck` 通过

- [ ] 步骤5：重构 MainLayout — 从 OpenCowork Layout 搬入（精简）
  - 修改 `src/renderer/src/components/layout/MainLayout.tsx`
    - 搬入主体结构：WorkspaceSidebar（可折叠）+ TitleBar + 内容区
    - 内容区路由：chatView 'home' → ChatHomePage，'project' → ProjectHomePage，'session' → ChatPage
    - 砍掉：AnimatePresence/PageTransition/各种页面路由(skills等)/SettingsPage全屏/ErrorBoundary/CommandPalette
  - 参考：OpenCowork Layout.tsx 第 710-930 行
  - 验证：`npm run typecheck` + `electron-vite build` 通过

- [ ] 步骤6：创建 ChatHomePage + ProjectHomePage — 从 OpenCowork 搬入（精简）
  - 新建 `src/renderer/src/components/chat/ChatHomePage.tsx`
    - 搬入：居中欢迎语 + InputArea + 快捷提示
    - 发送消息时：createSession → navigateToSession → sendMessage
    - 砍掉：项目选择器/终端/WorkingFolderSelectorDialog
  - 新建 `src/renderer/src/components/chat/ProjectHomePage.tsx`
    - 搬入：项目欢迎页 + 工作文件夹显示 + InputArea + 修改文件夹按钮
    - 发送消息时：createSession(projectId) → navigateToSession → sendMessage
    - 砍掉：SSH/终端/WorkingFolderSelectorDialog 的 SSH 部分
  - 参考：OpenCowork ChatHomePage.tsx / ProjectHomePage.tsx
  - 验证：`npm run typecheck` 通过

- [ ] 步骤7：适配已有组件
  - 修改 `src/renderer/src/components/chat/ChatPage.tsx` — 适配为会话内容区，从 chat-store 读取活跃会话 messages
  - 修改 `src/renderer/src/components/chat/InputArea.tsx` — 从 ui-store 读 selectedProvider，传递 sessionId
  - 修改 `src/renderer/src/components/chat/MessageList.tsx` — 从 chat-store 读活跃会话 messages
  - 修改 `src/renderer/src/components/chat/ModelSwitcher.tsx` — 存到 ui-store
  - 修改 `src/renderer/src/App.tsx` — 移除 `view === 'chat'`，AppView 改为 splash/main/settings
  - 修改 `src/preload/index.d.ts` — 移除 `__selectedProvider` / `__sessionId`
  - 添加 IPC：`dialog:openFolder` — Main 进程打开文件夹选择对话框
  - 修改 `src/main/index.ts` — 注册 dialog IPC handler
  - 修改 `src/preload/index.ts` — 暴露 openFolderDialog 方法
  - 验证：`npm run typecheck` + `electron-vite build` 通过

- [ ] 步骤8：集成验证
  - 启动应用 → WorkspaceSidebar + New Chat + 项目列表
  - 新建会话 → ChatHomePage → 输入消息 → 流式回复
  - 创建项目 → 选择工作文件夹 → ProjectHomePage → 输入消息 → 流式回复
  - 切换会话/项目 → 消息独立保留
  - 右键删除会话/项目
  - 活动面板正常
  - 产出验证报告

## 涉及文件

### 新建
- `src/renderer/src/components/layout/WorkspaceSidebar.tsx`
- `src/renderer/src/components/layout/TitleBar.tsx`
- `src/renderer/src/components/chat/ChatHomePage.tsx`
- `src/renderer/src/components/chat/ProjectHomePage.tsx`
- `src/renderer/src/components/chat/WorkingFolderSelectorDialog.tsx`

### 修改
- `src/renderer/src/stores/ui-store.ts`
- `src/renderer/src/stores/chat-store.ts`
- `src/renderer/src/components/layout/MainLayout.tsx`
- `src/renderer/src/components/chat/ChatPage.tsx`
- `src/renderer/src/components/chat/InputArea.tsx`
- `src/renderer/src/components/chat/MessageList.tsx`
- `src/renderer/src/components/chat/ModelSwitcher.tsx`
- `src/renderer/src/App.tsx`
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/main/index.ts`

## 参考源码

### OpenCowork（直接搬入做减法）
- `D:\gy\OpenCowork\src\renderer\src\components\layout\Layout.tsx` — 主布局结构（第 710-930 行）
- `D:\gy\OpenCowork\src\renderer\src\components\layout\WorkspaceSidebar.tsx` — 侧边栏（2371行 → ~500行）
- `D:\gy\OpenCowork\src\renderer\src\components\layout\TitleBar.tsx` — 标题栏
- `D:\gy\OpenCowork\src\renderer\src\components\chat\ChatHomePage.tsx` — 无项目新对话首页
- `D:\gy\OpenCowork\src\renderer\src\components\chat\ProjectHomePage.tsx` — 项目首页
- `D:\gy\OpenCowork\src\renderer\src\components\chat\WorkingFolderSelectorDialog.tsx` — 文件夹选择（砍 SSH）
- `D:\gy\OpenCowork\src\renderer\src\stores\chat-store.ts` — Session + Project CRUD
- `D:\gy\OpenCowork\src\renderer\src\stores\ui-store.ts` — 布局状态
