# Plan: 迭代三修复 — 会话管理 + 主布局（基于 OpenCowork 做减法）

## 目标

直接搬 OpenCowork 的布局和会话管理结构，做减法砍掉不需要的功能。让迭代三的 Agent Loop 对话功能实际可用：用户能新建会话、在多个会话间切换、每个会话独立保持消息历史。

## 验证标准

1. 应用启动后进入主布局，左侧 WorkspaceSidebar 显示导航图标 + "New Chat" 按钮 + 会话列表
2. 点击"New Chat"创建新会话，进入 ChatHomePage（空白对话首页）
3. 输入消息发送，流式看到模型回复
4. 再点"New Chat"创建第二个会话，切换回第一个会话能看到之前的消息
5. 可以删除会话（右键菜单）
6. ModelSwitcher 选择模型后，状态保持在 store 中
7. 活动面板正常工作
8. `npm run typecheck` + `electron-vite build` 通过

## 减法清单

### 从 OpenCowork 搬入（保留）
- Layout 三栏结构：WorkspaceSidebar + TitleBar + 内容区
- WorkspaceSidebar 主体框架：导航图标栏 + 会话列表 + New Chat 按钮 + 侧边栏折叠
- chat-store 的 Session 概念和 CRUD（createSession/deleteSession/setActiveSession/updateSessionTitle）
- ui-store 的布局状态（leftSidebarOpen/leftSidebarWidth/chatView/navigateToHome/navigateToSession）
- ChatHomePage 作为新建会话首页
- 会话列表项：标题 + 相对时间 + 右键菜单（删除/重命名）
- 侧边栏拖拽调整宽度

### 砍掉（不做）
- Project 概念（迭代五再做）
- SSH 连接
- 会话搜索
- 置顶/导出/导入/备份
- SessionMode（clarify/cowork/code/acp），只保留 chat
- Plugin/Channel/外部聊天
- DB 持久化（内存存储，迭代五加 SQLite）
- Smart Rename（LLM 生成标题），用首条消息截断做标题
- Team/Task/Plan/BackgroundSession/AgentStore 联动
- 命令面板/快捷键对话框/权限对话框
- 动画过渡（PageTransition/PanelTransition/AnimatePresence）
- 分离窗口（DetachedSession）
- 拖拽文件夹
- 右侧面板（RightPanel/SubAgentExecutionDetail）
- Git 页面/归档页面/频道页面
- CodeGraph/Skills/Souls/Sync/Draw/Translate/Tasks 等页面

## 步骤清单

- [ ] 步骤1：重构 ui-store — 从 OpenCowork 搬布局状态（做减法）
  - 修改 `src/renderer/src/stores/ui-store.ts`
    - 从 OpenCowork ui-store 搬入：`activeNavItem` / `leftSidebarOpen` / `leftSidebarWidth` / `toggleLeftSidebar` / `setLeftSidebarOpen` / `setLeftSidebarWidth` / `chatView` / `navigateToHome` / `navigateToSession`
    - 保留现有的 `view` (splash/main/settings) / `settingsTab` / `openSettings` / `closeSettings`
    - 添加 `selectedProvider` + `setSelectedProvider`（从 ModelSwitcher 的 window.__ 迁移到 store）
    - ChatView 类型：`'home' | 'session'`（砍掉 project/archive/channels/git）
    - 砍掉：mode/AppMode/RightPanel/所有页面开关(skillsPageOpen等)/persist/路由
  - 参考：OpenCowork ui-store.ts 第 318-330 行（布局字段）、第 955-975 行（初始值）、第 2051-2090 行（navigate 方法）
  - 验证：`npm run typecheck` 通过

- [ ] 步骤2：重构 chat-store — 从 OpenCowork 搬 Session 概念（做减法）
  - 修改 `src/renderer/src/stores/chat-store.ts`
    - 从 OpenCowork chat-store 搬入 Session 接口（精简版：id/title/messages/messageCount/createdAt/updatedAt/pinned）
    - 搬入 createSession / deleteSession / setActiveSession / updateSessionTitle / clearSessionMessages / togglePinSession
    - 搬入 sessions 数组 + activeSessionId
    - 搬入 streamingMessages 映射 + streamingMessageId
    - 保留现有的 sendMessage / cancelStream / handleEnvelope，适配到 Session 结构
    - 砍掉：Project/DB 持久化/SessionMode/modelSelectionMode/pluginId/sshConnectionId/workingFolder/promptSnapshot/immer middleware（用原生 set）
    - 搬入 nanoid 生成 sessionId
    - 搬入 sortSessions（pinned 优先 + updatedAt 降序）
    - 搬入 formatRelativeTime（相对时间显示）
    - 适配 handleEnvelope：按 runId 找到对应 session，写入该 session 的 messages
  - 参考：OpenCowork chat-store.ts 第 85-130 行（Session 接口）、第 3565-3780 行（createSession/deleteSession/setActiveSession/updateSessionTitle）、第 3971-4000 行（togglePinSession）、第 4294-4330 行（clearSessionMessages）
  - 验证：`npm run typecheck` 通过

- [ ] 步骤3：创建 WorkspaceSidebar — 从 OpenCowork 搬入（大幅减法）
  - 新建 `src/renderer/src/components/layout/WorkspaceSidebar.tsx`
    - 从 OpenCowork WorkspaceSidebar.tsx 搬入主体框架
    - 保留：导航图标栏（chat + settings 两个）+ New Chat 按钮 + 会话列表 + 侧边栏折叠按钮 + 拖拽调整宽度
    - 会话列表项：图标 + 标题 + 相对时间 + 右键菜单（Rename/Delete/Clear/Pin）
    - 当前活跃会话高亮
    - 砍掉：Project 分组/SSH/搜索框/导入导出/排序下拉/拖拽文件夹/插件会话/模式图标/频道/命令面板
    - 保留 context-menu（已有组件）和 dropdown-menu（已有组件）
  - 参考：OpenCowork WorkspaceSidebar.tsx 全文（2371行 → 目标 ~400行）
  - 验证：`npm run typecheck` 通过

- [ ] 步骤4：创建 TitleBar — 从 OpenCowork 搬入（精简）
  - 新建 `src/renderer/src/components/layout/TitleBar.tsx`
    - 从 OpenCowork TitleBar 搬入：标题栏 + 侧边栏切换按钮 + WindowControls
    - 显示当前会话标题或"New Chat"
    - 砍掉：mode 切换/updateInfo/同步状态/快捷键提示
  - 参考：OpenCowork TitleBar.tsx
  - 验证：`npm run typecheck` 通过

- [ ] 步骤5：重构 MainLayout — 从 OpenCowork Layout 搬入（精简）
  - 修改 `src/renderer/src/components/layout/MainLayout.tsx`
    - 从 OpenCowork Layout.tsx 搬入主体结构
    - 布局：WorkspaceSidebar（可折叠）+ TitleBar + 内容区
    - 内容区：chatView === 'home' → ChatHomePage，chatView === 'session' → ChatPage（已有的聊天+活动面板）
    - 砍掉：AnimatePresence/PageTransition/各种页面路由(skills/souls/sync等)/SettingsPage全屏/ErrorBoundary/CommandPalette
  - 参考：OpenCowork Layout.tsx 第 710-930 行
  - 验证：`npm run typecheck` + `electron-vite build` 通过

- [ ] 步骤6：创建 ChatHomePage — 从 OpenCowork 搬入（精简）
  - 新建 `src/renderer/src/components/chat/ChatHomePage.tsx`
    - 从 OpenCowork ChatHomePage.tsx 搬入：居中欢迎语 + InputArea + 快捷提示
    - 发送消息时：createSession → navigateToSession → sendMessage
    - 砍掉：项目选择器/工作文件夹/SSH/终端/WorkingFolderSelectorDialog
    - 复用已有的 InputArea 组件（适配 props）
  - 参考：OpenCowork ChatHomePage.tsx
  - 验证：`npm run typecheck` 通过

- [ ] 步骤7：适配已有组件
  - 修改 `src/renderer/src/components/chat/ChatPage.tsx`
    - 适配为 SessionConversationPane 角色：接收 sessionId，从 chat-store 读取对应会话的 messages
    - 移除外层全屏包裹
  - 修改 `src/renderer/src/components/chat/InputArea.tsx`
    - 从 ui-store 读取 selectedProvider（不再用 window.__）
    - sendMessage 时传递 sessionId（从 chat-store.activeSessionId）
    - 适配 ChatHomePage 和 SessionConversationPane 两种使用场景
  - 修改 `src/renderer/src/components/chat/MessageList.tsx`
    - 从 chat-store 读取当前活跃会话的 messages
  - 修改 `src/renderer/src/components/chat/ModelSwitcher.tsx`
    - 选中 provider 存到 ui-store.selectedProvider
  - 修改 `src/renderer/src/App.tsx`
    - 移除 `view === 'chat'` 分支
    - AppView 改为 `splash | main | settings`
  - 修改 `src/preload/index.d.ts`
    - 移除 `__selectedProvider` 和 `__sessionId` 全局声明
  - 验证：`npm run typecheck` + `electron-vite build` 通过

- [ ] 步骤8：集成验证
  - 启动应用 → 看到 WorkspaceSidebar + New Chat 按钮
  - 新建会话 → ChatHomePage → 输入消息 → 流式回复
  - 新建第二个会话 → 切换回第一个 → 消息保留
  - 右键删除会话
  - 活动面板正常
  - 产出验证报告

## 涉及文件

### 新建
- `src/renderer/src/components/layout/WorkspaceSidebar.tsx` — 从 OpenCowork 搬入做减法
- `src/renderer/src/components/layout/TitleBar.tsx` — 从 OpenCowork 搬入做减法
- `src/renderer/src/components/chat/ChatHomePage.tsx` — 从 OpenCowork 搬入做减法

### 修改
- `src/renderer/src/stores/ui-store.ts` — 搬入布局状态
- `src/renderer/src/stores/chat-store.ts` — 搬入 Session CRUD
- `src/renderer/src/components/layout/MainLayout.tsx` — 三栏布局
- `src/renderer/src/components/chat/ChatPage.tsx` — 适配为会话内容区
- `src/renderer/src/components/chat/InputArea.tsx` — 从 store 读 provider
- `src/renderer/src/components/chat/MessageList.tsx` — 从 store 读会话消息
- `src/renderer/src/components/chat/ModelSwitcher.tsx` — 存到 store
- `src/renderer/src/App.tsx` — 移除 chat 独立视图
- `src/preload/index.d.ts` — 移除 window.__ 全局声明

## 参考源码

### OpenCowork（直接搬入做减法）
- `D:\gy\OpenCowork\src\renderer\src\components\layout\Layout.tsx` — 主布局结构（第 710-930 行）
- `D:\gy\OpenCowork\src\renderer\src\components\layout\WorkspaceSidebar.tsx` — 侧边栏（全文 2371 行 → 精简到 ~400 行）
- `D:\gy\OpenCowork\src\renderer\src\components\layout\TitleBar.tsx` — 标题栏
- `D:\gy\OpenCowork\src\renderer\src\components\chat\ChatHomePage.tsx` — 新对话首页
- `D:\gy\OpenCowork\src\renderer\src\stores\chat-store.ts` — Session 接口和 CRUD（第 85-130, 3565-3780, 3971-4000, 4294-4330 行）
- `D:\gy\OpenCowork\src\renderer\src\stores\ui-store.ts` — 布局状态（第 318-330, 955-975, 2051-2090 行）
