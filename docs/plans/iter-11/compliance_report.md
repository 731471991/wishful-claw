# 迭代十一 规划验证报告

## 验证结果

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 步骤是否完整覆盖任务目标 | ✅ | 三个 Plan 分别覆盖 tab 系统重构、子Agent面板、浏览器面板 |
| 每步是否有明确的验证检查点 | ✅ | 每个 Plan 均有 tsc + build 验证 + 功能验证 |
| 文件路径是否符合项目结构 | ✅ | 组件放 `components/layout/`，store 放 `stores/`，lib 放 `lib/` |
| 分层依赖是否正确 | ✅ | 纯前端改动，不涉及 Core/Workspace/Worker 分层 |
| 是否参考了正确的源码文件 | ✅ | OpenCowork 路径正确，依赖确认存在 |

## 依赖确认

| 依赖 | 位置 | 状态 |
|------|------|------|
| `TASK_TOOL_NAME` | `lib/agent/sub-agents/create-tool.ts:38` | ✅ |
| `parseSubAgentMeta` | `lib/agent/sub-agents/create-tool.ts:24` | ✅ |
| `decodeStructuredToolResult` | `lib/tools/tool-result-format.ts:29` | ✅ |
| `buildRenderableMessageMeta` | `components/chat/transcript-utils.ts:499` | ✅ |
| `TranscriptMessageList` | `components/chat/TranscriptMessageList.tsx` | ✅ |
| `RuntimeTokenStatistics` | `components/chat/InputArea/runtime-status.tsx:577` | ✅ |
| `selectSessionScopedAgentState` | `lib/agent/session-scoped-agent-state.ts:26` | ✅ |
| `findSubAgentInSelection` | `lib/agent/session-scoped-agent-state.ts:43` | ✅ |
| `agentBridge.cancelSubAgent` | `lib/ipc/agent-bridge.ts:103` | ✅ |
| `subAgentRegistry.get()` | `lib/agent/sub-agents/registry.ts:45` | ✅ |
| `ipcClient` (SHELL_OPEN_EXTERNAL) | `lib/ipc/channels.ts:50` | ✅ 通道存在 |
| `ipcClient` (BROWSER_EMULATION_STATUS) | `lib/ipc/channels.ts:347` | ✅ 通道存在 |
| `settingsStore.animationsEnabled` | `stores/settings-store.ts:428` | ✅ |
| `settingsStore.browserUserDataReuseEnabled` | `stores/settings-store.ts:384` | ✅ |
| UI 组件 (Button/Badge/DropdownMenu) | `components/ui/` | ✅ |
| `FadeIn` / `spring` | `components/animate-ui/transitions.tsx` | ✅ |

## 适配要点

1. **BUILTIN_BROWSER_PARTITION**：当前值为 `persist:opencowork-browser`，需改为 `persist:wishfulclaw-browser`
2. **MainLayout 改造**：RightPanel 需始终挂载（webview 持久化），通过 width=0 隐藏，不再条件渲染
3. **IPC 适配**：`shell:openExternal` 和 `browser:emulation-status` 通道已在路由白名单中，但 main 进程可能缺 handler — BrowserPanel 中需 graceful fallback
4. **去除 OpenCowork 特有功能**：Terminal tab（LocalTerminal/SshTerminal）、AgentFilesPanel、SessionChangeReviewPanel、PreviewPanel — 不在迭代十一范围
5. **Activity + Memory 保留**：作为内置不可关闭的 tab，集成到新的动态 tab 系统中

## 阻断项

❌ 项 = 0 → 可以进入用户确认环节

## 执行计划细化

### Plan 11-1 步骤（6 步）
1. `webviewTag: true` 开启 + `BUILTIN_BROWSER_PARTITION` 改名
2. ui-store 补全：浏览器状态 session 隔离 + `ensureBrowserTab` + `openSubAgentsPanel` + `setBrowserWebviewRef` + 修复 stub
3. RightPanelHeader.tsx 创建（从 OpenCowork 搬入，基本直接可用）
4. RightPanel.tsx 重写（动态 tab + 拖拽 + 动画 + 持久化浏览器层 + Activity/Memory 内置 tab）
5. MainLayout.tsx 改造（始终挂载 RightPanel）+ i18n 补全
6. tsc + build 验证

### Plan 11-2 步骤（5 步）
1. sub-agent-visuals.tsx 创建（直接搬入）
2. sub-agent-run-data.ts 创建（直接搬入，类型适配）
3. SubAgentsPanel.tsx 创建（搬入 + 适配）
4. SubAgentExecutionDetail.tsx 创建（搬入 + 适配）+ RightPanel 接线 + i18n
5. tsc + build 验证

### Plan 11-3 步骤（5 步）
1. browser-access.ts 替换为完整版
2. webview-helpers.ts 更新（补 `isGuestViewManagerReplyError`）
3. BrowserPanel.tsx 创建（搬入 + 适配 IPC + 去除 emulation 相关或 stub）
4. RightPanel 持久化浏览器层接线 + browser-native-ui 对接 + i18n
5. tsc + build 验证
