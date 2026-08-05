# Plan 1: Goal 状态模型 + DB 层 + 文件格式

## 目标

建立 Goal 模式的数据基础设施：DB 实体、CRUD 工具、文件格式定义。为后续 GoalOrchestrator 提供状态持久化能力。

## 步骤清单

- [ ] 步骤1：GoalEntity 数据模型 — 定义 `GoalEntity.cs`，字段：GoalId / SessionId / GoalText / Status (Active/Paused/Completed/Aborted) / CreatedAt / UpdatedAt / PlanCount / CompletedPlanCount
- [ ] 步骤2：PlanItem 模型 — Goal 下的计划项数据结构：PlanId / Title / Description / Status (Pending/Executing/Completed/Failed) / RetryCount / SubAgentRunId / ResultSummary
- [ ] 步骤3：DbGoalTools — DB CRUD：CreateGoal / GetGoal / UpdateGoalStatus / UpdateGoalProgress / ListActiveGoals，CodeFirst 自动建表
- [ ] 步骤4：Goal 文件格式 — `.wishful-claw/goals/{goalId}.md`（Goal 描述 + 计划列表 Markdown）+ `{goalId}.state.json`（执行状态 JSON：计划列表 + 每个计划的状态 + 执行结果摘要 + 重试次数）
- [ ] 步骤5：GoalFileTools — 文件读写工具：WriteGoalFile / ReadGoalFile / UpdateGoalState / ReadGoalState，状态变更时实时写 state.json
- [ ] 步骤6：Worker Module 注册 — DbGoalTools 注册到 WorkerModuleCatalog，IPC 端点可达
- [ ] 步骤7：编译验证 — `dotnet build` 零错误 + `npx tsc --noEmit -p tsconfig.web.json` 零错误

## 验证检查点

- DB 能创建 Goal 记录、更新状态、查询活跃 Goal
- `.wishful-claw/goals/{goalId}.md` 和 `.state.json` 格式正确，可读写
- state.json 结构：`{ goalId, goalText, status, plans: [{ planId, title, status, retryCount, resultSummary }] }`

## 涉及文件

- `src/runtime/WishfulClaw.Infrastructure/Db/Entities/GoalEntity.cs` — 新建
- `src/runtime/WishfulClaw.Infrastructure/Db/DbGoalTools.cs` — 新建
- `src/runtime/WishfulClaw.Agent/Tools/GoalFileTools.cs` — 新建（文件读写，放 Agent 层因为依赖项目工作区路径）
- `src/runtime/WishfulClaw.Worker/WorkerModuleCatalog.cs` — 修改（注册 DbGoalTools）

## 参考源码

- Codex: `D:\claw\codex\codex-rs\core\src\rollout_budget.rs` — 预算追踪模式参考
- Codex: `D:\claw\codex\codex-rs\core\src\state\` — 状态管理模式参考
- 现有 PlanEntity + DbPlanTools — 直接参考建表和 CRUD 模式
