# Plan 2: 计划工具自确认变体

## 目标

改造计划模式工具，去掉人工确认环节（SubmitPlanReview 的 reverse request 暂停），改为 Agent 自行评估计划合理性后直接执行。子 Agent 在 Goal 模式下走 explore → plan → self-confirm → execute → verify 全自主流程。

## 步骤清单

- [x] 步骤1：PlanMode 配置标志 — 在 AgentRuntimeRunState 或 SessionConversation 中增加 `IsGoalMode` 标志，区分计划模式和 Goal 模式
- [x] 步骤2：SelfReviewPlan 工具 — 替代 SubmitPlanReview 的 reverse request 机制。当 `IsGoalMode=true` 时，SubmitPlanReview 不发 reverse request 暂停等待用户，而是让 Agent 自行评估计划合理性后返回 "approved" 直接进入 execute 阶段
- [x] 步骤3：自行确认逻辑 — SelfReviewPlan 的工具返回值注入引导：告诉 Agent "你已自行确认计划，进入执行阶段"，通过工具返回值注入而非 system prompt
- [x] 步骤4：ExitPlanMode 适配 — Goal 模式下 ExitPlanMode 不取消整个 agent loop，而是标记当前计划完成/失败，将结果返回给 GoalOrchestrator
- [x] 步骤5：UpdatePlanStep 不变 — 步骤状态跟踪逻辑保持不变，state.json 实时更新
- [x] 步骤6：PromptBuilder guidance 适配 — 计划模式引导通过工具返回值注入，Goal 模式下额外注入"你处于自主执行模式，不需要等待用户确认"
- [x] 步骤7：编译验证 — `dotnet build` 零错误

## 验证检查点

- Goal 模式下 Agent 调 SubmitPlanReview 不再暂停等待用户，直接进入 execute
- 计划模式（非 Goal 模式）行为不变，仍然 reverse request 等用户确认
- state.json 正常更新步骤状态

## 涉及文件

- `src/runtime/WishfulClaw.Agent/AgentRuntimePlanExecutor*.cs` — 修改（4 个 partial 文件，增加 Goal 模式分支）
- `src/runtime/WishfulClaw.Agent/SessionConversation.cs` — 修改（增加 IsGoalMode 标志）
- `src/runtime/WishfulClaw.Persona/PromptBuilder.cs` — 修改（guidance 注入适配）

## 参考源码

- 现有 AgentRuntimePlanExecutor.cs 4 个 partial 文件 — 直接在此基础上改
- 现有 SubmitPlanReview reverse request 逻辑 — 参考其结构，Goal 模式下跳过 reverse request
