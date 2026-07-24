# 迭代十：子 Agent（Sub-Agent）

## 目标

实现子 Agent 的创建、执行、事件流和前端渲染。主 Agent 通过 Task 工具启动子 Agent 执行子任务，前端展示子 Agent 运行状态，完成后结果回传主 Agent。

## 参考来源

- **OpenCowork**（主参考）：后端 C# `AgentRuntimeSubAgentExecutor.cs`（1714行）、`AgentRuntimeSubAgentConcurrency.cs`、`AgentRuntimeSubAgentCancellationScope.cs`；前端 `sub-agents/` 目录（types/events/registry/create-tool）
- **Reasonix**（辅助参考）：Go `task.go`（2018行）、`subagent_store.go`、`parallel_tasks.go` — 工具过滤、深度限制、系统提示词设计

## 架构决策

### 后端（C# .NET Worker）

子 Agent 执行在 .NET Worker 中完成，与 OpenCowork 架构一致。`ToolCallProcessor` 拦截 `Task` 工具调用，路由到 `SubAgentExecutor`。

**核心流程**：
1. `ToolCallProcessor` 检测到 `Task` 工具 → 转发到 `SubAgentExecutor.ExecuteAsync`
2. `SubAgentExecutor` 解析 `subagent_type`，加载定义（从 `~/.wishful-claw/agents/*.md` 或 custom）
3. 创建子 `AgentRuntimeRunState`（独立 runId，共享 sessionId）
4. 构建子参数（继承父的 provider/tools/workingFolder，替换 messages 和 systemPrompt）
5. 设置子 state 的 `SuppressTransportEvents = true`（子事件不直接发送到前端，由 SubAgentExecutor 转发）
6. 调用 `AgentLoop.ExecuteLoopAsync(childParameters, childState, context)`
7. 子 loop 完成后，收集最终输出，作为 tool result 返回给父 loop
8. 期间向父 state 的 event stream 发送 `sub_agent_start` / `sub_agent_progress` / `sub_agent_end` 事件

### 前端（React）

- `stream-event-adapter.ts` 适配 `sub_agent_*` 事件
- `SubAgentCard.tsx` 渲染子 Agent 运行状态（已有骨架组件）
- `OrchestrationBlock.tsx` 渲染多个子 Agent 的编排视图

### 简化范围（相比 OpenCowork）

- **不做**：Team 编排、background executor、并发 lease、dedup/replay protection
- **不做**：transcript 持久化、write path claims
- **保留**：custom 子 Agent 类型、.md 文件定义加载、深度限制（max 2层）、子 Agent 取消

## Plan 拆分

### Plan 10-1：后端子 Agent 执行器（C#）

**目标**：Task 工具能被拦截，创建子 Agent 并执行，返回结果。

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | 扩展 `AgentRuntimeStreamEvent` 添加子 Agent 事件字段 | `Models/StreamEventModels.cs` |
| 2 | 扩展 `AgentStreamMessagePackEmitter` 编码新字段 | `AgentStreamMessagePackEmitter.cs` |
| 3 | 创建 `SubAgentDefinition.cs` — 定义模型和 .md 文件解析 | `AgentRuntime/SubAgentDefinition.cs` |
| 4 | 创建 `SubAgentExecutor.cs` — 核心执行器 | `AgentRuntime/SubAgentExecutor.cs` |
| 5 | 修改 `ToolCallProcessor` 拦截 Task 工具 | `ToolCallProcessor.cs` |
| 6 | 修改 `AgentRuntimeRunState` 添加必要字段 | `AgentRuntimeRunState.cs` |
| 7 | 注册 Task 工具到 ToolRegistry | `Tools/ToolModule.cs` |

**验证**：编译通过，日志能看到 Task 工具被拦截、子 Agent loop 执行。

### Plan 10-2：前端事件适配和渲染

**目标**：前端能接收 sub_agent_* 事件并渲染子 Agent 状态。

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | `stream-event-adapter.ts` 添加 sub_agent_* 事件处理 | `lib/agent/stream-event-adapter.ts` |
| 2 | `chat-store` 添加子 Agent 状态管理 | `stores/chat-store.ts` |
| 3 | `SubAgentCard.tsx` 渲染子 Agent 运行状态 | `components/chat/SubAgentCard.tsx` |
| 4 | `content-renderer.tsx` 集成 SubAgentCard | `AssistantMessage/content-renderer.tsx` |
| 5 | `OrchestrationBlock.tsx` 渲染编排视图 | `components/chat/OrchestrationBlock.tsx` |

**验证**：对话中 Agent 调用 Task 工具 → 前端显示子 Agent 卡片 → 完成后显示结果。

### Plan 10-3：子 Agent 定义和管理

**目标**：支持从 .md 文件加载子 Agent 定义，前端可管理。

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | 创建 `~/.wishful-claw/agents/` 目录和示例定义 | 文件系统 |
| 2 | 前端 `registry.ts` 对接后端定义列表 | `lib/agent/sub-agents/registry.ts` |
| 3 | Task 工具 schema 动态生成（包含已注册的子 Agent 类型） | `SubAgentExecutor.cs` |
| 4 | 深度限制实现（max 2 层嵌套） | `SubAgentExecutor.cs` |

**验证**：创建一个 `reviewer.md` 子 Agent 定义 → 对话中使用 `subagent_type=reviewer` → 子 Agent 用该定义执行。
