# Wishful Claw - Agents 指南

本文档供 AI 编程助手阅读，帮助理解项目结构和开发约定。

## 项目概述

Wishful Claw 是一个 Agent 编程软件，融合 OpenCowork 的 Agent Loop + 工具链、KodaClaw 的记忆与人格设计、OpenClaw.net 的记忆主动回忆机制。代码已从三个参考项目迁移并适配为 WishfulClaw 自有命名空间，参考项目仅作为历史溯源。

## 技术栈

- **前端**：TypeScript + React 19 + Electron 35
- **后端**：C# + .NET 10
- **通信**：IPC + MessagePack

## 项目结构（7 层架构）

> 当前状态：7 项目已落地（Contracts / Core / Infrastructure / Workspace / Persona / Agent / Worker）。

```
src/
├── main/           # Electron Main 进程（窗口管理、IPC 桥接、Worker 生命周期）
├── renderer/       # React 前端（UI / 交互 / 状态管理）
├── preload/        # Electron Preload（安全桥接）
├── shared/         # 前后端共享类型定义（TS）
└── runtime/                              # .NET 后端工程
    ├── WishfulClaw.sln
    ├── WishfulClaw.Contracts/            # 1. 接口契约（纯接口，无实现）
    │   └── IWorkerModule / IWorkerModuleContext / IWorkerRequestContext / WorkerResponse
    │
    ├── WishfulClaw.Core/                 # 2. Agent 通用框架（不含业务逻辑）
    │   ├── Protocol/                     #   通信协议（MessagePack 编解码、流式事件、Worker 分发）
    │   └── Tools/                        #   工具框架（IToolExecutor / IToolProvider / ToolRegistry / ToolSchemaBuilder）
    │
    ├── WishfulClaw.Infrastructure/       # 3. 基础设施（计划中，v2-iter-3 新建）
    │   ├── Db/                           #   数据库（DbClient + Entities 从 Worker 搬入）
    │   ├── Storage/                      #   配置存储（ConfigStore + ProviderStore + JsonFileNodeCache 从 Worker 搬入）
    │   └── Http/                         #   HTTP 客户端（WorkerHttpClientFactory 从 Agent 搬入）
    │
    ├── WishfulClaw.Workspace/            # 4. 记忆系统（业务层）
    │   └── Memory/                       #   记忆读写/检索/分层流转/巩固/语义降级/FTS5 + MemoryFtsService
    │
    ├── WishfulClaw.Persona/              # 5. 人格系统
    │   ├── PromptBuilder.cs              #   分段组装 System Prompt + 字符预算
    │   ├── PersonaGenerator.cs           #   人格生成
    │   ├── PersonaStore.cs               #   人格持久化
    │   └── PersonaPresetService.cs       #   预设管理
    │
    ├── WishfulClaw.Agent/                # 6. Agent 运行时（核心业务逻辑）
    │   ├── AgentLoop*.cs                 #   Agent Loop 循环主体（partial class 拆分）
    │   ├── SessionConversation.cs        #   per-session 会话状态管理（增量追加 + prefix cache 优化）
    │   ├── ContextCompression.cs         #   LLM 总结式上下文压缩
    │   ├── ToolCallProcessor.cs          #   工具调用处理
    │   ├── ToolDispatchRouter.cs         #   工具分派路由
    │   ├── SubAgent*.cs                  #   子 Agent 生命周期管理
    │   ├── Providers/                    #   模型 Provider（Anthropic / OpenAI Chat / Gemini / Vertex AI）
    │   │   ├── AnthropicMessages*.cs
    │   │   ├── OpenAIChat*.cs
    │   │   └── ...
    │   ├── *Executor.cs                  #   工具执行器（AskUser / Browser / ImageGenerate / SSH / Task / WebFetch / WebSearch ...）
    │   ├── ConversationCodec.cs          #   对话编解码
    │   ├── StreamEventModels.cs          #   流式事件模型
    │   └── WorkerHttpClientFactory.cs    #   ⚠️ 待搬到 Infrastructure
    │
    └── WishfulClaw.Worker/               # 7. 进程入口（薄层 IPC 宿主）
        ├── Program.cs                    #   入口
        ├── WorkerHost*.cs                #   宿主构建 + 模块装载
        ├── Modules/                      #   模块注册（IWorkerModule 模式）
        │   ├── Db/                       #   ⚠️ DbClient + Entities 待搬到 Infrastructure
        │   ├── Git/                      #   Git 工具模块
        │   ├── Skills/                   #   Skill 管理模块
        │   ├── Extensions/               #   扩展模块
        │   ├── Channels/                 #   渠道模块
        │   ├── Video/                    #   视频生成模块
        │   └── ...
        ├── Tools/                        #   工具实现（FileTools / SearchTools / ShellTools / MemoryTools / Providers）
        │   ├── FileTools/                #   ⚠️ 依赖 DbClient，待 Infrastructure 后可独立拆分
        │   ├── SearchTools/
        │   ├── ShellTools/
        │   ├── MemoryTools/
        │   └── Providers/                #   工具 Provider 注册（18 个 ToolProvider）
        ├── ConfigStore.cs                #   ⚠️ 待搬到 Infrastructure
        ├── ProviderStore.cs              #   ⚠️ 待搬到 Infrastructure
        └── JsonFileNodeCache.cs          #   ⚠️ 待搬到 Infrastructure
```

### 各项目文件数（当前实际）

| 项目 | 文件数 | 职责 |
|------|--------|------|
| Contracts | 4 | 纯接口契约 |
| Core | 19 | Agent 通用框架（Protocol + Tools） |
| Infrastructure | 23 | 基础设施（Db / Storage / Http + Db Tools） |
| Workspace | 12 | 记忆系统（含 MemoryFtsService） |
| Persona | 9 | 人格系统 |
| Agent | 141 | Agent 运行时（Loop / Provider / Executor / Compression / SubAgent / Tools / Modules） |
| Worker | 12 | IPC 宿主（Program + Host + Catalog + 5 核心 Module） |

> 统计不含 obj/ 目录下的自动生成文件。

## 分层约定

### 1. Contracts 层（WishfulClaw.Contracts）

纯接口和数据契约，无实现。

- **不依赖**任何其他项目
- 被 Core / Infrastructure / Workspace / Persona / Agent / Worker 共同引用
- 保持轻量，不放业务逻辑

### 2. Core 层（WishfulClaw.Core）

Agent 通用框架，不含任何业务逻辑。

- **依赖** Contracts
- **不依赖** Infrastructure / Workspace / Persona / Agent / Worker
- 包含：Protocol（MessagePack 通信）、Tools（工具框架基类）
- 定义接口在 Contracts 中，由 Infrastructure / Agent / Worker 实现

### 3. Infrastructure 层（WishfulClaw.Infrastructure）

> 计划中，v2-iter-3 新建。

基础设施层，提供数据库、配置存储、HTTP 客户端等通用能力。

- **依赖** Contracts + Core
- **不依赖** Workspace / Persona / Agent / Worker
- 包含：
  - **Db**：DbClient + Entities（从 Worker 搬入）— SQLite 持久化
  - **Storage**：ConfigStore + ProviderStore + JsonFileNodeCache（从 Worker 搬入）— JSON 配置文件读写
  - **Http**：WorkerHttpClientFactory（从 Agent 搬入）— HTTP 客户端工厂
- 目的：解耦 Worker 对基础设施的直接依赖，使 Worker 中的 Tools / Modules 能迁出

### 4. Workspace 层（WishfulClaw.Workspace）

记忆系统业务层。

- **依赖** Contracts（+ Infrastructure，待 v2-iter-3 后）
- **不依赖** Persona / Agent / Worker
- 包含：Memory（读写/检索/分层流转/巩固/语义降级/FTS5）

### 5. Persona 层（WishfulClaw.Persona）

人格系统。

- **依赖** Contracts + Core + Workspace
- **不依赖** Agent / Worker
- 包含：PromptBuilder / PersonaGenerator / PersonaStore / PersonaPresetService

### 6. Agent 层（WishfulClaw.Agent）

Agent 运行时核心业务逻辑。

- **依赖** Contracts + Core + Infrastructure + Persona
- **不依赖** Worker
- 包含：AgentLoop / Provider 实现 / 工具执行器 / 上下文压缩 / SubAgent / SessionConversation / Tools（FileTools / SearchTools / ShellTools / MemoryTools / Providers / AgentChanges）

### 7. Worker 层（WishfulClaw.Worker）

进程入口，薄层 IPC 宿主。

- **依赖** Agent + Persona + Workspace + Core + Contracts + Infrastructure
- 负责模块注册、依赖注入、进程生命周期
- 被 Electron Main 进程拉起
- **目标**：瘦身后仅保留 Program.cs + WorkerHost + Module 注册 + 少量 Worker 专属逻辑（~30 文件）

### 依赖方向（严格单向）

```
Contracts
  ↑
Core
  ↑
Infrastructure
  ↑
Workspace
  ↑
Persona
  ↑
Agent
  ↑
Worker
```

> 禁止逆向依赖。下层项目不得引用上层项目。

## 核心设计原则

1. **分层严格分离**——各层通过 Contracts 中的接口交互，依赖方向严格自上而下
2. **Agent Runtime 和 Workspace 严格分离**——Agent 不直接操作记忆，通过工具调用读写
3. **记忆必须被用上**——不靠 System Prompt 全量塞入，Agent 通过工具主动检索读取和实时写入
4. **人格在输出时体现**——不介入 Agent Loop 决策，只在最终输出给用户时加工
5. **工具 Executor 模式**——每个工具自注册、自包含，加工具只需新建一个 Executor 文件
6. **Infrastructure 下沉**——Db/Storage/Http 等通用能力下沉到独立层，Worker 保持薄层

## 参考源码（历史溯源）

> 以下项目代码已迁移并适配为 WishfulClaw 命名空间。参考项目仅作为历史溯源，开发时不再直接参考，除非需要理解原始设计意图。

| 项目 | 路径 | 参考内容 |
|------|------|---------|
| OpenCowork | `D:\claw\OpenCowork` | Agent Loop、工具链、Provider、流式协议（已迁移） |
| KodaClaw | `D:\claw\koda-claw` | 记忆系统、人格系统、PromptBuilder（已迁移） |
| OpenClaw.net | `D:\claw\openclaw.net` | 记忆主动回忆、记忆工具、上下文预算（已迁移） |
| DeepSeek-Reasonix | `D:\claw\DeepSeek-Reasonix` | 缓存命中率统计、工具注册发现（参考中） |

## 开发约定

- C# 文件名使用 PascalCase
- TypeScript 文件名使用 kebab-case
- 接口前缀 `I`（C# 遵循 .NET 惯例）
- 新增模块时在 Worker/Modules 下注册
- 新增工具时实现工具基类并在对应 Module 中注册
- 记忆和人格的配置文件使用 Markdown 格式（.wishful-claw/ 目录下）

### 大文件拆分

1. 按职责拆分为多个文件，每个文件 200~500 行为宜，前提是不影响逻辑内聚性，可以适当超出
2. 超过 500 行必须拆分
3. 拆分的目的是出问题时方便排查定位——按职责边界拆，让人一看文件名就知道该去哪找问题
4. C# 用 partial class，TypeScript 用 export/import 模块化
5. 以下情况不需要强行拆分：
   - 单一数据对象（如 provider preset 列表、模型配置表）——内容是同质数据，拆了反而难查找
   - 高度内聚的 store / hook ——逻辑紧密耦合，拆开会割裂上下文
   - 拆分后需要大量 props 透传或 state 搬运的组件——拆出去增加了间接层，排查更难
6. 拆分后保持逻辑等价，不改变行为，只改组织结构

### 耦合文件拆分

1. **逻辑不相关的代码不放在同一个文件**：即使参考项目把它们放在一起，搬入时也要拆分到各自的文件中
2. **判断标准**：如果两个类/方法之间没有调用关系或数据依赖，只是参考方随手放在一起，就必须拆开
3. **拆分到正确的目录**：拆出来的文件放到 AGENTS.md 项目结构中对应的目录

### 迭代交付标准

每个迭代交付时，功能必须**完整可用**，不能是半成品：

- 有入口（能从导航/菜单进入）
- 有反馈（操作后有可见响应）
- 有闭环（功能流程走得通，不是断头路）
- 编译通过 + 能启动 + 核心流程能跑

## 编译验证

每次写完代码必须确保零报错：

- **C#**：`dotnet build`（可加 `-o` 临时输出路径避免文件锁定）
- **TypeScript**：`npx tsc --noEmit -p tsconfig.web.json`（必须带 `-p`！不带 `-p` 只走 references 不检查文件内容，等于没验证）
- **不允许用 `@ts-ignore` 偷懒**（可选依赖除外）

## Git 提交规范

**核心原则：功能单元测试通过后才 commit，不要改一点就提交。**

- **功能单元**：一组相关改动完成、用户测试通过后，产生一个 commit。中间反复修改、调试不产生 commit
- **不要碎片化提交**：改一点就 commit 会导致 git history 噪音大、回滚时分不清哪版是好的
- **多组改动可以攒在一起**：如果多组改动属于同一个功能单元，测试通过后一次提交
- **提交前必须测试**：编译通过 + 能启动 + 核心流程能跑，用户确认 OK 后才 commit
- **Plan 执行期间只 commit 不 push**：每个功能单元 commit 后不 push，本地 commit 就是防误操作的检查点
- **Plan 完成后才 push**：一个 Plan 的所有功能单元都完成并通过验证后，一次性 push
- **Push 需要代理**：`git -c http.proxy=http://127.0.0.1:7897 -c https.proxy=http://127.0.0.1:7897 push origin <branch>`

### 分支管理

- **新分支必须从最新的 main 拆出**：开始新迭代前，先确保上一个迭代分支已合并到 main 并打 tag，然后从更新后的 main 创建新分支
- **禁止从旧分支拆分支**：如果上一个分支未合并 main，新分支会缺少前序迭代的代码变更，导致编译错误或功能缺失
- **标准流程**：`git checkout main` → `git pull origin main` → `git checkout -b dev/v2-iter-{N}` → 开发 → commit → push → 合并 main → 打 tag → 删除分支 → 下一个迭代从 main 重新拆出

## 异常日志

项目运行时的所有异常（主进程、渲染进程、Worker、IPC 通道）会自动写入日志文件。

**日志位置**：`<userData>/logs/` 目录下，按日期命名，如 `2026-07-22.log`

其中 `<userData>` 是 Electron 的 `app.getPath('userData')` 返回值：
- Windows：`%APPDATA%/<appName>`（即 `C:\Users\<用户名>\AppData\Roaming\wishful-claw\logs\`）
- macOS：`~/Library/Application Support/<appName>/logs/`
- Linux：`~/.config/<appName>/logs/`

**排查方式**：Agent 排查问题时，优先读取当天日志文件中的 `[ERROR]` 级别条目，获取完整堆栈信息，而非依赖用户口述错误。

日志格式：

```
[2026-07-22T12:30:45.123Z] [ERROR] [renderer] Uncaught TypeError: Cannot read property 'x' of undefined
  at handleClick (ChatPage.tsx:45:12)
  ...
[2026-07-22T12:30:46.000Z] [ERROR] [ipc] Handler error for 'fs:read-file': ENOENT: no such file...
```

来源标记：`[main]` 主进程、`[renderer]` 渲染进程、`[worker]` Worker 子进程、`[ipc]` IPC 通道。
