# MVP v2 计划

> MVP v1（迭代一~十五）完成后，本文件规划 v2 阶段待办事项。

## 背景

MVP v1 核心链路：Agent Loop + 工具链 + 记忆 + 人格 + Skill 市场 + MCP 管理（迭代十五）。

MVP v2 目标：补齐测试、完善模式接入、新增 Goal 自主执行能力。

## 待办事项

### 1. Skill 本地文件安装测试

**现状**：迭代十四已实现从文件夹安装的代码路径（`fs:select-folder` → `addSkillFromFolder` → `SkillScanEngine.Scan` → 复制到 `~/.agents/skills/`），但未做端到端运行时验证。

**验证内容**：
- 选择一个包含 SKILL.md 的本地文件夹 → 安装成功 → 已安装列表出现 → Agent 能使用该 Skill 工具
- 安装前安全扫描正常触发（危险命令/网络外发检测）
- 卸载后工具从 ToolRegistry 移除

### 2. 渠道配置测试与完善

**现状**：Provider 配置框架已搬入（迭代二），预设渠道对齐 OpenCowork，但实际连通性和功能未做全面测试。

**验证内容**：
- OpenAI 兼容渠道：API Key + Base URL 配置 → 连通性测试 → 模型列表拉取 → 实际对话
- Anthropic 渠道：同上
- 中转商渠道（如有）：验证 stream_options.include_usage 是否返回 token 统计
- OAuth 类型渠道：如有需要，验证流程
- 不兼容或过时的预设清理

### 3. SSH 远程执行测试与完善

**现状**：迭代十二已实现 SSH 连接管理（connection-manager / auth / repository）、DB 建表 + CRUD、Main 进程 SSH IPC 注册、AgentRuntimeSshToolExecutor 精简版、密码 safeStorage 加密，但整体未做端到端运行时验证。

**验证内容**：
- SSH 连接创建：配置 host/port/user/authType → 密码或密钥认证 → 连接测试通过
- 项目绑定 SSH 连接：项目设置关联 connectionId → Agent 自动使用
- Agent 远程执行：通过 Bash 工具带 sshConnectionId 走 SSH 通道 → 返回结构化 stdout/stderr/exitCode
- 终端旁观模式：Agent SSH 执行时终端面板实时显示命令和输出
- 长连接复用：多次命令执行复用同一连接，断线重连

### 4. 主聊天接入工作台模式

**现状**：当前聊天仅有普通对话模式，工作台模式（Workbench Mode）尚未接入主聊天界面。

**需求**：
- 工作台模式 = Agent 在指定工作区目录下执行任务，工具调用绑定到该目录
- 主聊天界面可选择/切换工作台模式
- 与项目注册关联：选择项目即绑定工作区路径
- Agent 系统提示词注入工作区信息

### 5. Global 全局模式接入

**现状**：当前会话必须绑定项目，缺少不绑定项目的全局模式。

**需求**：
- 全局模式 = 不绑定特定项目/工作区，Agent 以通用助手身份工作
- 新建会话时可选"全局模式"或"项目模式"
- 全局模式下工具调用不受工作区限制
- 前端 UI 提供模式切换入口

### 6. Goal 模式接入

**现状**：当前 Agent Loop 是单轮对话驱动——用户说一句、Agent 做一步、回一句，缺乏长时域自主执行能力。前端已有 `hideGoalSessionBar` 等接口预留，但 Goal 模式核心逻辑未实现。

**参考来源**：OpenAI Codex CLI `/goal` 模式（v0.128.0，2026 年 5 月发布），开源仓库 `github.com/openai/codex`，Rust 实现，MIT 协议。底层模型 codex-1 闭源，但 Agent Loop 工程实现可参考。

**Codex /goal 核心思路**：
- 用户设定一个目标（如"修复所有 TypeScript 编译错误"）
- Agent 自动拆分子任务、自己执行、自己 review
- 目标在多轮对话里持续存在，不达成不停止
- 可无人值守运行数小时
- 本质是 Ralph Loop 的一种工程实现

**需求**：
- Goal 模式 = 用户设定目标后，Agent 自主拆解 → 执行 → 自检 → 继续，直到目标达成或用户中止
- Goal 持久化：目标写入会话状态，跨多轮对话持续存在
- 进度展示：前端实时显示当前子任务、已完成步骤、整体进度
- 可中断：用户随时可暂停或中止 Goal 执行
- 与工作台模式协同：Goal 模式下 Agent 在指定工作区内自主操作
- 自检机制：每个子任务完成后 Agent 自我评估是否达标，不达标则重试或调整方案

**技术要点**：
- Agent Loop 扩展：在现有 Loop 基础上增加 Goal 状态机（plan → execute → verify → continue/adjust）
- Goal 持久化：会话级 Goal 状态存储（目标文本 + 子任务列表 + 完成状态）
- 系统提示词注入：Goal 模式下注入"你正在执行 Goal 模式，当前目标：{goal}，已完成：{done}，待完成：{todo}"引导
- 前端 Goal 进度面板：子任务列表 + 状态标记 + 实时日志

### 7. Runtime 分层架构重构

**现状**：Worker 项目承载了 90% 代码（192 文件/29k 行），Contracts（4 文件/197 行）、Core（17 文件/2,386 行）、Workspace（11 文件/729 行）过薄。大量本该独立的领域逻辑被塞进 Worker。

**问题**：
- AgentRuntime（60 文件）：AgentLoop、所有 Executor、Provider（OpenAI/Anthropic SSE parser）、ConversationCodec、ContextCompression、ToolCallProcessor、SubAgent 等 — agent 引擎核心不是 Worker IPC 宿主
- Persona（9 文件）：PromptBuilder、PersonaGenerator、PersonaStore 等 — 领域逻辑
- Tools 抽象：ToolSchemaBuilder、ToolDefinitionPlaceholder、ToolModuleState — 框架代码应在 Core
- Modules 整块：DB/Git/Skills/Extensions/Channels/Video/Audio 等 — 每个是独立功能域

**重构方向**：
- `WishfulClaw.Agent`：从 Worker/AgentRuntime 独立，包含 AgentLoop、所有 Executor、Provider、ConversationCodec、ContextCompression、ToolCallProcessor、SubAgent
- `WishfulClaw.Persona`：从 Worker/Persona 独立，PromptBuilder、PersonaGenerator、PersonaStore
- Core 上提：ToolSchemaBuilder、ToolDefinitionPlaceholder、ToolModuleState 移到 Core
- Worker 回归薄层：仅保留 IPC 宿主 + Module 装载 + Program.cs
- Contracts 精简：WorkerResponse 的 JSON 序列化实现移到 Core 或 Worker，Contracts 只留接口

### 8. 缓存命中率修复 — C# 端维护 conversation 状态

**现状**：缓存命中率在 31%~99% 之间剧烈跳动，同一会话连续两轮请求命中率差异可达 50%+。

**根因**：无状态架构 — 每轮全量重建消息历史。渲染端 `use-chat-actions.ts` 每轮从 session.messages 全量构建 historyMessages 发给 C# Worker，Worker 再序列化为 provider 请求。只要重建过程中有任何 byte 差异（JSON 字段顺序、空格、数字精度、tool output 格式化差异等），Anthropic 前缀缓存就 miss。

**对比 Reasonix**：Reasonix 的 sidecar 是长驻进程，内存中维护 conversation，每轮只追加新消息，前缀天然 byte-stable，缓存命中率接近 100%。

**次要因素**：
- `buildRuntimeReminder` 每轮变化（task 状态、goal 状态、MCP server 数量等注入到最后一条 user message）
- `InjectTimestampPrefix` 每秒都变的时间戳
- `cache_control` 断点设置差异（我们设了显式断点，Reasonix 不设，依赖 Anthropic 自动前缀缓存）

**修复方向**：
- 在 C# 端维护 conversation 状态，每轮只接收增量消息（新增的 user message + tool results），而不是全量重建
- `AgentLoop.cs` 的 `ReadWireConversation` → `ReadConversation` 逻辑改为增量追加
- 渲染端 `use-chat-actions.ts` 改为只发送增量消息
- 需要处理 session 切换、context compression 等边界情况

## 执行顺序

```
1. Runtime 分层架构重构       ← 优先执行，为后续所有功能开发打基础
2. 缓存命中率修复             ← 依赖架构重构（C# 端 conversation 状态管理）
3. Skill 本地文件安装测试     ← 可与 4、5 并行
4. 渠道配置测试与完善         ← 可与 3、5 并行
5. SSH 远程执行测试与完善     ← 可与 3、4 并行
6. 主聊天接入工作台模式       ← 依赖渠道配置验证通过
7. Global 全局模式接入        ← 依赖工作台模式（模式切换 UI 复用）
8. Goal 模式接入              ← 依赖工作台模式（Agent 需绑定工作区自主操作）
```

## MVP v2 完成标准

```
1. Worker 拆分为 WishfulClaw.Agent / WishfulClaw.Persona，Worker 回归薄层 IPC 宿主
2. 同一会话缓存命中率稳定在 90%+，不再因打字或全量重建导致跳动
3. Skill 从本地文件夹安装可用，卸载干净
4. 至少 2 种渠道（OpenAI 兼容 + Anthropic）配置 → 对话全链路验证通过
5. SSH 连接配置 → 项目绑定 → Agent 远程执行 → 终端旁观，全链路通过
6. 主聊天支持工作台模式，Agent 在指定工作区下执行任务
7. 全局模式可用，不绑定项目也能正常对话和调工具
8. Goal 模式可用，设定目标后 Agent 自主拆解执行，可中断，有进度展示
```
