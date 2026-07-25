# 迭代十一：右侧面板 — 子 Agent 执行面板 + 内置浏览器

## 目标

右侧面板从当前硬编码的双 tab（Activity + Memory）升级为动态 tab 系统，新增两个核心面板：
1. **SubAgentsPanel** — 子 Agent 编排预览，展示执行顺序/状态/结果，类似灵犀工作台
2. **BrowserPanel** — 内置浏览器（Electron webview），地址栏/前进后退/刷新，Agent 工具可驱动

## Plan 拆分

### Plan 11-1：右侧面板 Tab 系统重构

**目标**：把 RightPanel 从硬编码 Activity+Memory 双 tab 改为 OpenCowork 式动态 tab 系统

**改动**：
- 重写 `RightPanel.tsx`：动态 tab 渲染、拖拽调宽、tab 切换动画、关闭按钮
- 新建 `RightPanelHeader.tsx`：tab 条，支持 tab 图标 + 标题 + 关闭，"+" 按钮添加浏览器 tab
- `ui-store.ts`：
  - 补全 `ensureBrowserTab` 方法
  - 补全 `openFilePreview`（stub → 可用，后续 Plan 用）
  - 补全浏览器状态字段（canGoBack/canGoForward/errorInfo/loading 按 session 隔离）
  - `setBrowserWebviewRef` 方法
- `index.ts` (main) `webPreferences` 加 `webviewTag: true`
- Activity + Memory 保留为内置不可关闭的 tab

**验证**：tsc + electron-vite build 通过，面板能开关、拖拽宽度、tab 切换正常

### Plan 11-2：SubAgentsPanel — 子 Agent 执行面板

**目标**：右侧面板展示子 Agent 的编排过程、执行顺序、状态、结果

**改动**：
- 搬入 `SubAgentsPanel.tsx`（460 行）— 列表视图（Started/Completed 分组）+ 详情视图
- 搬入 `SubAgentExecutionDetail.tsx`（357 行）— 单个子 Agent 的工具调用/输出详情
- 搬入 `sub-agent-run-data.ts`（308 行）— 合并 session 消息中的子 Agent 数据
- 搬入 `sub-agent-visuals.tsx`（29 行）— Agent 图标和色调
- 适配 `agent-store`：确认 `selectSessionScopedAgentState`、`mergeSessionSubAgents` 是否已有，缺的补
- 适配 `ui-store`：`openSubAgentsPanel` / `openSubAgentExecutionDetail` 已有 stub，确认参数对齐
- `agentBridge.cancelSubAgent` 确认存在或补 stub
- i18n 补全 subAgentsPanel 相关 key
- RightPanel 中 subagent tab 自动出现（当有子 Agent 运行时）

**验证**：tsc + build 通过，创建子 Agent 后右侧面板能看到列表/状态/详情

### Plan 11-3：BrowserPanel — 内置浏览器

**目标**：右侧面板嵌入可用浏览器，支持地址栏导航/前进/后退/刷新，Agent 浏览器工具可驱动同一 webview

**改动**：
- 搬入 `BrowserPanel.tsx`（411 行）— 工具栏 + webview + 加载状态 + 错误提示
- 补全 `browser-access.ts`：从 stub（17 行）替换为 OpenCowork 完整版（120 行），含 normalizeBrowserUrl / domain 白名单黑名单
- 补全 `ui-store` 浏览器状态：canGoBack/canGoForward/errorInfo/setBrowserWebviewRef 按 session 隔离
- 补全 `shared/browser-plugin.ts`：确认 BUILTIN_BROWSER_PARTITION 等常量
- 补全 `webview-helpers.ts`：确认 isWebviewConnected / describeWebviewOperationError
- `RightPanelHeader` 的 "+" 按钮点击 → ensureBrowserTab
- 浏览器 tab 的 webview 常驻（切换 tab 不销毁 webview，保证 Agent 工具持续可用）
- `browser-native-ui.ts` 中 `getBrowserWebviewRef` 对接真实的 webview ref
- i18n 补全 browser 相关 key

**验证**：tsc + build 通过，能在右侧面板输入 URL 浏览网页，前进后退刷新正常，Agent 调 BrowserNavigate 后 webview 跳转

## 执行顺序

11-1（地基）→ 11-2（子Agent面板）→ 11-3（浏览器）

## 技术要点

- webview 常驻：浏览器 tab 的 webview 即使切到其他 tab 也不销毁，只隐藏（Agent 工具需要持续访问）
- session 隔离：浏览器状态（URL/loading/navState）按 session 或 project 隔离
- webviewTag: true 必须在 BrowserWindow webPreferences 中开启
- SubAgentsPanel 的数据来源：agent-store 的 sub-agent-slice + session 消息历史
- 子 Agent tab 自动出现：有子 Agent 运行时自动添加 tab 并切换
