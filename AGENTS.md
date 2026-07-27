# Wishful Claw - Agents 指南

本文档供 AI 编程助手（Reasonix / OpenCowork 等）阅读，帮助理解项目结构和开发约定。

## 项目概述

Wishful Claw 是一个 Agent 编程软件，融合 OpenCowork 的 Agent Loop + 工具链、KodaClaw 的记忆与人格设计、OpenClaw.net 的记忆主动回忆机制。

## 技术栈

- **前端**：TypeScript + React + Electron
- **后端**：C# + .NET 10
- **通信**：IPC + MessagePack

## 项目结构

```
src/
├── main/           # Electron Main 进程（窗口管理、IPC 桥接、Worker 生命周期）
├── renderer/       # React 前端（UI / 交互 / 状态管理）
├── preload/        # Electron Preload（安全桥接）
├── shared/         # 前后端共享类型定义（TS）
└── runtime/                        # .NET 后端工程
    ├── WishfulClaw.sln
    ├── WishfulClaw.Core/              # Agent 核心框架（通用，不含业务逻辑）
    │   ├── AgentLoop/                 # 循环主体（从 OpenCowork 搬入并拆分）
    │   ├── Providers/                 # 模型 Provider（openai-chat/openai-responses/anthropic/gemini/vertex-ai）
    │   ├── Tools/                     # 工具框架（基类、注册、执行器模式）
    │   ├── Protocol/                  # 通信协议（MessagePack 编解码、流式事件）
    │   └── Context/                   # 上下文管理（压缩、预算、Token 计算）
    ├── WishfulClaw.Workspace/         # 业务层（记忆 + 人格，新写）
    │   ├── Memory/                    # 记忆系统（读写/检索/分层流转/巩固/语义降级）
    │   ├── Persona/                   # 人格系统（Identity/Soul/PromptBuilder/PersonaPreset）
    │   └── Files/                     # 工作区文件管理（.wishful-claw/ 目录）
    ├── WishfulClaw.Worker/            # 进程入口（被 Electron 拉起的子进程）
    │   ├── Modules/                   # 模块注册（IWorkerModule 模式）
    │   └── Program.cs                 # 入口
    └── WishfulClaw.Contracts/         # 接口契约（Core 和 Workspace 之间的抽象）
```

## 分层约定

### Core 层（WishfulClaw.Core）

Agent 通用框架，不含任何业务逻辑。

- **不依赖** Workspace 层
- **不依赖** Worker 层
- 定义接口在 Contracts 中，由 Workspace 实现

### Workspace 层（WishfulClaw.Workspace）

业务逻辑层，记忆和人格都在这里。

- **依赖** Contracts（实现接口）
- **不依赖** Worker 层
- **不依赖** Core 的具体实现（只通过 Contracts 交互）

### Worker 层（WishfulClaw.Worker）

进程入口，组装 Core + Workspace。

- **依赖** Core + Workspace + Contracts
- 负责模块注册、依赖注入、进程生命周期
- 被 Electron Main 进程拉起

### Contracts 层（WishfulClaw.Contracts）

纯接口和数据契约，无实现。

- 被 Core 和 Workspace 共同引用
- 保持轻量，不放业务逻辑

## 核心设计原则

1. **Agent Runtime 和 Workspace 严格分离**——通过 Contracts 中的接口交互，互不依赖实现细节
2. **记忆必须被用上**——不靠 System Prompt 全量塞入，Agent 通过工具主动检索读取和实时写入
3. **人格在输出时体现**——不介入 Agent Loop 决策，只在最终输出给用户时加工
4. **工具 Executor 模式**——每个工具自注册、自包含，加工具只需新建一个 Executor 文件

## 参考源码

开发时需要参考以下项目源码：

| 项目 | 路径 | 参考内容 |
|------|------|---------|
| OpenCowork | `D:\claw\OpenCowork` | Agent Loop（sidecars/.../OpenAIChatRuntime.cs）、工具链（.../AgentRuntime*Executor.cs）、Provider、流式协议 |
| KodaClaw | `D:\claw\koda-claw` | 记忆系统（products/KodaClaw/src/.../Workspace/）、人格系统（.../Prompt/、persona-presets.json）、PromptBuilder |
| OpenClaw.net | `D:\claw\openclaw.net` | 记忆主动回忆（src/OpenClaw.Agent/AgentRuntime.cs TryInjectRecallAsync）、记忆工具（.../Tools/Memory*Tool.cs）、上下文预算（.../Memory/ContextBudgetPlanner.cs） |

## 参考源码适配规范

### 核心原则：迁移 + 适配 + 做减法，不是从零重写

从 OpenCowork / KodaClaw / OpenClaw.net 搬代码时，**搬过来，改名字，去杂质，留骨架**。不要看到参考代码就理解为"功能不要了"然后从零写一个简版。

### 前端适配（重点）

前端页面**直接参考 OpenCowork 的 React 前端**，做减法，不是重新造：

1. **整体结构照搬**：布局、导航、路由、状态管理的骨架从 OpenCowork 搬过来，去掉不需要的功能模块
2. **入口和导航必须保留**：即使某个迭代只做一个功能（如会话页），也要保留侧边栏/导航栏的入口结构。砍掉的是功能页面，不是导航框架。不能出现"只有一个光秃秃的页面，入口都没有"的情况
3. **组件复用**：OpenCowork 的通用组件（按钮、对话框、输入框、列表项等）直接搬入，改命名空间和样式变量。不要自己从头写 UI 组件
4. **做减法的正确姿势**：
   - OpenCowork 有 10 个页面，MVP 只要 3 个 → 搬 3 个，导航里保留 3 个入口，其余注释或移除路由
   - OpenCowork 的会话页有 20 个功能按钮，MVP 只要发送消息 → 保留发送框 + 消息列表，去掉多余的按钮，但页面布局结构不变
   - **不是**：自己写一个新的会话页，只放一个输入框和一个列表，然后说"迭代完成"
5. **样式变量统一**：搬入后把 OpenCowork 的主题变量名替换为 WishfulClaw 的命名

### 后端适配

1. **命名空间统一**：所有搬入的代码命名空间改为 `WishfulClaw.*`，不保留原项目命名空间
2. **分层归属**：搬入的代码按 AGENTS.md 的分层约定放入对应项目（Core / Workspace / Worker / Contracts）
3. **清理私货**：OpenCowork 中的 routin.ai 相关硬编码、特定中转商配置等必须清除
4. **接口适配**：原项目中的接口和实现可能耦合较紧，搬入时通过 Contracts 层解耦

### 大文件拆分

参考项目中的单文件如果过大（如 OpenCowork 的 `OpenAIChatRuntime.cs` 3828 行），搬入时**必须拆分**：

1. 按职责拆分为多个文件，每个文件 200~500 行为宜，前提是不影响逻辑内聚性，可以适当超出
2. 拆分的目的是出问题时方便排查定位——按职责边界拆，让人一看文件名就知道该去哪找问题
3. 以下情况不需要强行拆分：
   - 单一数据对象（如 provider preset 列表、模型配置表）——内容是同质数据，拆了反而难查找
   - 高度内聚的 store / hook ——逻辑紧密耦合，拆开会割裂上下文
   - 拆分后需要大量 props 透传或 state 搬运的组件——拆出去增加了间接层，排查更难
4. 拆分后保持逻辑等价，不改变行为，只改组织结构
5. 拆分粒度示例（以 AgentLoop 为例）：
   - `AgentLoopEngine.cs` — 循环主体（状态机 + 流程控制）
   - `AgentLoopContext.cs` — 单次循环的上下文数据
   - `AgentLoopEvents.cs` — 事件定义和触发
   - `ToolCallProcessor.cs` — 工具调用处理
   - `StreamProcessor.cs` — 流式响应处理
6. 拆分时建立 partial class 或独立 class，不要为了拆而拆导致过度碎片化

### 耦合文件拆分

参考项目中有些文件本身不大，但塞了多个逻辑不相关的东西——这不是我们的项目结构该有的。搬入时必须按职责拆开：

1. **逻辑不相关的代码不放在同一个文件**：即使参考项目把它们放在一起，搬入时也要拆分到各自的文件中
2. **判断标准**：如果两个类/方法之间没有调用关系或数据依赖，只是参考方随手放在一起，就必须拆开
3. **拆分到正确的目录**：拆出来的文件放到 AGENTS.md 项目结构中对应的目录，而不是继续堆在一起
4. **示例**：OpenCowork 某个文件里同时放了 Provider 配置模型 + Provider 服务逻辑 + Provider API 客户端 → 搬入时拆为 `ProviderConfig.cs`（模型）+ `ProviderService.cs`（逻辑）+ `ProviderApiClient.cs`（客户端），分别放入 Contracts 和 Core

### 迭代交付标准

每个迭代交付时，功能必须**完整可用**，不能是半成品：

- 有入口（能从导航/菜单进入）
- 有反馈（操作后有可见响应）
- 有闭环（功能流程走得通，不是断头路）
- 编译通过 + 能启动 + 核心流程能跑

**反例**：迭代目标是"会话功能"，交付物只有一个光秃秃的聊天页面，没有侧边栏、没有会话列表、没有入口，然后说"迭代完成"

**正例**：迭代目标是"会话功能"，交付物有侧边栏（会话列表 + 新建按钮）、主区域（消息流 + 输入框）、可以从入口进入、能发消息能收到回复，只是没有高级功能（如附件、代码高亮等）

## 开发约定

- C# 文件名使用 PascalCase
- TypeScript 文件名使用 kebab-case
- 接口前缀 `I`（C# 遵循 .NET 惯例）
- 新增模块时在 Worker/Modules 下注册
- 新增工具时实现工具基类并在对应 Module 中注册
- 记忆和人格的配置文件使用 Markdown 格式（.wishful-claw/ 目录下）

## Git 提交规范

**核心原则：功能单元测试通过后才 commit，不要改一点就提交。**

- **功能单元**：一组相关改动完成、用户测试通过后，产生一个 commit。中间反复修改、调试不产生 commit
- **不要碎片化提交**：改一点就 commit 会导致 git history 噪音大、回滚时分不清哪版是好的。没测试通过的代码提交了只会污染 history
- **多组改动可以攒在一起**：如果多组改动属于同一个功能单元，测试通过后一次提交，不要拆成多个碎片 commit
- **提交前必须测试**：编译通过 + 能启动 + 核心流程能跑，用户确认 OK 后才 commit
- **Plan 执行期间只 commit 不 push**：每个功能单元 commit 后不 push，本地 commit 就是防误操作的检查点
- **Plan 完成后才 push**：一个 Plan 的所有功能单元都完成并通过验证后，一次性 push

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
