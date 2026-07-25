# 工具移植清单 — OpenCowork → wishful-claw

> 参考源码路径：`D:\claw\OpenCowork`
> 更新日期：2026-07-25

---

## 第一层：原生工具（ToolCallProcessor 直接执行）

| OpenCowork 工具 | 功能 | wishful-claw | 对应文件 | 备注 |
|----------------|------|:-----------:|----------|------|
| Read | 读文件（快照、行号、offset/limit） | ✅ | FileReadTool.cs | |
| Write | 写文件 | ✅ | FileWriteTool.cs | |
| Edit | 精确替换编辑 | ✅ | FileEditTool.cs | |
| NotebookEdit | Jupyter Notebook 编辑 | ❌ | — | |
| LS | 列目录 | ✅ | FileListTool.cs | |
| Glob | 文件模式匹配 | ✅ | GlobTool.cs | |
| Grep | 全文搜索 | ✅ | GrepTool.cs | |
| Bash / Shell | Shell 执行 | ✅ | ShellExecuteTool.cs | |

---

## 第二层：Agent 执行器工具（ToolCallProcessor 拦截路由）

### 已移植

| 执行器 | 工具名 | 功能 | 对应文件 | 备注 |
|--------|--------|------|----------|------|
| BrowserExecutor | BrowserNavigate/GetContent/Screenshot/Snapshot/Click/Type/Scroll/Evaluate | 内置 webview 浏览器 | AgentRuntimeBrowserExecutor.cs + browser-native-ui.ts | reverse-request → Renderer |
| SubAgentExecutor | Task | 子 Agent 嵌套执行 | SubAgentExecutor.cs | 自有设计 |
| MemoryExecutor | memory_append/search/update/hot_read/hot_write | 记忆管理 | MemoryTools/*.cs | 自有设计，5 个工具 |

### 未移植

| 执行器 | 工具名 | 功能 | 源码行数 | 执行方式 | 优先级 | 备注 |
|--------|--------|------|---------|----------|:------:|------|
| DesktopExecutor | DesktopScreenshot/Click/Type/Scroll/Wait | 桌面截屏+鼠标+键盘 | 513 | reverse-request → Main | P1 | 依赖 @jitsi/robotjs |
| WebSearchExecutor | WebSearch | 网页搜索 | 686 | Worker 直接 | P1 | |
| WebFetchExecutor | WebFetch | 抓取网页内容 | 470 | Worker 直接 | P1 | |
| AskUserExecutor | AskUserQuestion | 向用户提问并等待回答 | 740 | reverse-request → Renderer | P0 | |
| ImageGenerateExecutor | ImageGenerate | AI 图片生成 | 444 | reverse-request → Renderer | P2 | |
| NotifyExecutor | Notify | 桌面通知 | 212 | reverse-request → Main | P2 | |
| SkillExecutor | Skill | 调用已注册技能 | 115 | Worker 直接 | P2 | |
| PlanExecutor | EnterPlanMode / ExitPlanMode | 计划模式（只读分析） | 529 | Worker 直接 | P2 | |
| GoalExecutor | get_goal / create_goal / update_goal | 目标追踪 | 524 | Worker 直接 | P2 | |
| TaskExecutor | TaskCreate / TaskGet / TaskUpdate / TaskList | 任务列表管理 | 862 | Worker 直接 | P2 | 和子 Agent Task 不同 |
| TeamExecutor | TeamCreate / TeamStatus / TeamDelete / SendMessage | 多 Agent 团队 | 445 | Worker 直接 | P2 | |
| CronExecutor | CronAdd/Create/Update/Remove/Delete/List | 定时任务 | 873 | Worker 直接 | P2 | |
| McpExecutor | mcp__* | MCP 工具桥接 | 136 | Worker 直接 | P2 | |
| ExtensionExecutor | extension__* | 插件扩展 | 149 | Worker 直接 | P2 | |
| CodeCompatibleExecutor | PowerShell / Monitor | PowerShell + 输出监控 | 400 | Worker 直接 | P2 | Windows 增强 |
| WidgetExecutor | visualize_show_widget | UI 组件展示 | 91 | Worker 直接 | P2 | |
| CodeGraphExecutor | codegraph_* | 代码图谱查询 | 72 | Worker 直接 | P2 | |
| PluginExecutor | PluginSendMessage 等 6 个 | 插件消息 | 341 | Worker 直接 | P2 | 渠道集成 |
| ChannelPluginExecutor | FeishuSendImage 等 14 个 | 飞书/微信集成 | 499 | reverse-request → Main | P2 | 渠道集成 |

---

## 第三层：IPC 模块工具（Worker Module 注册的 handler）

### File 模块

| IPC 通道 | 功能 | wishful-claw | 备注 |
|----------|------|:-----------:|------|
| fs/read-file | 读文件 | ✅ | |
| fs/write-file | 写文件 | ✅ | |
| fs/glob | 文件匹配 | ✅ | |
| fs/grep | 全文搜索 | ✅ | |
| fs/list-dir | 列目录 | ✅ | |
| fs/read-document | 读 Office 文档 | ❌ | P0 |
| fs/read-file-binary | 读二进制文件 | ❌ | P0 |
| fs/write-file-binary | 写二进制文件 | ❌ | P0 |
| fs/stat-path | 文件元信息 | ❌ | P0 |
| fs/mkdir | 创建目录 | ❌ | P0 |
| fs/delete | 删除文件/目录 | ❌ | P0 |
| fs/move | 移动/重命名 | ❌ | P0 |
| fs/read-text-file-lines | 按行读文件 | ❌ | P0 |
| fs/search-files | 搜索文件 | ❌ | P0 |

### Git 模块

| IPC 通道 | 功能 | wishful-claw | 备注 |
|----------|------|:-----------:|------|
| git/exec | Git 命令执行 | ❌ | P0 |
| git/exec-local | 本地 Git | ❌ | P0 |
| git/scan-repositories | 扫描仓库 | ❌ | P0 |
| git/status-detailed | 详细状态 | ❌ | P0 |
| git/query | Git 查询 | ❌ | P0 |
| git/query-local | 本地查询 | ❌ | P0 |

### Terminal 模块

| IPC 通道 | 功能 | wishful-claw | 备注 |
|----------|------|:-----------:|------|
| terminal/create | 创建终端会话 | ❌ | P1，有 terminal stub |
| terminal/input | 终端输入 | ❌ | P1 |
| terminal/resize | 调整大小 | ❌ | P1 |
| terminal/kill | 终止终端 | ❌ | P1 |
| terminal/get | 获取输出 | ❌ | P1 |
| terminal/list | 列出终端 | ❌ | P1 |

### Media 模块

| IPC 通道 | 功能 | wishful-claw | 备注 |
|----------|------|:-----------:|------|
| media/read-file-chunk | 媒体分块读取 | ❌ | P2 |

### OpenAIImages 模块

| IPC 通道 | 功能 | wishful-claw | 备注 |
|----------|------|:-----------:|------|
| openai-images/generate | 图片生成 | ❌ | P2 |

### OpenAIAudio 模块

| IPC 通道 | 功能 | wishful-claw | 备注 |
|----------|------|:-----------:|------|
| openai-audio/transcribe | 语音转文字 | ❌ | P2 |
| openai-audio/speech | 文字转语音 | ❌ | P2 |

### AgentChanges 模块

| IPC 通道 | 功能 | wishful-claw | 备注 |
|----------|------|:-----------:|------|
| agent-changes/list-session-hydrated | 变更列表 | ❌ | P2 |
| agent-changes/get-hydrated | 获取变更 | ❌ | P2 |
| agent-changes/diff-local | 本地 diff | ❌ | P2 |
| agent-changes/rollback-local-change | 回滚变更 | ❌ | P2 |

### Video 模块

| IPC 通道 | 功能 | wishful-claw | 备注 |
|----------|------|:-----------:|------|
| Seedance | 视频生成 | ❌ | P2 |
| XaiVideo | 视频生成 | ❌ | P2 |

---

## 前端工具定义（Renderer 侧）

| 类别 | OpenCowork 文件 | wishful-claw | 备注 |
|------|----------------|:-----------:|------|
| Browser | browser-native-ui.ts + browser-tool.ts | ✅ | |
| Desktop | desktop-screenshot/click/type/scroll/wait-tool.ts（5 个） | ❌ | P1 |
| Desktop UI | DesktopActionToolCard.tsx（299 行） | ❌ | P1 |
| AskUser | AskUserQuestionCard.tsx（1058 行） | ❌ | P0，需拆分 |

---

## 优先级汇总

### P0 — 编程助手核心能力

| 序号 | 工具 | 类型 | 源码行数 | 理由 |
|------|------|------|---------|------|
| 1 | Git 工具（6 个 IPC 通道） | IPC Module | 946 | Agent 无法做版本控制，编程场景刚需 |
| 2 | AskUserQuestion | Agent Executor | 740 | Agent 遇到歧义时能问用户 |
| 3 | 文件操作补全（8 个 IPC 通道） | IPC Module | ~400 | Agent 无法管理目录结构、操作二进制 |

### P1 — 桌面与信息获取

| 序号 | 工具 | 类型 | 源码行数 | 理由 |
|------|------|------|---------|------|
| 4 | Desktop 控制（5 个工具） | Agent Executor | 513+315 | 桌面自动化 |
| 5 | WebSearch + WebFetch | Agent Executor | 686+470 | 网页信息获取 |
| 6 | Terminal 会话（6 个 IPC 通道） | IPC Module | 821 | 持久终端 |

### P2 — 扩展能力

| 序号 | 工具 | 类型 | 源码行数 | 理由 |
|------|------|------|---------|------|
| 7 | NotebookEdit | Native Tool | ~200 | Jupyter 支持 |
| 8 | ImageGenerate | Agent Executor | 444 | AI 图片生成 |
| 9 | Skill | Agent Executor | 115 | 技能调用 |
| 10 | Notify | Agent Executor | 212 | 桌面通知 |
| 11 | PlanMode | Agent Executor | 529 | 计划模式 |
| 12 | AgentChanges | IPC Module | 371 | 文件变更追踪和回滚 |
| 13 | PowerShell / Monitor | Agent Executor | 400 | Windows 增强 |
| 14 | Goal/Task/Team | Agent Executor | 862+524+445 | 目标/任务/团队管理 |
| 15 | Cron | Agent Executor | 873 | 定时任务 |
| 16 | MCP | Agent Executor | 136 | MCP 工具桥接 |
| 17 | Extension | Agent Executor | 149 | 插件扩展 |
| 18 | Plugin / ChannelPlugin | Agent Executor | 341+499 | 渠道集成 |
| 19 | Media / OpenAIImages / OpenAIAudio / Video | IPC Module | 256+635+688+352+307 | 媒体处理 |
| 20 | CodeGraph / Widget | Agent Executor | 72+91 | 代码图谱 / UI 组件 |
