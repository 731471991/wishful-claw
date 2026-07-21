# Plan: 迭代三修复 — 会话管理 + 主布局

## 目标

让迭代三的 Agent Loop 对话功能实际可用：用户能新建会话、在多个会话间切换、每个会话独立保持消息历史，从主布局直接进入对话。

## 验证标准

1. 应用启动后进入主布局，左侧 NavRail 的聊天图标可点击
2. 点击聊天图标后，Sidebar 显示"New Chat"按钮 + 会话列表
3. 点击"New Chat"创建新会话，进入空白对话页面
4. 输入消息发送，流式看到模型回复
5. 再点"New Chat"创建第二个会话，切换回第一个会话能看到之前的消息
6. 可以删除会话
7. ModelSwitcher 选择模型后，状态保持在 store 中，不依赖 window 全局变量
8. 活动面板正常工作（迭代进度显示）
9. `npm run typecheck` + `electron-vite build` 通过

## 步骤清单

- [ ] 步骤1：重构 ui-store — 添加布局状态管理
  - 修改 `src/renderer/src/stores/ui-store.ts`
    - 添加 `activeSessionId: string | null`
    - 添加 `sidebarOpen: boolean` + `toggleSidebar`
    - 添加 `selectedProvider: Record<string, unknown> | null` + `setSelectedProvider`
    - 移除 `enterChat`（chat 不再是独立视图，集成到 MainLayout）
    - AppView 简化为 `splash | main | settings`
  - 验证：`npm run typecheck` 通过

- [ ] 步骤2：重构 chat-store — 添加会话管理
  - 修改 `src/renderer/src/stores/chat-store.ts`
    - 新增 `Session` 接口：`{ id, title, messages: ChatMessage[], createdAt, updatedAt }`
    - 新增 `sessions: Session[]` 和 `activeSessionId: string | null`
    - 新增 `createSession()` — 生成 nanoid，返回 sessionId
    - 新增 `deleteSession(id)` — 删除会话
    - 新增 `selectSession(id)` — 切换活跃会话
    - 新增 `getActiveMessages()` — 获取当前会话的消息
    - 修改 `sendMessage` — 向当前活跃会话追加消息
    - 修改 `handleEnvelope` — 按 runId 匹配但写入对应 session 的 messages
    - 保留 `currentRunId` 和 `isStreaming`
  - 验证：`npm run typecheck` 通过

- [ ] 步骤3：创建 Sidebar 组件 — 会话列表
  - 新建 `src/renderer/src/components/layout/Sidebar.tsx`
    - 顶部：标题 + "New Chat" 按钮
    - 中部：会话列表（可滚动），每项显示标题 + 时间 + 删除按钮
    - 当前活跃会话高亮
    - 点击会话项切换活跃会话
  - 参考：OpenCowork SessionListPanel（精简到 ~150 行）
  - 验证：`npm run typecheck` 通过

- [ ] 步骤4：重构 NavRail — 聊天图标可点击
  - 修改 `src/renderer/src/components/layout/MainLayout.tsx` 中的 NavRail
    - 聊天图标点击后设置 activeNav='chat' 并打开 sidebar
    - 添加 activeNav 状态到 ui-store
  - 验证：`npm run typecheck` 通过

- [ ] 步骤5：重构 MainLayout — 三栏布局
  - 修改 `src/renderer/src/components/layout/MainLayout.tsx`
    - 布局：NavRail + Sidebar + 主内容区
    - 主内容区：当 activeNav='chat' 时显示 ChatPage，否则显示占位
    - ChatPage 集成到主内容区（不再独立全屏）
  - 验证：`npm run typecheck` + `electron-vite build` 通过

- [ ] 步骤6：适配 ChatPage + InputArea + MessageList
  - 修改 `src/renderer/src/components/chat/ChatPage.tsx`
    - 移除外层全屏包裹，适应 flex-1 布局
  - 修改 `src/renderer/src/components/chat/InputArea.tsx`
    - 从 ui-store 读取 selectedProvider（不再用 window.__selectedProvider）
    - sendMessage 时传递 sessionId（从 chat-store.activeSessionId）
  - 修改 `src/renderer/src/components/chat/MessageList.tsx`
    - 从 chat-store 读取当前活跃会话的 messages
  - 修改 `src/renderer/src/components/chat/ModelSwitcher.tsx`
    - 选中的 provider 存到 ui-store.selectedProvider（不再用 window.__）
  - 验证：`npm run typecheck` + `electron-vite build` 通过

- [ ] 步骤7：修复 App.tsx + SplashPage 路由
  - 修改 `src/renderer/src/App.tsx`
    - 移除 `view === 'chat'` 分支（ChatPage 集成到 MainLayout）
    - AppView 改为 `splash | main | settings`
  - 修改 `src/renderer/src/components/SplashPage.tsx`
    - "进入" 按钮直接进入 main 布局（不再有独立 chat 入口）
  - 修改 `src/preload/index.d.ts`
    - 移除 `__selectedProvider` 和 `__sessionId` 全局声明
  - 验证：`npm run typecheck` + `electron-vite build` 通过

- [ ] 步骤8：集成验证
  - 启动应用 → 点击聊天图标 → 新建会话 → 发消息 → 看到流式回复
  - 新建第二个会话 → 切换回第一个 → 消息保留
  - 删除会话
  - 活动面板正常
  - 产出验证报告

## 涉及文件

### 修改
- `src/renderer/src/stores/ui-store.ts` — 布局状态 + selectedProvider
- `src/renderer/src/stores/chat-store.ts` — 会话管理（Session CRUD）
- `src/renderer/src/components/layout/MainLayout.tsx` — 三栏布局 + NavRail 可点击
- `src/renderer/src/components/chat/ChatPage.tsx` — 适配主布局
- `src/renderer/src/components/chat/InputArea.tsx` — 从 store 读 provider
- `src/renderer/src/components/chat/MessageList.tsx` — 从 store 读活跃会话消息
- `src/renderer/src/components/chat/ModelSwitcher.tsx` — 存到 store
- `src/renderer/src/App.tsx` — 移除 chat 独立视图
- `src/renderer/src/components/SplashPage.tsx` — 简化入口
- `src/preload/index.d.ts` — 移除 window.__ 全局声明

### 新建
- `src/renderer/src/components/layout/Sidebar.tsx` — 会话列表侧边栏

## 参考源码

### OpenCowork
- `D:\gy\OpenCowork\src\renderer\src\components\layout\Layout.tsx` — 主布局结构
- `D:\gy\OpenCowork\src\renderer\src\components\layout\NavRail.tsx` — 导航栏（参考图标和交互）
- `D:\gy\OpenCowork\src\renderer\src\components\layout\WorkspaceSidebar.tsx` — 会话列表（参考结构，大幅精简）
- `D:\gy\OpenCowork\src\renderer\src\components\layout\SessionListPanel.tsx` — 会话列表项交互（参考，大幅精简）
- `D:\gy\OpenCowork\src\renderer\src\components\chat\ChatHomePage.tsx` — 新对话首页（参考快捷提示）
- `D:\gy\OpenCowork\src\renderer\src\stores\chat-store.ts` — Session 概念和 CRUD（参考结构，去掉 DB 持久化）
