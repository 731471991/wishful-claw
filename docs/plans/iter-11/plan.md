# 迭代十一：右侧面板 — 动态 Tab 系统 + 子 Agent 面板 + 内置浏览器 + 文件预览 + 文件目录

## 目标

右侧面板从当前硬编码的双 tab（Activity + Memory）升级为 OpenCowork 式动态 tab 系统，新增五个核心面板：
1. **SubAgentsPanel** — 子 Agent 编排预览，展示执行顺序/状态/结果
2. **BrowserPanel** — 内置浏览器（Electron webview），地址栏/前进后退/刷新，Agent 工具可驱动
3. **PreviewPanel** — 文件预览面板，支持代码/Markdown/图片/HTML 等多格式查看器
4. **AgentFilesPanel + SessionChangeReviewPanel** — 文件目录 + Agent 变更审查

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
  - 补全 `openSubAgentsPanel` 方法
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
- 补全 `shared/browser-plugin.ts`：BUILTIN_BROWSER_PARTITION 改名为 wishfulclaw
- 补全 `webview-helpers.ts`：补 isGuestViewManagerReplyError
- `RightPanelHeader` 的 "+" 按钮点击 → ensureBrowserTab
- 浏览器 tab 的 webview 常驻（切换 tab 不销毁 webview，保证 Agent 工具持续可用）
- `browser-native-ui.ts` 中 `getBrowserWebviewRef` 对接真实的 webview ref
- i18n 补全 browser 相关 key

**验证**：tsc + build 通过，能在右侧面板输入 URL 浏览网页，前进后退刷新正常，Agent 调 BrowserNavigate 后 webview 跳转

### Plan 11-4：PreviewPanel — 文件预览面板

**目标**：右侧面板支持文件预览，代码/Markdown/图片/HTML/视频/音频/PDF 等多格式查看器，支持编辑保存

**改动**：
- 新建 `components/editor/CodeEditor.tsx` + `MonacoDiffEditor.tsx` — 从 OpenCowork 搬入代码编辑器组件
- 新建 `lib/preview/viewer-registry.ts` — 查看器注册表（从 OpenCowork 搬入）
- 新建 `lib/preview/register-viewers.ts` — 注册所有内置查看器
- 搬入 `lib/preview/viewers/` — 各格式查看器组件：
  - `markdown-viewer.tsx` + `markdown-components.tsx`
  - `html-viewer.tsx`、`image-viewer.tsx`、`svg-viewer.tsx`
  - `video-viewer.tsx`、`audio-viewer.tsx`
  - `pdf-viewer.tsx`、`docx-viewer.tsx`
  - `spreadsheet-viewer.tsx`、`font-viewer.tsx`
  - `binary-file-viewer.tsx`、`fallback-viewer.tsx`
  - `office-online-viewer.tsx`（可选）
  - `MermaidBlock.tsx`
- 搬入 `hooks/use-file-watcher.ts` — 文件读取 + 监听变更 hook
- 搬入 `PreviewPanel.tsx`（744 行）— tab 管理 + 工具栏 + 查看器切换 + 保存
- `ui-store.ts` 补全 PreviewPanel 相关状态：
  - `PreviewPanelState` / `PreviewPanelTab` 类型
  - `previewPanelTabs` / `activePreviewPanelTabId`
  - `openPreviewTab` / `closePreviewTab` / `setActivePreviewTab` / `updatePreviewTab`
  - `setPreviewViewMode` 按 session 隔离
  - `openFilePreview` 对接真实逻辑
- main 进程补全 `fs:watch-file` / `fs:unwatch-file` / `fs:select-file` IPC handler
- `fs:file-changed` 事件推送
- RightPanel 中 preview tab 渲染 PreviewPanel
- RightPanelHeader "+" 菜单 "Open file" → fs:select-file → openFilePreview
- i18n 补全 preview/file 相关 key

**验证**：tsc + build 通过，能从 "+" 菜单打开文件并预览代码/Markdown/图片，编辑后可保存

### Plan 11-5：AgentFilesPanel + SessionChangeReviewPanel — 文件目录 + 变更审查

**目标**：右侧面板展示 Agent 工作目录的文件树 + Agent 造成的文件变更审查

**改动**：
- 搬入 `components/cowork/FileTreePanel.tsx`（1781 行）— 文件树浏览 + 增删改操作
- 搬入 `AgentFilesPanel.tsx`（1530 行）— files + changes 双 tab
- 搬入 `SessionChangeReviewPanel.tsx`（567 行）— Agent 变更 diff 审查 + 撤销
- main 进程实现 `agent:changes` IPC handler：
  - `agent:changes:list-session` — 列出 session 的文件变更
  - `agent:changes:list-project` — 列出项目的文件变更
  - `agent:changes:diff-content` — 获取 diff 内容
  - `agent:changes:undo-run` / `agent:changes:undo-file` — 撤销变更
  - 新建 `main/db/agent-changes-dao.ts` — 变更持久化（SQLite）
  - 变更追踪：在工具执行（WriteFile/CreateFile/DeleteFile 等）时记录 before/after 快照
- `git-store.ts` 补全（如需要）：git status / diff / commit 相关操作
- `lib/git/generate-commit-message.ts` 确认可用
- RightPanel 中 files tab 渲染 AgentFilesPanel，review tab 渲染 SessionChangeReviewPanel
- i18n 补全 files/review/git 相关 key

**验证**：tsc + build 通过，Agent 修改文件后右侧面板能看到文件树和变更列表，能查看 diff，能撤销变更

## 执行顺序

11-1（地基）→ 11-2（子Agent面板）→ 11-3（浏览器）→ 11-4（文件预览）→ 11-5（文件目录 + 变更审查）

## 技术要点

- webview 常驻：浏览器 tab 的 webview 即使切到其他 tab 也不销毁，只隐藏（Agent 工具需要持续访问）
- session 隔离：浏览器状态、预览状态按 session 或 project 隔离
- webviewTag: true 必须在 BrowserWindow webPreferences 中开启
- SubAgentsPanel 的数据来源：agent-store 的 sub-agent-slice + session 消息历史
- 子 Agent tab 自动出现：有子 Agent 运行时自动添加 tab 并切换
- PreviewPanel 的 viewer 注册表模式：按文件扩展名路由到对应查看器组件
- 文件监听：useFileWatcher 通过 fs:watch-file IPC 监听文件变化，热更新预览内容
- agent:changes 后端：需新建 SQLite DAO 记录文件变更快照，支持按 session/project/run 维度查询和撤销
- FileTreePanel 依赖 fs:list-dir / fs:read-file / fs:write-file / fs:delete / fs:move 等 IPC（大部分已存在）
