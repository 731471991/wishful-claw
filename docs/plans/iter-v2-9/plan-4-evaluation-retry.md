# Plan 4: 自检评估 + 失败重试机制

## 目标

在 GoalOrchestrator 编排循环中叠加 LLM 自检评估和失败重试逻辑。子 Agent 完成计划后，LLM 评估是否达标——达标则推进下一个计划，不达标则分析原因、调整方案、重新分配子 Agent 重试。这是 Goal 模式"不放弃"的核心。

## 步骤清单

- [x] 步骤1：自检评估 LLM 调用 — `EvaluateResultAsync(plan, executionResult)`：构造 prompt 包含（目标 + 计划描述 + 子 Agent 执行结果摘要），要求 LLM 评估是否达标，返回 JSON：`{ satisfied: bool, reasoning: string, nextAction: "proceed" | "retry" | "adjust" }`
- [x] 步骤2：评估结果处理 — 接入编排循环：子 Agent 完成后调 EvaluateResultAsync，根据 nextAction 决定后续操作
- [x] 步骤3：失败调整方案 — 当 `nextAction="adjust"` 时，LLM 分析失败原因并生成调整后的计划描述（新 title + description），替换原计划，重新 spawn 子 Agent
- [x] 步骤4：重试计数 — 每个计划有 RetryCount，调整重试时递增。设置最大重试次数（默认 3），超过后标记为 Failed，跳过该计划继续下一个（避免卡死在单个计划上）
- [x] 步骤5：完全重试 — 当 `nextAction="retry"` 时，不调整方案，用原计划重新 spawn 子 Agent（适用于偶发失败）
- [x] 步骤6：Goal 达成判定 — 所有计划完成（Completed 或 Failed）后，LLM 做最终评估：Goal 是否整体达成。未达成且有 Failed 计划时，LLM 可决定生成补充计划
- [x] 步骤7：编排循环集成 — 将自检逻辑集成到 GoalOrchestratorLoop.cs 的循环中，替换 Plan 3 的简单逻辑
- [x] 步骤8：事件推送 — 增加 evaluation 事件（plan_evaluated / plan_retried / plan_adjusted / goal_evaluation_passed / goal_evaluation_failed）
- [x] 步骤9：state.json 更新 — 评估结果、重试次数、调整后的计划描述写入 state.json
- [x] 步骤10：编译验证 — `dotnet build` 零错误

## 验证检查点

- 子 Agent 完成后 LLM 正确评估达标/不达标
- 不达标时 LLM 生成调整方案，新子 Agent 用调整后的计划执行
- 重试次数计数正确，超过上限跳过
- 所有计划完成后 LLM 做最终 Goal 评估
- state.json 记录评估结果和重试历史

## 涉及文件

- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLLM.cs` — 修改（增加 EvaluateResultAsync + AdjustPlanAsync，partial class）
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs` — 修改（集成自检评估 + 重试逻辑）
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorModels.cs` — 修改（增加 EvaluationResult / RetryPolicy 模型）
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorEventEmitter.cs` — 新建（partial，事件推送逻辑，拆分保持文件 < 500 行）

## 参考源码

- Codex `D:\claw\codex\codex-rs\core\src\tasks\review.rs` — ReviewTask 评估逻辑参考
- Codex `D:\claw\codex\codex-rs\core\src\rollout_budget.rs` — 预算/阈值追踪模式参考
