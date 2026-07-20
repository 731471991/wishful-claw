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
| OpenCowork | `D:\gy\OpenCowork` | Agent Loop（sidecars/.../OpenAIChatRuntime.cs）、工具链（.../AgentRuntime*Executor.cs）、Provider、流式协议 |
| KodaClaw | `D:\gy\koda-claw\koda-claw` | 记忆系统（products/KodaClaw/src/.../Workspace/）、人格系统（.../Prompt/、persona-presets.json）、PromptBuilder |
| OpenClaw.net | `D:\claw\openclaw.net` | 记忆主动回忆（src/OpenClaw.Agent/AgentRuntime.cs TryInjectRecallAsync）、记忆工具（.../Tools/Memory*Tool.cs）、上下文预算（.../Memory/ContextBudgetPlanner.cs） |

## 开发约定

- C# 文件名使用 PascalCase
- TypeScript 文件名使用 kebab-case
- 接口前缀 `I`（C# 遵循 .NET 惯例）
- 新增模块时在 Worker/Modules 下注册
- 新增工具时实现工具基类并在对应 Module 中注册
- 记忆和人格的配置文件使用 Markdown 格式（.wishful-claw/ 目录下）
