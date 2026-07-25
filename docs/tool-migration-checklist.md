# 工具移植清单 — OpenCowork → wishful-claw

> 参考源码路径：`D:\claw\OpenCowork`
> 更新日期：2026-07-25（第二轮校准）

---

## 第一层：原生工具（ToolCallProcessor 直接执行）

| OpenCowork 工具 | 功能 | wishful-claw | 对应文件 | 备注 |
|----------------|------|:-----------:|----------|------|
| Read | 读文件（快照、行号、offset/limit） | ✅ | FileReadTool.cs | |
| Write | 写文件 | ✅ | FileWriteTool.cs | |
| Edit | 精确替换编辑 | ✅ | FileEditTool.cs | |
| NotebookEdit | Jupyter Notebook 编辑 | ✅ | AgentRuntimeNotebookEditExecutor.cs | P2 执行器 |
| LS | 列目录 | ✅ | FileListTool.cs | |
| Glob | 文件模式匹配 | ✅ | GlobTool.cs | |
| Grep | 全文搜索 | ✅ | GrepTool.cs | |
| Bash / Shell | Shell 执行 | ✅ | ShellExecuteTool.cs | |

---

## 第二层：Agent 执行器工具（ToolCallProcessor 拦截路由）

### 已移植（全部完成，22 个执行器）

| 执行器 | 工具名 | 功能 | 对应文件 | 备注 |
|--------|--------|------|----------|------|
| BrowserExecutor | BrowserNavigate/GetContent/Screenshot/Snapshot/Click/Type/Scroll/Evaluate | 内置 webview 浏览器 | AgentRuntimeBrowserExecutor.cs + browser-native-ui.ts | reverse-request → Renderer |
| SubAgentExecutor | Task | 子 Agent 嵌套执行 | SubAgentExecutor.cs | 自有设计 |
| MemoryExecutor | memory_append/search/update/hot_read/hot_write | 记忆管理 | MemoryTools/*.cs | 自有设计，5 个工具 |
| DesktopExecutor | DesktopScreenshot/Click/Type/Scroll/Wait | 桌面截屏+鼠标+键盘 | AgentRuntimeDesktopExecutor.cs + desktop-control.ts | reverse-request → Main |
| WebSearchExecutor | WebSearch | 网页搜索 | AgentRuntimeWebSearchExecutor.cs + WebSearchProviders.cs | 9 个 provider |
| WebFetchExecutor | WebFetch | 抓取网页内容 | AgentRuntimeWebFetchExecutor.cs | HTML→Markdown |
| AskUserExecutor | AskUserQuestion | 向用户提问并等待回答 | AgentRuntimeAskUserExecutor.cs + AskUserCoercion.cs + AskUserAnswerBuilder.cs | reverse-request → Renderer |
| TerminalExecutor | Terminal 会话管理 | PTY 终端 | terminal-handlers.ts | node-pty |
| ImageGenerateExecutor | ImageGenerate | AI 图片生成 | AgentRuntimeImageGenerateExecutor.cs + image-reverse-handler.ts | reverse-request → Main, OpenAI API |
| NotifyExecutor | Notify | 桌面通知 | AgentRuntimeNotifyExecutor.cs | reverse-request → Main, Electron Notification |
| SkillExecutor | Skill | 调用已注册技能 | AgentRuntimeSkillExecutor.cs | Worker 直接 |
| PlanExecutor | EnterPlanMode / ExitPlanMode | 计划模式 | AgentRuntimePlanExecutor.cs | 文件存储 |
| GoalExecutor | get_goal / create_goal / update_goal | 目标追踪 | AgentRuntimeGoalExecutor.cs | 内存存储 |
| TaskExecutor | TaskCreate / TaskGet / TaskUpdate / TaskList | 任务列表管理 | AgentRuntimeTaskExecutor.cs | 内存存储 |
| TeamExecutor | TeamCreate / TeamStatus / TeamDelete / SendMessage | 多 Agent 团队 | AgentRuntimeTeamExecutor.cs | 内存存储 + reverse-request |
| CronExecutor | CronAdd/Create/Update/Remove/Delete/List | 定时任务 | AgentRuntimeCronExecutor.cs + cron-reverse-handler.ts | reverse-request → Main, node-cron |
| McpExecutor | mcp__* | MCP 工具桥接 | AgentRuntimeMcpExecutor.cs + mcp-client.ts + mcp-manager.ts | ✅ 已接 MCP 客户端（@modelcontextprotocol/sdk） |
| ExtensionExecutor | extension__* | 插件扩展 | AgentRuntimeExtensionExecutor.cs + stub-reverse-handler.ts | 待接扩展运行时 |
| CodeCompatibleExecutor | PowerShell / Monitor | PowerShell + 输出监控 | AgentRuntimeCodeCompatibleExecutor.cs | Process 直接 |
| WidgetExecutor | visualize_show_widget | UI 组件展示 | AgentRuntimeWidgetExecutor.cs | Worker 直接 |
| CodeGraphExecutor | codegraph_* | 代码图谱查询 | AgentRuntimeCodeGraphExecutor.cs + stub-reverse-handler.ts | 待接图谱引擎 |
| PluginExecutor | PluginSendMessage 等 6 个 | 插件消息 | AgentRuntimePluginExecutor.cs + stub-reverse-handler.ts | 待接插件系统 |
| ChannelPluginExecutor | FeishuSendImage 等 14 个 | 飞书/微信集成 | AgentRuntimeChannelPluginExecutor.cs + stub-reverse-handler.ts | 待接渠道 API |

---

## 第三层：IPC 模块工具（Worker Module 注册的 handler）

### File 模块（全部完成）

| IPC 通道 | 功能 | wishful-claw | 备注 |
|----------|------|:-----------:|------|
| fs/read-file | 读文件 | ✅ | |
| fs/write-file | 写文件 | ✅ | |
| fs/glob | 文件匹配 | ✅ | |
| fs/grep | 全文搜索 | ✅ | |
| fs/list-dir | 列目录 | ✅ | |
| fs/read-document | 读 Office 文档 | ✅ | docx 文本提取 |
| fs/read-file-binary | 读二进制文件 | ✅ | |
| fs/write-file-binary | 写二进制文件 | ✅ | |
| fs/stat-path | 文件元信息 | ✅ | |
| fs/mkdir | 创建目录 | ✅ | |
| fs/delete | 删除文件/目录 | ✅ | |
| fs/move | 移动/重命名 | ✅ | |
| fs/read-text-file-lines | 按行读文件 | ✅ | |
| fs/search-files | 搜索文件 | ✅ | |
| fs/default-chat-working-folder | 默认工作目录 | ✅ | |

### Git 模块（全部完成）

| IPC 通道 | 功能 | wishful-claw | 备注 |
|----------|------|:-----------:|------|
| git/exec | Git 命令执行 | ✅ | GitModule.cs |
| git/exec-local | 本地 Git | ✅ | |
| git/scan-repositories | 扫描仓库 | ✅ | GitScanTools.cs |
| git/status-detailed | 详细状态 | ✅ | GitStatusTools.cs |
| git/query | Git 查询 | ✅ | GitQueryTools.cs |
| git/query-local | 本地查询 | ✅ | |

### Terminal 模块（全部完成）

| IPC 通道 | 功能 | wishful-claw | 备注 |
|----------|------|:-----------:|------|
| terminal/create | 创建终端会话 | ✅ | terminal-handlers.ts, node-pty |
| terminal/input | 终端输入 | ✅ | |
| terminal/resize | 调整大小 | ✅ | |
| terminal/kill | 终止终端 | ✅ | |
| terminal/get | 获取输出 | ✅ | |
| terminal/list | 列出终端 | ✅ | |

### Media 模块（已完成）

| IPC 通道 | 功能 | wishful-claw | 对应文件 | 备注 |
|----------|------|:-----------:|----------|------|
| media/read-file-chunk | 媒体分块读取 | ✅ | MediaFileModule.cs + MediaFileTools.cs | 二进制分块读取 |

### OpenAIAudio 模块（已完成）

| IPC 通道 | 功能 | wishful-claw | 对应文件 | 备注 |
|----------|------|:-----------:|----------|------|
| openai-audio/transcribe | 语音转文字 | ✅ | OpenAIAudioModule.cs + OpenAIAudioTools.cs | Whisper API |
| openai-audio/speech | 文字转语音 | ✅ | OpenAIAudioModule.cs + OpenAIAudioTools.cs | TTS API |

### AgentChanges 模块（已完成）

| IPC 通道 | 功能 | wishful-claw | 对应文件 | 备注 |
|----------|------|:-----------:|----------|------|
| agent-changes/list-session-hydrated | 变更列表 | ✅ | AgentChangeModule.cs + AgentChangeTools.cs | 内存存储（ConcurrentDictionary） |
| agent-changes/get-hydrated | 获取变更 | ✅ | | |
| agent-changes/diff-local | 本地 diff | ✅ | | |
| agent-changes/rollback-local-change | 回滚变更 | ✅ | | |

### 待移植 IPC 模块

| 模块 | IPC 通道 | 功能 | 优先级 | 备注 |
|------|----------|------|:------:|------|
| Video | Seedance | 视频生成 | P2 | OpenCowork 有，wishful-claw 未创建 |
| Video | XaiVideo | 视频生成 | P2 | OpenCowork 有，wishful-claw 未创建 |

---

## Reverse-request 路由状态

| 路由目标 | 方法数 | 状态 | 对应文件 |
|----------|--------|------|----------|
| Desktop (Main 直接) | 4 | ✅ 已实现 | desktop-control.ts |
| Renderer (转发) | 3 | ✅ 已实现 | renderer-tool-bridge.ts |
| Notify (Main 直接) | 1 | ✅ 已实现 | native-agent-runtime.ts |
| Cron (Main 直接) | 4 | ✅ 已实现 | cron-reverse-handler.ts |
| Image (Main 直接) | 1 | ✅ 已实现 | image-reverse-handler.ts |
| Team (Main 直接) | 1 | ✅ 已实现 | stub-reverse-handler.ts |
| MCP (Main 已接客户端) | 2 | ✅ 已实现 | mcp-client.ts + mcp-manager.ts |
| CodeGraph (Main stub) | 1 | ⏳ 待接引擎 | stub-reverse-handler.ts |
| Extension (Main stub) | 1 | ⏳ 待接运行时 | stub-reverse-handler.ts |
| Plugin (Main stub) | 2 | ⏳ 待接系统 | stub-reverse-handler.ts |
| Feishu (Main stub) | 10 | ⏳ 待接 API | stub-reverse-handler.ts |
| WeChat (Main stub) | 2 | ⏳ 待接 API | stub-reverse-handler.ts |

---

## 前端工具定义（Renderer 侧）

| 类别 | OpenCowork 文件 | wishful-claw | 备注 |
|------|----------------|:-----------:|------|
| Browser | browser-native-ui.ts + browser-tool.ts | ✅ | |
| Desktop | desktop-screenshot/click/type/scroll/wait-tool.ts（5 个） | ✅ | |
| Desktop UI | DesktopActionToolCard.tsx（299 行） | ✅ | 已创建 |
| AskUser | AskUserQuestionCard.tsx | ✅ | 已拆分：388 行 + ask-user-question-block.tsx + ask-user-utils.ts + ask-user-views.tsx |

---

## 代码拆分状态（AGENTS.md 合规）

### 第一轮拆分（已完成）

| 文件 | 原行数 | 拆分后 | 状态 |
|------|--------|--------|------|
| ToolCallProcessor.cs | 590 | 203 + ToolDispatchRouter.cs (414) | ✅ |
| AgentRuntimeAskUserExecutor.cs | 714 | 75 + AskUserCoercion.cs (254) + AskUserAnswerBuilder.cs (419) | ✅ |
| AgentRuntimeWebSearchExecutor.cs | 511 | 363 + WebSearchProviders.cs (164) | ✅ |
| git-handlers.ts | 608 | 322 + git-cache.ts (307) | ✅ |
| native-agent-runtime.ts | 276 | 277 (重构为 handler dispatch) | ✅ |

### 第二轮拆分（已完成）

| 文件 | 原行数 | 拆分后 | 状态 |
|------|--------|--------|------|
| MessageList.tsx | >500 | 拆分 | ✅ |
| theme-presets.ts | >500 | 拆分为 6 个 preset 文件 | ✅ |
| AskUserQuestionCard.tsx | 1058 | 388 + 3 个子文件 | ✅ |
| git-store.ts | >500 | git-store-types.ts | ✅ |
| settings-store.ts | >500 | settings-store-types.ts | ✅ |
| sidecar-protocol.ts | >500 | sidecar-protocol-types.ts | ✅ |

---

## 优先级汇总

### 已完成

- ✅ P0 — 编程助手核心能力（Git + AskUser + 文件操作）
- ✅ P1 — 桌面与信息获取（Desktop + WebSearch + WebFetch + Terminal）
- ✅ P2 — 全部 22 个执行器已移植
- ✅ Media 模块（二进制分块读取）
- ✅ OpenAIAudio 模块（Whisper + TTS）
- ✅ AgentChanges 模块（内存存储 + 端到端集成）
- ✅ MCP 客户端接入（@modelcontextprotocol/sdk）
- ✅ Reverse-request handler dispatch 架构
- ✅ AGENTS.md 第一轮 + 第二轮代码拆分
- ✅ 前端组件（DesktopActionToolCard + AskUserQuestionCard 拆分）

### 下一步

- ⏳ Video 模块（Seedance / XaiVideo）移植
- ⏳ Extension 运行时接入
- ⏳ Plugin / Channel API 接入（飞书 / 微信）
- ⏳ CodeGraph 引擎接入
- ⏳ 第三轮代码拆分（前端仍有大文件）
