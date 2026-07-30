# 探索发现：v2-iter-1 Runtime 分层架构重构

## 当前项目规模

| 项目 | 文件数 | 行数 | 说明 |
|------|--------|------|------|
| WishfulClaw.Core | 15 | 2,386 | Protocol + Tools 框架 |
| WishfulClaw.Contracts | 4 | 197 | 纯接口 |
| WishfulClaw.Workspace | 10 | 729 | Memory 系统 |
| WishfulClaw.Worker | 192 | 29,166 | 巨型项目，承载 90% 代码 |

## Worker 内部结构

### AgentRuntime（65 文件，11,592 行）— 目标迁入 WishfulClaw.Agent

按职责分组：

| 子模块 | 文件数 | 代表文件 | 职责 |
|--------|--------|----------|------|
| AgentLoop 核心 | 3 | AgentLoop.cs (365行), AgentLoop.Helpers.cs, AgentLoop.MemoryRecall.cs | 循环主体、状态机 |
| Provider | 12 | OpenAIChatProvider.cs, AnthropicMessagesProvider.cs, OpenAIChatSseParser.cs, AnthropicMessagesEventParser.cs | 模型对接 |
| Executor | 18 | AgentRuntimeSshToolExecutor.cs, AgentRuntimeWebFetchExecutor.cs, AgentRuntimeTaskExecutor.cs 等 | 工具执行器 |
| SubAgent | 5 | SubAgentExecutor.cs (690行), SubAgentDefinition.cs, SubAgentRegistry.cs 等 | 子 Agent |
| 上下文 | 3 | ContextCompression.cs, ConversationCodec.cs, SystemPromptCache.cs | 上下文管理 |
| 工具调度 | 3 | ToolCallProcessor.cs, ToolDispatchRouter.cs (477行), AgentRuntimeTools.cs | 工具调用处理 |
| 模型 | 5 | StreamEventModels.cs, ToolModels.cs, ConversationModels.cs 等 | 数据模型 |
| 其他 | 11 | AgentRuntimeRunState.cs, AgentRuntimeReverseRequests.cs, ProviderRetryPolicy.cs 等 | 运行状态、重试、IPC |

### Persona（9 文件，1,381 行）— 目标迁入 WishfulClaw.Persona

| 文件 | 职责 |
|------|------|
| PromptBuilder.cs | 分段组装 System Prompt + 字符预算截断 |
| PersonaGenerator.cs | 人格生成 |
| PersonaStore.cs | 人格存储 |
| PersonaPresetService.cs | 预设管理 |
| PersonaModule.cs | IPC 模块注册 |
| PersonaModels.cs | 数据模型 |
| PromptProfile.cs | 提示词配置 |
| PromptContextDocument.cs | 上下文文档 |
| PersonaGenerationPrompt.cs | 生成提示词 |

### Tools（42 文件，4,113 行）— 部分上提 Core，其余留 Worker

| 子模块 | 文件数 | 目标 |
|--------|--------|------|
| FileTools | 4 | 留 Worker（依赖 Modules.AgentChanges） |
| ShellTools | 2 | 留 Worker |
| SearchTools | 2 | 留 Worker |
| MemoryTools | 6 | 留 Worker（依赖 Modules.Db + AgentRuntime） |
| Providers | 18 | 留 Worker（工具定义注册） |
| 框架代码 | 4 | **移到 Core**：ToolSchemaBuilder, ToolDefinitionPlaceholder, ToolModuleState, ToolModule |
| 其他 | 6 | 留 Worker |

### Modules（58 文件）— 留 Worker

DB / Git / Skills / Extensions / Channels / Video / Audio / Media 等功能域，全部留在 Worker。

### 其他

| 目录 | 文件 | 目标 |
|------|------|------|
| Runtime/ | WorkerHttpClientFactory.cs | 移到 Agent 或 Core（WebFetch/WebSearch 依赖） |
| Memory/ | MemoryFtsService.cs, MemoryRecallService.cs | 留 Worker |
| Root | 11 文件（Program, WorkerHost, IPC 等） | 留 Worker |

## 跨层依赖分析

### AgentRuntime 对外依赖（迁入 Agent 需解决的问题）

| 依赖 | 来源 | 解决方案 |
|------|------|----------|
| `WishfulClaw.Worker.Persona` | AgentLoop.cs → PromptBuilder.Build() | Agent 项目引用 Persona 项目 |
| `WishfulClaw.Worker.Tools` | ToolCallProcessor → ToolModuleState.Registry | ToolModuleState 移到 Core |
| `WishfulClaw.Worker.Runtime` | WebFetch/WebSearch → WorkerHttpClientFactory | 移到 Agent 项目（或 Core） |
| `WishfulClaw.Core.Protocol` | 全局 | Agent 引用 Core |
| `WishfulClaw.Contracts` | 全局 | Agent 引用 Contracts |

### Persona 对外依赖

| 依赖 | 来源 | 解决方案 |
|------|------|----------|
| `WishfulClaw.Core.Protocol` | 全局 | Persona 引用 Core |
| `WishfulClaw.Workspace.Memory` | PromptBuilder.cs | Persona 引用 Workspace |

### Worker 模块对 AgentRuntime 的依赖（需暴露为 public）

| 模块 | 使用的 AgentRuntime 类型 | 解决方案 |
|------|------------------------|----------|
| Modules/Extensions | AgentRuntimeReverseRequests, AgentRuntimeNativeToolCall | 类型移到 Core 或设为 public |
| Modules/WebFetchModule | AgentRuntimeWebFetchExecutor, AgentRuntimeNativeToolCall | 类型设为 public |
| Modules/MemoryModule | （仅 using，实际未引用类型） | 删除无用 using |
| Modules/Video | （仅 using，实际未引用类型） | 删除无用 using |
| Tools/MemoryTools | AgentRuntimeRunState | 留 Worker，通过 Worker→Agent 引用访问 |
| Tools/TaskTool | AgentRuntime (SubAgentDefinition 等) | 留 Worker |

### 关键发现：3 个核心耦合类型

1. **AgentRuntimeNativeToolCall**（ToolModels.cs）— 被 AgentRuntime 内部 + Modules/Extensions + Modules/WebFetchModule + Tools 引用。**移到 Core/Tools**。
2. **AgentRuntimeReverseRequests**（静态类）— 被 AgentRuntime 内部 + Modules/Extensions 引用。**移到 Core/Protocol**（本质是 IPC 通信机制）。
3. **AgentRuntimeWebFetchExecutor**（静态类）— 被 AgentRuntime 内部 + Modules/WebFetchModule 引用。**设为 public，留在 Agent**。

## 目标项目引用关系

```
Contracts ← Core ← Agent ← Worker
                ← Workspace ← Persona ← Worker
                              ← Agent ← Worker
```

具体：
- **Contracts**: 无依赖（纯接口）
- **Core**: → Contracts
- **Workspace**: → Contracts
- **Agent**: → Core, Contracts, Persona（PromptBuilder）
- **Persona**: → Core, Contracts, Workspace（Memory）
- **Worker**: → Agent, Persona, Core, Workspace, Contracts

## 大文件清单（>400 行，需关注但不一定拆）

| 文件 | 行数 | 所属 | 备注 |
|------|------|------|------|
| ShellExecuteTool.cs | 889 | Tools | 留 Worker，不涉及本次迁移 |
| SubAgentExecutor.cs | 690 | AgentRuntime | 迁入 Agent，后续可拆 |
| ToolDispatchRouter.cs | 477 | AgentRuntime | 迁入 Agent |
| AgentRuntimeDesktopExecutor.cs | 429 | AgentRuntime | 迁入 Agent |
| AskUserAnswerBuilder.cs | 419 | AgentRuntime | 迁入 Agent |

## 风险评估

1. **internal → public 可见性变更**：AgentRuntime 大量使用 internal，迁出 Worker 后需改为 public。影响面大但机械性强。
2. **命名空间变更**：`WishfulClaw.Worker.AgentRuntime` → `WishfulClaw.Agent`，所有 using 需更新。可用全局替换。
3. **partial class 跨项目**：AgentLoop 是 partial class（3 文件），需一起迁移。
4. **编译验证**：C# 编译 + TS 编译双验证。前端不直接引用 C# 命名空间，TS 应不受影响。
5. **SqlSugar 依赖**：Worker.csproj 引用 SqlSugarCore，部分 AgentRuntime 代码可能间接依赖。需检查。
