# Wishful Claw 迭代计划

基于 MVP 边界，拆分为多个迭代，每个迭代独立可验证。

## 迭代拆分规则

**迭代是版本里程碑，不是单次会话的工作量。** 每个迭代在执行前，必须先拆分为多个 Plan，每个 Plan 是一次会话能吃透的工作单元。不要在一个会话里试图做完整个迭代。

```
迭代（v0.N.0）  — 版本里程碑，定义目标 + 验证标准
  └─ Plan      — 单次会话工作单元，一次会话走完探索→规划→执行→验证
       └─ 步骤  — Plan 内的具体操作，每步 commit + push
```

**Plan 拆分原则**：
- 每个 Plan 有独立的验证检查点（能独立编译/运行/测试）
- 每个 Plan 是一次会话能完成的量（不要贪多）
- Plan 之间有明确的依赖顺序
- 拆分在迭代开始时做，写入 `docs/plans/iter-{N}/plan-{M}.md`

执行迭代时，先在 `docs/plans/iter-{N}/` 下创建 Plan 文件，自行拆分后再逐个执行。

## 迭代完结规则

**迭代是否完结由用户确认，Agent 不得自行判定。**

当迭代内所有 Plan 都完成后，Agent 输出迭代总结（做了什么、验证结果、遗留问题），然后**停下来等用户确认**。

**用户确认完结后，Agent 执行收尾**（详见 `AGENTS.md` 迭代完结收尾小节）：
```bash
# 1. 合并到 main
git checkout main
git merge dev/v2-iter-{N} --no-ff -m "merge: v2-iter-{N} - {迭代名称}"

# 2. 打 tag
git tag -a v2.{N}.0 -m "v2-iter-{N}: {迭代名称} - 验证通过"

# 3. 推送远程（需要代理）
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin main
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin v2.{N}.0

# 4. 删除本地迭代分支
git branch -d dev/v2-iter-{N}

# 5. 删除远程迭代分支（如果之前 push 过）
git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin --delete dev/v2-iter-{N}
```

收尾完成后更新 `docs/PROGRESS.md`（状态 + VERDICT + Commit ID + Tag + 日期）。

**关键要求**：收尾完成后，当前会话结束。下个会话直接从 main 拉取最新代码开始新迭代，不需要关心旧分支。

**用户确认未完结**：根据用户反馈继续补充，开启新的 Plan

---

## 已完成迭代（一~八）

### 迭代一：项目骨架

**目标**：Electron + .NET 工程跑起来，前后端能通信。

| 步骤 | 内容 |
|------|------|
| 1 | 搭建 Electron + React 前端工程（参考 OpenCowork 的 package.json / electron.vite.config.ts） |
| 2 | 搭建 .NET 解决方案（WishfulClaw.sln + 4 个项目：Core / Workspace / Worker / Contracts） |
| 3 | 实现 Worker 进程入口（Program.cs），能启动并监听 IPC |
| 4 | 实现 MessagePack 通信协议（从 OpenCowork 搬 Protocol 模块） |
| 5 | Electron Main 进程能拉起 Worker，建立 IPC 通道 |
| 6 | 前端能发一条消息到 Worker，Worker 能回一条 |

**验证标准**：前端发 "ping"，后端回 "pong"，MessagePack 编解码正常。

---

### 迭代二：AI 服务商 + 模型管理

**目标**：能配置 Provider，选择模型，为后续对话做准备。

| 步骤 | 内容 |
|------|------|
| 1 | 从 OpenCowork 搬入 Provider 配置框架（API Key 管理、Base URL、模型列表、配置字段等，直接用） |
| 2 | 清理 routin.ai 相关私货（预设端点、模型预设、token 中转硬编码），其余全部保留 |
| 3 | 实现模型配置存储（Provider 列表、模型列表、默认模型，存 SQLite） |
| 4 | 前端 Provider 设置页面（直接用 OpenCowork 的，只删 routin.ai 相关内容） |
| 5 | 实现模型连通性测试（配置后能验证 API 是否可用） |

**验证标准**：添加一个 OpenAI 兼容 Provider → 填 API Key 和 Base URL → 测试连通性通过 → 能看到可用模型列表。

---

### 迭代三：Agent Loop + 对话

**目标**：能跟模型对话，流式输出。

| 步骤 | 内容 |
|------|------|
| 1 | 从 OpenCowork 搬入 Agent Loop 核心逻辑，拆分单文件为多个（AgentLoop / StreamParser / IterationManager） |
| 2 | 从 OpenCowork 搬入 Provider 实现，先跑通 openai-chat 和 anthropic 两种 |
| 3 | 实现流式输出（模型响应 → MessagePack 事件 → 前端渲染） |
| 4 | 实现取消机制（用户中断对话） |
| 5 | 实现上下文压缩（token 超阈值时触发） |
| 6 | 前端对话界面（从 OpenCowork 搬，保留聊天 UI + 流式渲染） |

**验证标准**：选择已配置的 Provider 和模型 → 输入消息 → 流式看到模型回复 → 能中途取消。

---

### 迭代四：工具链（最小集）

**目标**：Agent 能调工具操作文件和执行命令。

| 步骤 | 内容 |
|------|------|
| 1 | 从 OpenCowork 搬入工具框架（ITool 基类、注册机制、Executor 模式） |
| 2 | 从 OpenCowork 搬入文件读写工具（FsRead / FsWrite / FsEdit） |
| 3 | 从 OpenCowork 搬入 Shell 执行工具（ShellRun / ShellKill） |
| 4 | 从 OpenCowork 搬入代码搜索工具（Grep / Glob） |
| 5 | 工具结果回传 Agent Loop，喂回模型继续循环 |
| 6 | 前端工具调用展示（从 OpenCowork 搬工具调用 UI） |

**验证标准**：让 Agent "读取某文件内容并总结"，Agent 能调 FsRead 拿到内容并回复。

---

### 迭代五：项目注册 + 会话历史

**目标**：能管理项目，对话有历史记录。

| 步骤 | 内容 |
|------|------|
| 1 | SQLite 扩表（projects / sessions / messages） |
| 2 | 实现项目注册（创建项目、指定工作区路径、切换项目） |
| 3 | 实现会话管理（创建会话、按项目关联、会话列表） |
| 4 | 实现消息持久化（对话实时写 SQLite，重开后能看历史） |
| 5 | 前端项目管理页面 + 会话列表（从 OpenCowork 搬并精简） |

**验证标准**：创建项目 → 开始对话 → 关闭应用 → 重开 → 能看到项目和历史对话。

---

### 迭代六：人格系统

**目标**：不同人格，输出风格不同。

| 步骤 | 内容 |
|------|------|
| 1 | 实现 Identity / Soul 文件读写（全局 + 项目级） |
| 2 | 实现 PersonaPreset 预设管理（内置 6 种 + 自定义） |
| 3 | 实现 PromptBuilder（分段组装 System Prompt + 字符预算） |
| 4 | System Prompt 构建从前端移到后端（runtime 侧组装） |
| 5 | 实现人格在最终输出时体现（输出层加工，不介入 Loop 决策） |
| 6 | 前端人格切换面板（选择/预览/自定义人格） |

**验证标准**：切换"极简执行者"和"深度分析师"两种人格，同一个问题得到风格明显不同的回答。

> **执行记录**：迭代六实际做了人格系统（原计划为记忆系统，执行顺序与迭代七对调）。8 个 Plan 全部完成。PromptBuilder 分段组装 System Prompt + 字符预算截断 + InjectSystemPrompt。Base Instruction 在迭代八中改为运行环境介绍而非身份定义。

---

### 迭代七：记忆系统

**目标**：记忆用上了，不是黑箱。

| 步骤 | 内容 |
|------|------|
| 1 | 实现工作区文件结构（~/.wishful-claw/ 全局 + .wishful-claw/ 项目级） |
| 2 | 实现 FTS5 搜索索引（记忆文件变更时同步更新索引） |
| 3 | 实现记忆主动回忆（TryInjectRecall：Loop 开始前自动检索注入） |
| 4 | 实现记忆工具（memory_read / memory_write / memory_search） |
| 5 | 实现记忆分层流转（sessions → topics → dormant → archive） |
| 6 | 实现记忆巩固 + HEARTBEAT 语义降级 |
| 7 | 前端记忆面板（可视化记忆文件、状态、搜索） |

**验证标准**：对话中告诉 Agent "记住我是前端工程师" → 关闭重开 → 新对话中 Agent 知道你是前端工程师（通过主动回忆注入，不是用户重新说）。

> **执行记录**：迭代七实际做了记忆系统（与迭代六对调）。8 个 Plan 全部完成。三层架构 Hot/Warm/Cold + FTS5。scope 隔离设计（global / project:{workingFolder}）。TryInjectRecall 注入为 User Message，标注 untrusted reference data。

---

### 迭代八：集成验证

**目标**：整体跑通，日常可用。

| 步骤 | 内容 |
|------|------|
| 1 | 全链路联调（项目 → 对话 → 工具 → 记忆 → 人格） |
| 2 | 错误处理和边界情况（网络断开、Provider 超时、文件不存在等） |
| 3 | 性能优化（大文件读取、长对话压缩、FTS 索引更新频率） |
| 4 | OpenCowork 前端减法（砍掉所有不需要的页面和组件） |
| 5 | 打包测试（electron-builder 打包 Windows 可执行文件） |

**验证标准**：日常使用一周，记忆持续有效，人格稳定，工具正常，无崩溃。

> **执行记录**：记忆系统全链路修复（FTS5外部内容表、触发器语法、参数绑定）、Worker进程防崩溃、日志等级控制、记忆工具预览UI、消息时间戳、历史消息加载修复、Agent Loop迭代限制去除、Base Instruction人格冲突修复。代码已合并到 main，旧开发分支已清理。打包测试未执行。

---

## 后续迭代（九~十五）

### 迭代九：输入框修复 + 提示词优化器 ✅ 已完成

**目标**：修复输入框底部 token 统计全为 0 的问题；实现提示词优化器功能。

| 步骤 | 内容 | 状态 |
|------|------|------|
| 1 | 提示词优化器实现 — 从 OpenCowork 移植 `optimizer.ts`，复用已有 `streamSidecarProviderTurn` + `usePromptOptimizer` hook | ✅ 完成 |
| 2 | Token 统计修复 — 前端 usage 数据链路排查修复 | ✅ 完成 |
| 3 | AGENTS.md 路径修正 — 参考项目路径从 `D:\gy\*` 更新为 `D:\claw\*` | ✅ 完成 |

> 执行记录：在 dev/iter-11 分支上完成，尚未合并 main。

---

### 迭代十：子 Agent（Sub-Agent）✅ 已完成

**目标**：实现子 Agent 的创建、执行、事件流和前端渲染。

| 步骤 | 内容 | 状态 |
|------|------|------|
| 1 | 后端子 Agent 生命周期管理 — `SubAgentExecutor.cs`，独立 runId，子 `AgentRuntimeRunState` | ✅ 完成 |
| 2 | Task 工具实现 — `TaskTool.cs` 定义 + `ToolCallProcessor` 拦截 → `SubAgentExecutor.ExecuteAsync` | ✅ 完成 |
| 3 | 子 Agent 事件流 — `sub_agent_start` / `sub_agent_end` 事件，`StreamEventModels` 扩展字段 | ✅ 完成 |
| 4 | 前端事件适配和渲染 — `handleEnvelope` 路由 `sub_agent_*` → `handleSubAgentEvent`，`SubAgentCard` 已有 | ✅ 完成 |
| 5 | 子 Agent 取消机制 — 父 CancellationToken → 子 state.Cancel | ✅ 完成 |
| 6 | 子 Agent 定义加载 — `~/.wishful-claw/agents/*.md` YAML frontmatter | ✅ 完成 |
| 7 | 深度限制 — max 2 层嵌套 | ✅ 完成 |
| 8 | 事件抑制机制 — `SuppressTransportEvents` + `EventObserver` 收集子 loop 文本 | ✅ 完成 |
| 9 | 示例定义 — reviewer.md, researcher.md | ✅ 完成 |
| 10 | 集成验证 — 实际对话测试 Task 工具触发子 Agent | ✅ 完成 |

> 执行记录：在 dev/iter-11 分支上完成。子 Agent 架构在迭代十一中做了五阶段深度增强（事件转发、上下文保持、步骤描述、审批交互、系统提示词引导）。

---

### 迭代十一：右侧面板 + 子 Agent 架构增强 + 终端/文件管理 ✅ 已完成（待合并 main）

**目标**：右侧面板动态 Tab 系统、子 Agent 架构五阶段增强、终端面板与文件管理快捷入口。

| Plan | 内容 | 状态 |
|------|------|------|
| 11-1 | 右侧面板 Tab 系统重构 — 动态 tab、拖拽调宽、tab 切换动画、浏览器持久化 | ✅ 完成 |
| 11-2 | SubAgentsPanel — 子 Agent 执行面板（列表 + 详情） | ✅ 完成 |
| 11-3 | BrowserPanel — 内置浏览器（webview + 地址栏导航） | ✅ 完成 |
| 11-4 | PreviewPanel — 文件预览面板（代码/Markdown/图片等多格式） | ✅ 完成 |
| 11-5 | AgentFilesPanel + SessionChangeReviewPanel — 文件目录 + 变更审查 | ✅ 完成 |
| 11-6 | 子 Agent 架构五阶段增强 — 事件转发、上下文保持、步骤描述、审批交互、系统提示词引导 | ✅ 完成 |
| 11-7 | 终端面板 — xterm.js 终端 + TitleBar 文件管理/终端快捷入口 | ✅ 完成 |
| 11-8 | 删除右侧面板默认 Activity/Memory tab | ✅ 完成 |

**遗留事项**：
- agent:changes 后端记录仍为 stub（变更审查面板无数据）
- 30+ 文件超 500 行需按 AGENTS.md 拆分
- Git push 需代理启动
- 迭代验证 + 合并 main 需用户确认

**验证标准**：tsc --noEmit + electron-vite build + dotnet build 全部通过。UI 交互待用户手动确认。

---

### 迭代十二：SSH 远程执行 + Agent 终端旁观

**目标**：Agent 能通过 SSH 连接到远程服务器执行命令，连接配置持久化复用，执行过程实时输出到终端面板供用户旁观。

**核心需求**：
- 用户配置一次 SSH 连接（host/user/密钥/密码），后续 Agent 自动复用，不需要重复认证
- Agent 调用 Bash 工具带 `sshConnectionId` 时，走 SSH 通道在远程服务器上执行
- 执行返回结构化结果（stdout/stderr/exitCode）给 Agent
- 执行过程实时推送到终端面板，用户可以旁观 Agent 的操作过程

#### 架构设计

```
Agent 调用 Bash(sshConnectionId=xxx, command="df -h")
    ↓
Worker: 判断有 sshConnectionId → 走远程执行
    ↓
Main: ssh:exec IPC → connection-manager 取长连接
    ↓
ssh2.Client.exec("df -h") → 拿到 stream
    ↓
stream.on('data') ──→ 拼接 stdout（结构化返回给 Agent）
                  └─→ IPC 推到前端终端面板（实时旁观）
    ↓
stream.on('close') ──→ { stdout, stderr, exitCode } 返回
```

#### Plan 拆分

**Plan 12-1：SSH 连接管理基础设施**

**目标**：建立 SSH 连接的存储、认证和连接池管理。

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | 安装 `ssh2` + `@types/ssh2` npm 依赖 | `package.json` |
| 2 | DB 建表 — `ssh_connections` 表（host/port/user/authType/加密密码/密钥路径等） | `DbClient.cs` 或手动建表 |
| 3 | Worker SSH DB CRUD — 搬入 `DbSshModels.cs` + `DbSshTools.cs`，适配 SqlSugar | `Modules/Db/DbSshTools.cs` |
| 4 | Main 进程 SSH 连接管理 — 从 OpenCowork 搬入 `connection-manager.ts`（精简版，去掉终端/sftp/传输），保留 `withSshConnection()` + `execSshCommand()` | `src/main/ssh/connection-manager.ts` |
| 5 | Main 进程 SSH 认证 — 从 OpenCowork 搬入 `auth.ts`（精简版，去掉 proxy jump），保留 `buildConnectConfig()` | `src/main/ssh/auth.ts` |
| 6 | Main 进程 SSH IPC 注册 — 注册 `ssh:connection:list/create/update/delete` + `ssh:exec` + `ssh:connect` + `ssh:disconnect` | `src/main/ipc/ssh-handlers.ts` |
| 7 | Main 进程 SSH DAO — 从 OpenCowork 搬入 `ssh-dao.ts`（通过 Worker DB 读写） | `src/main/db/ssh-dao.ts` |
| 8 | 移除 `ssh:connection:list` stub handler | `src/main/index.ts` |

**验证**：tsc + dotnet build 通过。能通过 IPC 创建 SSH 连接记录、建立 ssh2 连接、执行远程命令拿到 stdout。

---

**Plan 12-2：Agent SSH 工具执行器**

**目标**：Agent 调用 Bash/Read/Write 等工具时，如果带有 `sshConnectionId`，自动走 SSH 通道远程执行。

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | Worker SSH 工具执行器 — 从 OpenCowork 搬入 `AgentRuntimeSshToolExecutor.cs`（精简版），实现 `CanExecute()` + `ExecuteAsync()` | `AgentRuntime/AgentRuntimeSshToolExecutor.cs` |
| 2 | Worker SSH 协议桥接 — Main 进程收到 Worker 的 SSH 执行请求，转发到 `execSshCommand()` | `src/main/ipc/ssh-handlers.ts` |
| 3 | ToolCallProcessor 集成 — 工具调用时检测 `sshConnectionId` 参数，路由到 SSH 执行器 | `AgentRuntime/ToolCallProcessor.cs` |
| 4 | 系统提示词引导 — 告知 Agent 项目绑定了 SSH 连接，可用 `sshConnectionId` 参数远程执行 | `Persona/PromptBuilder.cs` |
| 5 | 项目 SSH 绑定 — 项目可关联一个 SSH 连接 ID（已有 `sshConnectionId` 字段），Agent 自动使用 | `DbProjectTools.cs` |

**验证**：配置 SSH 连接 → 项目绑定 → 对 Agent 说"查看服务器 CPU"→ Agent 通过 Bash 工具走 SSH 远程执行 `top` 等命令 → 返回结构化结果。

---

**Plan 12-3：Agent 终端旁观模式**

**目标**：Agent 通过 SSH 执行命令时，执行过程实时输出到终端面板，用户可以旁观。

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | execSshCommand 增加实时输出回调 — `stream.on('data')` 时同时推送到 IPC 事件 | `src/main/ssh/connection-manager.ts` 或 `sftp-service.ts` |
| 2 | IPC 事件 `ssh:exec-output` — 推送实时输出 chunk 到前端 | `src/renderer/src/lib/ipc/channels.ts` |
| 3 | TerminalPanel 增加 Agent 旁观 tab — 只读 xterm，显示 Agent 执行的命令 + 实时输出 | `src/renderer/src/components/terminal/TerminalPanel.tsx` |
| 4 | 命令执行开始/结束标记 — 在终端中显示 `~$ df -h` 命令行，执行完显示退出码 | 同上 |
| 5 | 自动切换到 Agent tab — Agent 开始远程执行时，终端面板自动切换到 Agent 旁观 tab | `TerminalPanel.tsx` + `ui-store` |

**验证**：Agent 通过 SSH 执行命令时，终端面板自动出现 Agent tab，实时显示命令和输出，命令结束后输出停在屏幕上可回看。Agent 同时拿到结构化 stdout/stderr/exitCode。

---

**Plan 12-4：SSH 连接管理 UI**

**目标**：前端提供 SSH 连接的增删改查界面，用户可配置和管理 SSH 连接。

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | SSH 连接管理面板 — 从 OpenCowork 搬入 `SshConnectionList` + `SshConnectionCard` + `SshConnectionDetail`（精简） | `components/ssh/` |
| 2 | SSH 连接创建/编辑表单 — host/port/user/authType/password/privateKey | `components/ssh/SshConnectionDialog.tsx` |
| 3 | 项目设置中绑定 SSH 连接 — 项目设置页面可选择已配置的 SSH 连接 | `components/settings/` |
| 4 | 密码加密存储 — 使用 Electron `safeStorage` 加密密码/密钥短语 | `src/main/ssh/repository.ts` |
| 5 | 连接测试 — 配置后可测试 SSH 连接是否可用 | `src/main/ssh/auth.ts` |

**验证**：在设置页面添加 SSH 连接 → 测试连通性 → 项目绑定该连接 → Agent 对话中自动使用该连接远程执行命令。

#### 技术要点

- **长连接复用**：`connection-manager.ts` 维护 `Map<connectionId, ssh2.Client>` 连接池，keepalive 保活，断线自动重连
- **结构化返回**：`client.exec()` 非交互式执行，等 `close` 事件拿 stdout/stderr/exitCode，与交互式 PTY 终端完全不同
- **实时旁观**：`stream.on('data')` 的 chunk 同时推送到前端终端面板（只读 xterm），不影响结构化收集
- **密码安全**：密码/密钥短语用 Electron `safeStorage` 加密后存 DB，明文不出 main 进程
- **精简范围**：不搬 SFTP 文件传输、SSH 终端（SshTerminal）、端口转发、proxy jump、OpenSSH config 导入，只做 exec 执行
- **参考来源**：OpenCowork `src/main/ssh/`（connection-manager/auth/repository/sftp-service）+ `AgentRuntimeSshToolExecutor.cs`

---

### 迭代十三：聊天窗渲染调整（参考灵犀）

**目标**：优化聊天交互的视觉和交互体验，参考灵犀的聊天窗设计。

| 步骤 | 内容 |
|------|------|
| 1 | 工具调用卡片的折叠/展开交互优化 |
| 2 | Thinking block 展示优化（折叠默认、可展开） |
| 3 | 消息间距和视觉层次调整 |
| 4 | Agent Loop 多轮迭代的展示方式调整（当前平铺在一条消息内，评估是否调整为分段展示） |

**验证标准**：聊天界面交互流畅，工具调用和思考过程可折叠/展开，多轮迭代清晰可辨。

---

### 迭代十四：Skill 市场

**目标**：实现 Skill 的安装/卸载/列表管理和在线市场。

| 步骤 | 内容 |
|------|------|
| 1 | SKILL.md 解析和工具注册 — 读取 Skill 目录下的 SKILL.md，解析工具定义并注册到 ToolRegistry |
| 2 | Skill 安装/卸载/列表管理 — 复用已有 `SkillsMenu` 组件和 `skills-store` |
| 3 | 在线 Skill 市场浏览和安装 — 对接 Skill 仓库 API，浏览/搜索/安装 |

**验证标准**：从 Skill 市场安装一个 Skill → Agent 对话中能使用该 Skill 提供的工具 → 卸载后工具不可用。

---

### 迭代十五：MCP 管理

**目标**：实现 MCP Server 的配置管理和工具调用。

| 步骤 | 内容 |
|------|------|
| 1 | MCP Server 配置管理 — 复用已有 `mcp-store`，实现增删改查 |
| 2 | MCP 工具动态注册和调用 — MCP Server 启动后自动发现工具并注册 |
| 3 | MCP 状态监控 — 连接状态、工具列表、调用日志 |

**验证标准**：配置一个 MCP Server → 启动后自动发现其工具 → Agent 对话中能调用 MCP 工具 → 停止后工具不可用。

---

## MVP v2 阶段迭代（v2-iter-1 ~ v2-iter-9）

> MVP v1（迭代一~十五）已全部合并 main，tag `v0.15.0`。以下为 MVP v2 阶段的迭代拆分，分支命名 `dev/v2-iter-{N}`，tag 命名 `v2.{N}.0`。详细需求见 `docs/mvp-v2.md`。

### v2-iter-1：Runtime 分层架构重构

**目标**：Worker 项目从 192 文件/29k 行的巨型项目拆分为 `WishfulClaw.Agent` + `WishfulClaw.Persona`，Worker 回归薄层 IPC 宿主。为后续所有功能开发打基础。

| 步骤 | 内容 |
|------|------|
| 1 | 创建 `WishfulClaw.Agent` 项目，将 AgentRuntime（60 文件）迁入：AgentLoop、所有 Executor、Provider、ConversationCodec、ContextCompression、ToolCallProcessor、SubAgent |
| 2 | 创建 `WishfulClaw.Persona` 项目，将 Persona（9 文件）迁入：PromptBuilder、PersonaGenerator、PersonaStore |
| 3 | Core 上提：ToolSchemaBuilder、ToolDefinitionPlaceholder、ToolModuleState 从 Worker 移到 Core |
| 4 | Worker 精简：仅保留 IPC 宿主 + Module 装载 + Program.cs |
| 5 | Contracts 精简：只留接口，JSON 序列化实现移到 Core 或 Worker |
| 6 | 更新 sln 引用关系，确保分层依赖正确（Agent → Core + Contracts；Persona → Core + Contracts；Worker → Agent + Persona + Core + Contracts） |
| 7 | 双编译验证：`dotnet build` + `npx tsc --noEmit -p tsconfig.web.json` 零错误 |

**验证标准**：编译通过，应用启动正常，核心对话 + 工具调用 + 记忆 + 人格全链路功能不回归。

**分支**：`dev/v2-iter-1`　**Tag**：`v2.1.0`　**状态**：✅ 已完成

---

### v2-iter-2：缓存命中率修复

**目标**：C# 端维护 conversation 状态，每轮只接收增量消息，消除全量重建导致的 prefix cache miss。同一会话缓存命中率稳定在 90%+。

| 步骤 | 内容 |
|------|------|
| 1 | C# 端 conversation 状态管理 — `AgentLoop.cs` 的 `ReadWireConversation` → `ReadConversation` 改为增量追加模式 |
| 2 | 渲染端 `use-chat-actions.ts` 改为只发送增量消息（新增的 user message + tool results），不再全量重建 history |
| 3 | `buildRuntimeReminder` 稳定化 — 动态内容注入到 user 消息前缀，确保不破坏前缀缓存 |
| 4 | `InjectTimestampPrefix` 调整 — 时间戳精度降低或移到不影响缓存的位置 |
| 5 | `cache_control` 断点优化 — 评估是否移除显式断点，依赖 Anthropic 自动前缀缓存 |
| 6 | 边界处理：session 切换时重置 conversation 状态、context compression 时重建前缀 |
| 7 | 缓存命中率指标验证 — 连续多轮对话观察 cache_read/cache_creation 比例 |

**验证标准**：同一会话连续 5 轮对话，缓存命中率稳定在 90%+，不再因全量重建导致跳动。

**分支**：`dev/v2-iter-2`　**Tag**：`v2.2.0`　**状态**：✅ 已完成

> 执行记录：12 步骤全部完成。SessionConversation per-session 状态管理、增量消息发送、prefix cache 断点优化（messages[last] 而非 tools[last]）、时间戳分钟级精度。额外完成：LLM 总结式上下文压缩（参考 Reasonix compact.go，7 段式结构化 briefing + PlanCompaction 分区折叠 + 90s 超时重试）、压缩设置 UI（Switch + Slider 30%-90%）、版本号单一来源（app-version.ts 从 package.json 读取）、全局 OpenCowork → WishfulClaw 名称替换（56 前端文件 87 处 + 49 C# 文件 55 处）。5 个 commit 在 dev/v2-iter-2 分支。

---

### v2-iter-3：Infrastructure 层拆分

**目标**：新建 `WishfulClaw.Infrastructure` 项目，将 Db/Storage/Http 基础设施从 Worker 和 Agent 下沉，使 Worker 能进一步拆分 Tools 等模块。Worker 文件数从 113 降至 ~30。

| 步骤 | 内容 |
|------|------|
| 1 | 创建 `WishfulClaw.Infrastructure` 项目，配置 csproj 引用 Contracts + Core |
| 2 | 搬入 Db — `DbClient.cs` + `Entities/` 从 Worker/Modules/Db 迁入 Infrastructure/Db |
| 3 | 搬入 Storage — `ConfigStore.cs` + `ProviderStore.cs` + `JsonFileNodeCache.cs` 从 Worker 迁入 Infrastructure/Storage |
| 4 | 搬入 Http — `WorkerHttpClientFactory.cs` 从 Agent 迁入 Infrastructure/Http |
| 5 | 更新引用关系 — Agent 引用 Infrastructure；Worker 引用 Infrastructure；Worker 中的 Db Module 改为调用 Infrastructure |
| 6 | Worker 模块瘦身 — 将 FileTools / SearchTools / ShellTools / Providers 等工具实现迁出 Worker（迁入 Agent 或独立项目） |
| 7 | 更新 sln 引用关系，确保分层依赖正确（Contracts → Core → Infrastructure → Workspace → Persona → Agent → Worker） |
| 8 | 双编译验证：`dotnet build` + `npx tsc --noEmit -p tsconfig.web.json` 零错误 |
| 9 | 功能回归验证 — 核心对话 + 工具调用 + 记忆 + 人格 + DB 读写全链路不回归 |

**验证标准**：编译通过，应用启动正常，全链路功能不回归。Worker 文件数降至 ~30。Infrastructure 层独立可引用。

**分支**：`dev/v2-iter-3`　**Tag**：`v2.3.0`

---

### v2-iter-4：Skill 本地文件安装测试

**目标**：端到端验证 Skill 从本地文件夹安装 → Agent 使用 → 卸载的完整链路。

| 步骤 | 内容 |
|------|------|
| 1 | 端到端测试：选择包含 SKILL.md 的本地文件夹 → 安装成功 → 已安装列表出现 |
| 2 | 安全扫描验证：安装前危险命令/网络外发检测正常触发 |
| 3 | Agent 使用验证：安装后 Agent 对话中能调用该 Skill 提供的工具 |
| 4 | 卸载验证：卸载后工具从 ToolRegistry 移除，Agent 不再可用 |
| 5 | 修复测试中发现的问题 |

**验证标准**：从本地文件夹安装 Skill → Agent 能使用该 Skill 工具 → 卸载后工具不可用，全链路无手动干预。

**分支**：`dev/v2-iter-4`　**Tag**：`v2.4.0`

---

### v2-iter-5：渠道配置测试与完善

**目标**：OpenAI 兼容 + Anthropic 全链路验证通过，清理不兼容或过时的预设。

| 步骤 | 内容 |
|------|------|
| 1 | OpenAI 兼容渠道验证：API Key + Base URL 配置 → 连通性测试 → 模型列表拉取 → 实际对话 |
| 2 | Anthropic 渠道验证：同上全链路 |
| 3 | 中转商渠道验证：验证 stream_options.include_usage 是否返回 token 统计 |
| 4 | 不兼容或过时预设清理 |
| 5 | 修复测试中发现的问题 |

**验证标准**：至少 2 种渠道（OpenAI 兼容 + Anthropic）配置 → 连通性测试 → 模型列表 → 实际对话，全链路通过。

**分支**：`dev/v2-iter-5`　**Tag**：`v2.5.0`

---

### v2-iter-6：SSH 远程执行测试与完善

**目标**：SSH 连接 → 项目绑定 → Agent 远程执行 → 终端旁观，全链路通过。

| 步骤 | 内容 |
|------|------|
| 1 | SSH 连接创建验证：配置 host/port/user/authType → 密码或密钥认证 → 连接测试通过 |
| 2 | 项目绑定验证：项目设置关联 connectionId → Agent 自动使用 |
| 3 | Agent 远程执行验证：Bash 工具带 sshConnectionId 走 SSH 通道 → 返回结构化 stdout/stderr/exitCode |
| 4 | 终端旁观验证：Agent SSH 执行时终端面板实时显示命令和输出 |
| 5 | 长连接复用验证：多次命令执行复用同一连接，断线重连 |
| 6 | 修复测试中发现的问题 |

**验证标准**：配置 SSH 连接 → 项目绑定 → Agent 远程执行 → 终端旁观，全链路无手动干预。

**分支**：`dev/v2-iter-6`　**Tag**：`v2.6.0`

---

### v2-iter-7：主聊天接入工作台模式

**目标**：借鉴灵犀的工作台模式——聊天窗内工具执行过程折叠为摘要块，完整预览移至右侧面板"工作台" tab，实现聊天流清爽 + 执行详情分离。

| 步骤 | 内容 |
|------|------|
| 1 | 新建折叠摘要组件 — Agent 执行工具/命令后，聊天消息内不再内联渲染 ToolCallCard 详情，而是显示折叠块（"运行了XX个命令，查看了X个文件，编辑了X个文件"），下方接 Agent 回复正文 |
| 2 | ToolCallCard 迁移至右侧工作台 — 完整的工具调用预览（命令输出、文件 diff 等）从聊天流移到 RightPanel 新增的"工作台" tab |
| 3 | 工作台会话级隔离 — 切换会话时工作台内容跟随切换，按 sessionId 存储 |
| 4 | 折叠触发时机 — 执行了命令/工具即折叠，或 Agent Loop 超过 2 轮后折叠 |
| 5 | 保留现有执行后操作按钮（debug 等） |

**验证标准**：发送消息 → Agent 执行工具 → 聊天窗显示折叠摘要 + Agent 回复（不内联预览）→ 右侧工作台 tab 展示完整工具调用详情 → 切换会话工作台内容跟随隔离。

**分支**：`dev/v2-iter-7`　**Tag**：`v2.7.0`

---

### v2-iter-8：Global 全局模式接入

**目标**：不绑定项目的通用助手模式，Agent 以通用身份工作。

| 步骤 | 内容 |
|------|------|
| 1 | 全局模式定义 — 不绑定特定项目/工作区，Agent 以通用助手身份工作 |
| 2 | 新建会话时可选"全局模式"或"项目模式" |
| 3 | 全局模式下工具调用不受工作区限制 |
| 4 | 前端 UI 提供模式切换入口 |
| 5 | 与工作台模式的切换逻辑复用 |

**验证标准**：新建会话选择全局模式 → Agent 不绑定项目也能正常对话和调工具 → 可随时切换回项目模式。

**分支**：`dev/v2-iter-8`　**Tag**：`v2.8.0`

---

### v2-iter-9：Goal 模式接入

**目标**：用户设定目标后，Agent 自主拆解 → 执行 → 自检 → 继续，直到目标达成或用户中止。

| 步骤 | 内容 |
|------|------|
| 1 | Goal 状态机实现 — 在现有 Agent Loop 基础上增加 Goal 状态机（plan → execute → verify → continue/adjust） |
| 2 | Goal 持久化 — 会话级 Goal 状态存储（目标文本 + 子任务列表 + 完成状态） |
| 3 | 系统提示词注入 — Goal 模式下注入"你正在执行 Goal 模式，当前目标：{goal}，已完成：{done}，待完成：{todo}"引导 |
| 4 | 前端 Goal 进度面板 — 子任务列表 + 状态标记 + 实时日志 |
| 5 | 可中断机制 — 用户随时可暂停或中止 Goal 执行 |
| 6 | 自检机制 — 每个子任务完成后 Agent 自我评估是否达标，不达标则重试或调整方案 |
| 7 | 与工作台模式协同 — Goal 模式下 Agent 在指定工作区内自主操作 |

**验证标准**：设定目标（如"修复所有 TypeScript 编译错误"）→ Agent 自主拆解执行 → 进度面板实时更新 → 可中断 → 目标达成或用户中止。

**分支**：`dev/v2-iter-9`　**Tag**：`v2.9.0`

---

## 迭代依赖关系

```
=== MVP v1（已完成，已合并 main，tag v0.15.0）===
迭代一（骨架）→ 二（Provider）→ 三（Agent Loop）→ 四（工具链）→ 五（项目+会话）
  → 六（人格）→ 七（记忆）→ 八（集成验证）
  → 九（输入框修复 + 提示词优化器）→ 十（子 Agent）
  → 十一（右侧面板 + 子 Agent 架构增强 + 终端/文件管理）
  → 十二（SSH 远程执行 + Agent 终端旁观）
  → 十三（聊天窗渲染调整）→ 十四（Skill 市场）→ 十五（MCP 管理）

=== MVP v2（进行中）===
v2-iter-1（Runtime 分层架构重构）✅
  ↓
v2-iter-2（缓存命中率修复）✅
  ↓
v2-iter-3（Infrastructure 层拆分）✅
  ↓
v2-iter-4（Skill 本地文件安装测试）  ┐
v2-iter-5（渠道配置测试与完善）      ├─ 三者可并行，互不依赖，均已完成 ✅
v2-iter-6（SSH 远程执行测试与完善）  ┘
  ↓
v2-iter-7（主聊天接入工作台模式）  ← 当前最高优先级，无前置依赖
  ↓
v2-iter-8（Global 全局模式接入）  ← 依赖工作台 UI（右侧面板 + 折叠交互复用）
  ↓
v2-iter-9（Goal 模式接入）  ← 依赖工作台 UI（Agent 自主操作的展示框架）
```

v2-iter-1 ~ v2-iter-6 已全部完成（tag v2.6.0）。
v2-iter-7（主聊天接入工作台模式）是当前最高优先级——聊天 UI 重构 + 工具调用预览迁移到右侧工作台。
v2-iter-8 和 v2-iter-9 依赖 v2-iter-7 的工作台 UI 框架。
