# Wishful Claw 迭代计划

基于 MVP 边界，拆分为 8 个迭代，每个迭代独立可验证。

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

---

## 迭代一：项目骨架

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

**建议 Plan 拆分**：

| Plan | 内容 | 独立验证 |
|------|------|----------|
| 1.1 | .NET 工程搭建（sln + 4 项目 + 基础脚手架 + Worker Program.cs） | `dotnet build` 通过 |
| 1.2 | Electron + React 前端工程搭建（参考 OpenCowork 脚手架 + 目录结构） | `npm run dev` 能启动 |
| 1.3 | IPC 通信打通（Worker 进程拉起 + MessagePack 协议 + ping/pong） | 前端发 ping 后端回 pong |

---

## 迭代二：AI 服务商 + 模型管理

**目标**：能配置 Provider，选择模型，为后续对话做准备。

| 步骤 | 内容 |
|------|------|
| 1 | 从 OpenCowork 搬入 Provider 配置框架（API Key 管理、Base URL、模型列表、配置字段等，直接用） |
| 2 | 清理 routin.ai 相关私货（预设端点、模型预设、token 中转硬编码），其余全部保留 |
| 3 | 实现模型配置存储（Provider 列表、模型列表、默认模型，存 SQLite） |
| 4 | 前端 Provider 设置页面（直接用 OpenCowork 的，只删 routin.ai 相关内容） |
| 5 | 实现模型连通性测试（配置后能验证 API 是否可用） |

**验证标准**：添加一个 OpenAI 兼容 Provider → 填 API Key 和 Base URL → 测试连通性通过 → 能看到可用模型列表。

**注意**：OpenCowork 的 Provider 配置字段和页面非常全面，直接搬用。唯一需要处理的是清理 routin.ai 相关的私货（预设端点、模型预设、token 中转硬编码），其余全部保留，不重新造轮子。

---

## 迭代三：Agent Loop + 对话

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

## 迭代四：工具链（最小集）

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

## 迭代五：项目注册 + 会话历史

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

## 迭代六：记忆系统

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

---

## 迭代七：人格系统

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

---

## 迭代八：集成验证

**目标**：整体跑通，日常可用。

| 步骤 | 内容 |
|------|------|
| 1 | 全链路联调（项目 → 对话 → 工具 → 记忆 → 人格） |
| 2 | 错误处理和边界情况（网络断开、Provider 超时、文件不存在等） |
| 3 | 性能优化（大文件读取、长对话压缩、FTS 索引更新频率） |
| 4 | OpenCowork 前端减法（砍掉所有不需要的页面和组件） |
| 5 | 打包测试（electron-builder 打包 Windows 可执行文件） |

**验证标准**：日常使用一周，记忆持续有效，人格稳定，工具正常，无崩溃。

---

## 迭代依赖关系

```
迭代一（骨架）
  ↓
迭代二（AI 服务商 + 模型管理）
  ↓
迭代三（Agent Loop + 对话）← 依赖迭代二的 Provider
  ↓
迭代四（工具链）← 依赖迭代三的 Loop
  ↓
迭代五（项目注册 + 会话）← 独立，但建议在工具链后做
  ↓
迭代六（记忆系统）← 依赖迭代五的 SQLite
  ↓
迭代七（人格系统）← 依赖迭代六的 PromptBuilder
  ↓
迭代八（集成验证）← 依赖全部
```

迭代四和迭代五可以并行（如果两台机器同时开发）。
