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

**用户确认完结后，Agent 执行收尾**：
```bash
# 打 tag
git tag -a v0.{N}.0 -m "迭代{N}: {迭代名称} - 验证通过"

# 合并到 main
git checkout main
git merge dev/iter-{N} --no-ff -m "merge: 迭代{N} - {迭代名称}"

# 推送远程
git push origin main
git push origin v0.{N}.0

# 删除迭代分支
git branch -d dev/iter-{N}
git push origin --delete dev/iter-{N}
```

**更新 `docs/PROGRESS.md`**（状态 + VERDICT + Commit ID + Tag + 日期）

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

## 后续迭代（九~十三）

### 迭代九：输入框修复 + 提示词优化器

**目标**：修复输入框底部 token 统计全为 0 的问题；实现提示词优化器功能。

| 步骤 | 内容 |
|------|------|
| 1 | 提示词优化器实现 — 从 OpenCowork 移植 `optimizer.ts`，复用已有 `streamSidecarProviderTurn` + `usePromptOptimizer` hook。当前 optimizer.ts 是空壳 stub |
| 2 | Token 统计修复 — 排查 usage 是否为 null（疑似中转商不支持 `stream_options.include_usage`）。若确认无 usage 返回，后端做 fallback 估算 |
| 3 | AGENTS.md 路径修正 — 参考项目路径从 `D:\gy\*` 更新为 `D:\claw\*`（笔记本实际路径） |

**验证标准**：
- 提示词优化器：输入框输入文本 → 点击优化按钮 → 看到 1-3 个优化方案 → 选择后替换输入框内容
- Token 统计：对话过程中输入框底部实时显示 input/output token 数量（非全 0）

**技术要点**：
- 提示词优化器：OpenCowork 方案是用 `streamSidecarProviderTurn`（`providerTurnOnly: true`）做单轮 LLM 调用，给模型提供 `WriteOptimizedPrompts` 工具返回 1-3 个优化方案。wishful-claw 已有 `streamSidecarProviderTurn`，可直接复用
- Token 统计：数据链路（C# Worker → MessagePack 编码 → IPC → 前端解码 → chat-store → ComposerRuntimeStatus）代码逻辑无误，最可能是中转商不返回 usage。需加日志确认

---

### 迭代十：子 Agent（Sub-Agent）✅ 进行中

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
| 10 | 集成验证 — 实际对话测试 Task 工具触发子 Agent | ⏳ 待验证 |

**验证标准**：主 Agent 在对话中通过 Task 工具启动子 Agent 执行子任务 → 前端展示子 Agent 运行状态 → 子 Agent 完成后结果回传主 Agent 继续。

**参考来源**：OpenCowork `AgentRuntimeSubAgentExecutor.cs`、Reasonix `task.go`

---

### 迭代十一：聊天窗渲染调整（参考灵犀）

**目标**：优化聊天交互的视觉和交互体验，参考灵犀的聊天窗设计。

| 步骤 | 内容 |
|------|------|
| 1 | 工具调用卡片的折叠/展开交互优化 |
| 2 | Thinking block 展示优化（折叠默认、可展开） |
| 3 | 消息间距和视觉层次调整 |
| 4 | Agent Loop 多轮迭代的展示方式调整（当前平铺在一条消息内，评估是否调整为分段展示） |

**验证标准**：聊天界面交互流畅，工具调用和思考过程可折叠/展开，多轮迭代清晰可辨。

---

### 迭代十二：Skill 市场

**目标**：实现 Skill 的安装/卸载/列表管理和在线市场。

| 步骤 | 内容 |
|------|------|
| 1 | SKILL.md 解析和工具注册 — 读取 Skill 目录下的 SKILL.md，解析工具定义并注册到 ToolRegistry |
| 2 | Skill 安装/卸载/列表管理 — 复用已有 `SkillsMenu` 组件和 `skills-store` |
| 3 | 在线 Skill 市场浏览和安装 — 对接 Skill 仓库 API，浏览/搜索/安装 |

**验证标准**：从 Skill 市场安装一个 Skill → Agent 对话中能使用该 Skill 提供的工具 → 卸载后工具不可用。

---

### 迭代十三：MCP 管理

**目标**：实现 MCP Server 的配置管理和工具调用。

| 步骤 | 内容 |
|------|------|
| 1 | MCP Server 配置管理 — 复用已有 `mcp-store`，实现增删改查 |
| 2 | MCP 工具动态注册和调用 — MCP Server 启动后自动发现工具并注册 |
| 3 | MCP 状态监控 — 连接状态、工具列表、调用日志 |

**验证标准**：配置一个 MCP Server → 启动后自动发现其工具 → Agent 对话中能调用 MCP 工具 → 停止后工具不可用。

---

## 迭代依赖关系

```
已完成
迭代一（骨架）
  ↓
迭代二（AI 服务商 + 模型管理）
  ↓
迭代三（Agent Loop + 对话）
  ↓
迭代四（工具链）
  ↓
迭代五（项目注册 + 会话）
  ↓
迭代六（人格系统）
  ↓
迭代七（记忆系统）
  ↓
迭代八（集成验证）

后续
迭代九（输入框修复 + 提示词优化器）  ← 当前最高优先级
  ↓
迭代十（子 Agent）  ← 功能扩展核心方向
  ↓
迭代十一（聊天窗渲染调整）  ← 可与迭代十穿插
  ↓
迭代十二（Skill 市场）  ← 生态扩展
  ↓
迭代十三（MCP 管理）  ← 生态扩展
```

迭代十和迭代十一可以部分并行（渲染调整不依赖子 Agent 后端）。
迭代十二和迭代十三可以并行（Skill 和 MCP 是独立生态）。
