# Plan: Goal 模式链路修复 — create_goal 触发编排

## 目标

修复 Goal 模式的核心链路：Agent 在 Goal 模式下通过 `create_goal` 工具创建目标时，真正触发 `GoalOrchestrator.StartAsync` 进入编排循环（目标分解 → 子 Agent 串行执行 → 自检评估），而不是仅在内存中记录目标文本。

## 背景

当前 Goal 模式的链路断点：

1. 用户切换到 Goal 模式 → `goalObjective` 传入 `agent/run` → 仅 PromptBuilder 注入 `<goal_context>` 提示词
2. Agent 读到提示词后调用 `create_goal` 工具 → `AgentRuntimeGoalExecutor.CreateGoal` 仅存内存字典，**不触发编排**
3. `GoalOrchestrator.StartAsync` 零处调用，全套编排代码是死代码

## 设计决策

- **不自动进入编排**：用户发送消息时不自动触发 GoalOrchestrator，而是让 Agent 在对话中理解需求后，**主动使用 `create_goal` 工具**来创建目标并启动编排
- **`create_goal` 触发编排**：当 Agent 调用 `create_goal` 时，除了记录目标，还调用 `GoalOrchestrator.StartAsync` 启动编排循环
- **编排在后台运行**：GoalOrchestrator 通过流式事件向前端汇报进度（子任务执行、工具调用等）

## 步骤清单

### 步骤1：`AgentRuntimeGoalExecutor` 改为异步，接入 `GoalOrchestrator`

- **文件**：`src/runtime/WishfulClaw.Agent/AgentRuntimeGoalExecutor.cs`
- 将 `Execute` 改为 `ExecuteAsync`，接受 `AgentRuntimeRunState` 和 `IWorkerRequestContext`
- 在 `CreateGoal` 中调用 `GoalOrchestrator.StartAsync` 启动编排
- 返回 goalId 给 Agent 确认
- 验证：`dotnet build` 通过

### 步骤2：`ToolDispatchRouter` 更新调用

- **文件**：`src/runtime/WishfulClaw.Agent/ToolDispatchRouter.cs`
- 将 Goal 工具的分发从 `AgentRuntimeGoalExecutor.Execute` 改为 `ExecuteAsync`
- 传入 `state` 和 `context`
- 验证：`dotnet build` 通过

### 步骤3：`GoalOrchestrator` 适配 — 事件流对接

- **文件**：`src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs` + `GoalOrchestratorLoop.cs` + `GoalOrchestratorLLM.cs`
- 确认 `GoalOrchestrator.StartAsync` 的 fire-and-forget 模式能正确通过流式事件转发执行过程
- 确保子 Agent 执行时的事件（`sub_agent_text_delta`、`sub_agent_tool_call`）能到达前端
- 验证：`dotnet build` 通过

### 步骤4：PromptBuilder 提示词优化

- **文件**：`src/runtime/WishfulClaw.Persona/PromptBuilder.cs`
- 调整 `<goal_context>` 提示词，引导 Agent 先和用户聊天确认需求，再使用 `create_goal` 工具
- 验证：`dotnet build` 通过

### 步骤5：编译验证 + 端到端测试

- `npx tsc --noEmit -p tsconfig.web.json`
- `npx tsc --noEmit -p tsconfig.node.json`
- `npx tsc --noEmit -p tsconfig.json`
- `dotnet build src/runtime/WishfulClaw.sln`
- 手动测试：切换 Goal 模式 → 聊天讨论需求 → Agent 调用 `create_goal` → 触发编排 → 子 Agent 执行 → 自检评估

## 涉及文件

### 修改
- `src/runtime/WishfulClaw.Agent/AgentRuntimeGoalExecutor.cs` — 改为异步，接入 GoalOrchestrator
- `src/runtime/WishfulClaw.Agent/ToolDispatchRouter.cs` — 更新分发调用
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs` — 确认事件流
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs` — 确认事件流
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLLM.cs` — 确认事件流
- `src/runtime/WishfulClaw.Persona/PromptBuilder.cs` — 优化提示词

## 风险与注意事项

- `GoalOrchestrator.StartAsync` 是 fire-and-forget 模式（内部 `Task.Run`），调用后立即返回 goalId。Agent 需要能接受这个异步模型
- 子 Agent 执行时的事件转发需要确认 `SuppressTransportEvents` 是否正确设置（参考 `SubAgentExecutor.cs`）
- 编排循环中的 429 退避、可中断机制需要验证与前端 IPC 的协同