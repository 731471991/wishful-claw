# 迭代十一 探索发现

## 当前项目状态

- 分支：`dev/iter-11`，从 `main` 切出，已 cherry-pick 两个文档 commit
- 最新 commit：`d0012a0`
- 工作区干净

## 当前右侧面板现状

### RightPanel.tsx（67 行）
- 硬编码 Activity + Memory 双 tab，使用本地 `useState` 管理切换
- `RightPanelHeader` 导出为 `null`
- 无动态 tab 系统、无拖拽调宽、无动画
- MainLayout 中条件渲染：`{rightPanelOpen && <div style={{width}}><RightPanel /></div>}`

### ui-store.ts（656 行）
- `RightPanelTabKind` 类型已有 7 种（context/review/files/preview/browser/subagent/terminal）✓
- `RightPanelTabInstance` 接口已有 ✓
- `rightPanelTabs` / `rightPanelActiveTabId` / `setRightPanelActiveTab` / `closeRightPanelTab` 已有 ✓
- `openSubAgentExecutionDetail` 已有 ✓
- **缺失**：`ensureBrowserTab`、`openSubAgentsPanel`
- **缺失**：浏览器状态字段（canGoBack/canGoForward/errorInfo/loading 按 session 隔离）
- **缺失**：`setBrowserWebviewRef` 方法
- `getBrowserWebviewRef` / `getBrowserState` / `openBrowserTab` 都是 stub
- `openFilePreview` 是 stub（console.log）
- 浏览器状态只有简单的全局字段（browserUrl/browserLoading/browserPageTitle），无 session 隔离

### main/index.ts
- `webPreferences` 中**未开启** `webviewTag: true`
- 当前只有 `preload` 和 `sandbox: false`

### browser-access.ts（17 行 stub）
- 只有 `getBrowserAccessDecision` 返回 `{ allowed: true }`
- 缺少 `normalizeBrowserUrl`、域名白/黑名单逻辑

### webview-helpers.ts（41 行）
- 已有 `MaybePromise`、`isPromiseLike`、`isWebviewConnected`、`describeWebviewOperationError`
- 缺少 `isGuestViewManagerReplyError`
- `MaybePromise` 类型定义略有不同（`T | Promise<T>` vs `T | PromiseLike<T>`）

### shared/browser-plugin.ts（24 行）
- `BUILTIN_BROWSER_PARTITION = 'persist:opencowork-browser'`（需改为 wishful-claw 命名）
- `stripElectronFromUserAgent` 已有 ✓
- `BROWSER_SETTINGS_STORAGE_KEY` 等常量已有 ✓

## 已有的基础依赖（wishful-claw）

| 依赖 | 位置 | 状态 |
|------|------|------|
| `subAgentRegistry` | `lib/agent/sub-agents/registry.ts` | ✓ 有 `get(name)` 方法 |
| `SubAgentDefinition.icon` | `lib/agent/sub-agents/types.ts` | ✓ 有 `icon?: string` 字段 |
| `selectSessionScopedAgentState` | `lib/agent/session-scoped-agent-state.ts` | ✓ |
| `findSubAgentInSelection` | `lib/agent/session-scoped-agent-state.ts` | ✓ |
| `agentBridge.cancelSubAgent` | `lib/ipc/agent-bridge.ts` | ✓ |
| `RuntimeTokenStatistics` | `components/chat/InputArea/runtime-status.tsx` | ✓ |
| `TranscriptMessageList` | `components/chat/TranscriptMessageList.tsx` | ✓ |
| `FadeIn` / `spring` | `components/animate-ui/transitions.tsx` | ✓ |
| UI 组件（Button/Badge/DropdownMenu） | `components/ui/` | ✓ 全部存在 |
| `settingsStore.animationsEnabled` | `stores/settings-store.ts` | ✓ |
| `settingsStore.browserUserDataReuseEnabled` | `stores/settings-store.ts` | ✓ |
| `appPluginStore.getPlugin` | `stores/app-plugin-store.ts` | ✓ |
| `BROWSER_PLUGIN_ID` | `lib/app-plugin/types.ts` | ✓ |
| i18n（layout.json en/zh） | `locales/en/layout.json` | ✓ 但缺 rightPanel/subAgents/browser 键 |
| `ActivityPanel` | `components/activity/ActivityPanel.tsx` | ✓ 保留为内置 tab |
| `MemoryPanel` | `components/memory/MemoryPanel.tsx` | ✓ 保留为内置 tab |

## OpenCowork 参考源码分析

### RightPanel.tsx（489 行）
- 动态 tab 渲染 + 拖拽调宽 + AnimatePresence 动画
- 持久化浏览器层：webview 在浏览器 tab 存在时始终挂载，切 tab 只隐藏不销毁
- 依赖：`useAgentStore`、`useAppPluginStore`、`useSshStore`、`useTerminalStore`、`ipcClient`
- **需去除**：Terminal tab 内容（LocalTerminal/SshTerminal/TerminalTabContent）、AgentFilesPanel、SessionChangeReviewPanel、PreviewPanel、SSH 相关
- **需适配**：`ipcClient.invoke(IPC.FS_SELECT_FILE)` → wishful-claw 的 IPC 模式

### RightPanelHeader.tsx（210 行）
- Tab 条：图标 + 标题 + 关闭按钮 + "+" 下拉菜单
- 动画 tab 切换（layoutId）
- 依赖：`useSettingsStore.animationsEnabled`、`DropdownMenu`
- **可直接搬入**，基本无需改动

### SubAgentsPanel.tsx（461 行）
- 列表视图（Started/Completed 分组）+ 详情视图
- 依赖：`agentBridge.cancelSubAgent`、`selectSessionScopedAgentState`、`mergeSessionSubAgents`、`SubAgentExecutionDetail`、`getAgentIcon/getAgentIconTone`、`FadeIn`、`spring`
- **需补充**：`openSubAgentsPanel` 方法（ui-store 中缺失）

### SubAgentExecutionDetail.tsx（358 行）
- 子 Agent 的 transcript 展示 + token 统计
- 依赖：`TranscriptMessageList`、`RuntimeTokenStatistics`、`parseSubAgentMeta`、`decodeStructuredToolResult`、`buildRenderableMessageMeta`
- **需确认**：`parseSubAgentMeta`、`decodeStructuredToolResult`、`buildRenderableMessageMeta` 是否存在

### sub-agent-run-data.ts（309 行）
- 合并 session 消息中的子 Agent 数据
- 依赖：`TASK_TOOL_NAME`、`parseSubAgentMeta`、`decodeStructuredToolResult`、`UnifiedMessage`、`SubAgentState`
- **需确认**：`TASK_TOOL_NAME`、`parseSubAgentMeta` 是否存在

### sub-agent-visuals.tsx（30 行）
- Agent 图标和色调
- 依赖：`subAgentRegistry`、`lucide-react` 的 `icons`
- **可直接搬入**

### BrowserPanel.tsx（412 行）
- 工具栏（前进/后退/刷新/地址栏）+ webview + 错误提示
- 依赖：`normalizeBrowserUrl`、`getBrowserAccessDecision`、`ipcClient`、`describeWebviewOperationError`、`isWebviewConnected`、`BUILTIN_BROWSER_PARTITION`、`stripElectronFromUserAgent`
- **需适配**：`ipcClient.invoke(IPC.BROWSER_EMULATION_STATUS)` → stub 或去除；`ipcClient.invoke(IPC.SHELL_OPEN_EXTERNAL)` → wishful-claw IPC

### browser-access.ts（121 行）
- `normalizeBrowserUrl` + `normalizeBrowserDomainEntry` + `parseBrowserDomainList` + `getBrowserAccessDecision`
- 依赖：`useChatStore`、`useAppPluginStore`、`BROWSER_PLUGIN_ID`
- **可直接搬入**，命名空间无需改动

### webview-helpers.ts（33 行）
- `isPromiseLike`、`isWebviewConnected`、`isGuestViewManagerReplyError`、`describeWebviewOperationError`
- **需更新**：添加 `isGuestViewManagerReplyError`，调整 `MaybePromise` 类型

## 潜在风险

1. **webview 持久化与 MainLayout 改造**：OpenCowork 的 RightPanel 始终挂载，通过 width=0 隐藏。需改造 MainLayout 的条件渲染
2. **IPC 差异**：OpenCowork 用 `ipcClient.invoke(IPC.*)`，wishful-claw 用 MessagePack IPC。BrowserPanel 中的 `IPC.BROWSER_EMULATION_STATUS` 和 `IPC.SHELL_OPEN_EXTERNAL` 需适配或 stub
3. **parseSubAgentMeta / TASK_TOOL_NAME**：需确认这些在 wishful-claw 的 `lib/agent/sub-agents/create-tool.ts` 中是否存在
4. **decodeStructuredToolResult**：需确认在 `lib/tools/tool-result-format.ts` 中是否存在
5. **BUILTIN_BROWSER_PARTITION 命名**：当前为 `persist:opencowork-browser`，需改为 `persist:wishfulclaw-browser`
6. **browser-native-ui.ts 对接**：747 行的浏览器工具 UI 需对接真实 webview ref，可能需要调整
