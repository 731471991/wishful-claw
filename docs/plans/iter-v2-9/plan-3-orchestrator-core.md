# Plan 3: GoalOrchestrator 核心 — 目标拆分 + 串行子 Agent 编排

## 目标

实现 GoalOrchestrator 的核心编排循环：LLM 拆分目标为计划列表 → 串行 spawn 子 Agent 执行每个计划 → 收集执行结果 → 推进下一个计划。本 Plan 实现基础循环骨架，自检评估和 429 退避在后续 Plan 中叠加。

## 步骤清单

- [x] 步骤1：GoalOrchestratorModels — 数据模型定义：`GoalContext`（Goal 元信息 + 计划列表 + 当前执行位置）、`PlanExecutionResult`（子 Agent 执行结果：PlanId / Status / Summary / Error / Is429）
- [x] 步骤2：GoalOrchestrator 类骨架 — `GoalOrchestrator.cs`，依赖注入 SubAgentExecutor + Provider（用于 LLM 调用）+ GoalFileTools + DbGoalTools。构造方法 + StartAsync(goalText) + StopAsync()
- [x] 步骤3：目标拆分 LLM 调用 — `DecomposeGoalAsync(goalText)`：构造 prompt 发给 LLM，要求拆分目标为多个计划（每个计划含标题 + 描述），解析 LLM 返回的计划列表 JSON
- [x] 步骤4：串行子 Agent 分配 — `ExecutePlanAsync(plan)`：复用 SubAgentExecutor 创建子 Agent，传入计划描述作为 system prompt / user message，设置 IsGoalMode=true，等待子 Agent 完成
- [x] 步骤5：结果收集 — 子 Agent 完成后收集执行结果（ExitPlanMode 的返回值 / 错误信息），封装为 PlanExecutionResult
- [x] 步骤6：基础编排循环 — `RunAsync()`：while 循环，取下一个计划 → ExecutePlanAsync → 收集结果 → 更新 state.json → 进入下一个。本 Plan 的循环暂用简单逻辑：完成就推进，失败也推进（自检评估在 Plan 4 叠加）
- [x] 步骤7：Goal 状态读写集成 — 编排循环中实时更新 `.wishful-claw/goals/{goalId}.state.json`，外部可读取"当前在做什么、做到哪了"
- [x] 步骤8：事件推送 — 向前端推送 Goal 进度事件（goal_started / plan_started / plan_completed / plan_failed / goal_completed），复用现有 StreamEvent 机制
- [x] 步骤9：编译验证 — `dotnet build` 零错误

## 验证检查点

- 设定目标文本 → LLM 返回计划列表（JSON 格式正确）
- 串行 spawn 子 Agent 执行第一个计划 → 子 Agent 完成后收集到结果
- state.json 实时更新，外部可读取进度
- 事件推送到前端（即使前端面板还没做，事件应能到达 IPC 层）

## 涉及文件

- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs` — 新建（核心编排器）
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorModels.cs` — 新建（数据模型）
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs` — 新建（partial，编排循环逻辑）
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLLM.cs` — 新建（partial，LLM 调用：目标拆分）
- `src/runtime/WishfulClaw.Agent/SubAgentExecutor.cs` — 修改（支持 Goal 模式子 Agent 创建，传入 IsGoalMode 标志）
- `src/runtime/WishfulClaw.Agent/StreamEventModels.cs` — 修改（增加 Goal 进度事件类型）

## 参考源码

- Codex `D:\claw\codex\codex-rs\core\src\agent\control.rs` — AgentControl 多 Agent 编排参考
- Codex `D:\claw\codex\codex-rs\core\src\tasks\mod.rs` — SessionTask trait + spawn_task 参考
- Codex `D:\claw\codex\codex-rs\core\src\tasks\lifecycle.rs` — 任务生命周期参考
- 现有 SubAgentExecutor.cs — 子 Agent 生命周期管理，直接复用
- 现有 AgentLoop.cs — 子 Agent 内部走的标准 Agent Loop
