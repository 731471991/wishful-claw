# Plan 6: 可中断机制 — 暂停/恢复/中止

## 目标

实现 Goal 执行的可中断机制：用户可随时暂停（当前子 Agent 完成后停止，不启动下一个）、恢复（从暂停处继续）、中止（立即停止整个 Goal）。通过 CancellationToken 集成，前端按钮触发 IPC 调用。

## 步骤清单

- [x] 步骤1：Goal 中断状态模型 — 在 GoalContext 中增加 InterruptMode 枚举（None / PauseRequested / AbortRequested）和 PausedPlanIndex（暂停时记录当前位置）
- [x] 步骤2：CancellationToken 集成 — GoalOrchestrator 持有 CancellationTokenSource，编排循环每次迭代检查 token。暂停 = 不启动新子 Agent 但等待当前完成，中止 = cancel 当前子 Agent + 退出循环
- [x] 步骤3：暂停逻辑 — 收到暂停请求后，设置 InterruptMode=PauseRequested，当前子 Agent 完成后不启动下一个，更新 Goal 状态为 Paused，推事件 `goal_paused`
- [x] 步骤4：恢复逻辑 — 收到恢复请求后，设置 InterruptMode=None，从 PausedPlanIndex 处继续编排循环，推事件 `goal_resumed`
- [x] 步骤5：中止逻辑 — 收到中止请求后，设置 InterruptMode=AbortRequested，cancel 当前子 Agent 的 CancellationToken，等待子 Agent 退出，更新 Goal 状态为 Aborted，推事件 `goal_aborted`，写最终 state.json
- [x] 步骤6：IPC 端点 — Worker 注册 goal:interrupt / goal:resume / goal:abort 端点，前端通过 workerRequest 调用
- [x] 步骤7：退避期间中断 — 429 退避等待期间也能响应中断（CancellationToken 在 sleep 中有效）
- [x] 步骤8：持久化恢复 — Goal 暂停后应用重启，从 state.json 读取 Paused 状态，用户可在前端选择恢复继续执行
- [x] 步骤9：编译验证 — `dotnet build` 零错误

## 验证检查点

- 暂停：当前子 Agent 完成后停止，Goal 状态变为 Paused
- 恢复：从暂停处继续执行，state.json 正确恢复
- 中止：当前子 Agent 被 cancel，Goal 状态变为 Aborted
- 429 退避等待期间也能响应暂停/中止
- IPC 端点正常响应前端调用

## 涉及文件

- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs` — 修改（CancellationTokenSource + 中断逻辑）
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorModels.cs` — 修改（InterruptMode 枚举）
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs` — 修改（循环中检查中断状态）
- `src/runtime/WishfulClaw.Worker/Modules/` — 修改（注册 Goal IPC 端点）
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorEventEmitter.cs` — 修改（暂停/恢复/中止事件）

## 参考源码

- Codex `D:\claw\codex\codex-rs\core\src\tasks\mod.rs` — abort_all_tasks + CancellationToken 模式参考
- Codex `D:\claw\codex\codex-rs\core\src\agent\control.rs` — interrupt_agent 参考
