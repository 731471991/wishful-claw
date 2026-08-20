# 探索发现：v2-iter-12 Goal 生命周期一致性收口

> 探索范围：v2-iter-9 Goal 初始设计、v2-iter-12 状态分离方案、当前 Goal 前后端实现、数据库持久化、子 Agent 取消传播和前端运行态消费。
> 探索结论：v2-iter-12 完成了概念层的 `Status / RunState` 分离，但尚未完成全生命周期和全状态源收口。

## 当前实现概况

Goal 当前涉及五条主要链路：

1. Agent 调用 `create_goal / get_goal / update_goal / pause_goal / resume_goal / abort_goal`。
2. `AgentRuntimeGoalExecutor` 管理工具调用和 pending 确认。
3. `GoalOrchestrator` 分解目标、串行执行计划、自检、重试和退避。
4. `DbGoalTools` 持久化 Goal、计划快照、预算和事件。
5. Renderer 通过 `goal_progress`、Goal Store 和三处 Goal UI 展示运行状态。

v2-iter-12 已新增 `GoalContext.RunState`，并规定：

- DB GoalStatus：`active / complete / failed / aborted`。
- 内存 GoalRunState：`idle / running / paused`。
- Pause/Resume 不修改 DB。
- Worker 重启后 active Goal 恢复为 idle，不自动编排。

## 已确认问题

### 1. Resume 会产生重复编排循环

`GoalModule.ResumeGoal` 对内存中的 Goal 无条件调用 `StartRunLoopAsync`。`StartRunLoopAsync` 将 paused 改为 running 后创建新的 `RunAsync`，同时旧 `RunAsync` 的暂停等待也被唤醒。

影响：

- 同一计划可能重复执行。
- 文件、Shell 和网络操作可能执行两次。
- 两个循环并发写 DB 和 `.state.json`。
- 旧循环可能删除仍在运行的新上下文。

### 2. plansJson 可能双重编码

`SyncGoalToDb` 将计划列表序列化为字符串后写入 `plansJson`，`DbGoalTools.Update` 使用 `JsonElement.GetRawText()` 读取该字符串，DB 可能存成带外层引号和转义符的 JSON 字符串。

恢复时直接反序列化为 `List<GoalPlanItem>`，根节点类型不匹配，最终恢复为空计划并重新分解 Goal。

### 3. Abort 没有传播到当前子 Agent

Goal 持有独立 `CancellationTokenSource`，但 `SubAgentExecutor` 只监听传入的 `AgentRuntimeRunState.CancellationToken`。两者没有连接。

影响：

- Abort 只能让外层编排循环以后退出。
- 当前子 Agent 和其工具调用仍可能继续执行。
- v2-iter-9 中“立即停止整个 Goal”的目标没有真正实现。

### 4. GoalStatus 枚举不一致

当前同时存在：

- 设计和前端：`complete`
- 编排器：`completed`
- 失败完成：`completed_with_failures`
- 工具 schema：`completed`
- Prompt：要求调用 `complete`

影响：Agent 工具调用、DB、前端按钮和启动恢复对终态的判断不一致。

### 5. 终态收尾不完整

分解失败、外层异常和取消等路径没有统一执行 DB 和 `.state.json` 持久化。正常完成时也没有先将 RunState 设为 idle。

影响：

- 已失败或中止的 Goal 在 DB 中仍可能是 active。
- 重启后错误恢复。
- 前端收到终态事件但 runState 仍为 running，计时不停止。

### 6. 存在三套互相独立的状态源

- SQLite `goals`
- `GoalOrchestrator.ActiveGoals`
- `AgentRuntimeGoalExecutor.Goals`

Worker 重启时只恢复 Orchestrator 和 DB，工具层静态字典为空，因此 `get_goal` 可能返回 null。

### 7. DB 更新没有精确绑定 goalId

多处 CRUD 先按 sessionId 查询最新 Goal，再按查到的 goalId 更新。数据库也没有 sessionId 唯一约束。

影响：旧 Goal 的后台同步可能覆盖同 session 的新 Goal。

### 8. Clear 不会停止后台编排

前端 Clear 只删除 DB，没有 Abort 并等待 Goal 循环退出。后台仍可能继续执行和发送 `goal_progress`。

### 9. 前端三处 UI 判断未完全统一

聊天 Goal Bar 部分使用 RunState，但 GoalManagerDialog 和 GoalPanelCard 仍存在按 DB status 判断 Pause/Resume 的分支。

### 10. v2-iter-12 运行态主链路曾漏传 runState

当前未提交修改在 `chat-store/index.ts` 中补充了 `runState` 解析，说明验证报告完成时，真实 stream 消费链路尚未完整接入 RunState。

## Native AOT 风险

Goal 生命周期收口会新增或调整 IPC 响应、事件和工具结果，是最容易引入 AOT 回归的区域。

必须遵守：

- 禁止匿名类型参与序列化。
- 使用具名 record/class DTO。
- 所有 DTO 和 `List<T>` 注册到对应 JsonSerializerContext。
- `WorkerResponse.Json` 显式传 JsonTypeInfo。
- `JsonSerializer` 调用显式使用 JsonTypeInfo。
- 禁止反射扫描和动态构造。
- 最终执行 Native AOT 发布，要求 0 警告。

## 当前工作区风险

当前分支为 `dev/v2-iter-12`，存在尚未提交的 Goal UI、locale 和 chat-store 修改。后续执行必须先保护这些用户改动，不得覆盖或回退。

## 建议迭代边界

v2-iter-12 后续子计划只做 Goal 生命周期一致性收口：

- 状态模型统一
- 单循环所有权
- 取消传播
- 精确持久化
- 统一终态收尾
- 工具状态源合并
- 前端控制收口
- 生命周期回归测试
- Electron + Worker 冒烟验证

不做 Goal 并行、多 Goal、预算策略重写或大规模 UI 重设计。

## 关键代码位置

- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs`
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs`
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLLM.cs`
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorModels.cs`
- `src/runtime/WishfulClaw.Agent/AgentRuntimeGoalExecutor.cs`
- `src/runtime/WishfulClaw.Agent/SubAgentExecutor.cs`
- `src/runtime/WishfulClaw.Infrastructure/Db/DbGoalTools.cs`
- `src/runtime/WishfulClaw.Infrastructure/Db/DbClient.cs`
- `src/runtime/WishfulClaw.Worker/Modules/GoalModule.cs`
- `src/renderer/src/stores/goal-store.ts`
- `src/renderer/src/stores/chat-store/index.ts`
- `src/renderer/src/components/goal/GoalSessionControls.tsx`
- `src/renderer/src/components/goal/goal-session-utils.tsx`
- `src/renderer/src/components/goal/goal-session-views.tsx`

## 参考文档

- `docs/dev-workflow.md`
- `docs/plans/iter-v2-9/plan-1-goal-state-model.md`
- `docs/plans/iter-v2-9/plan-3-orchestrator-core.md`
- `docs/plans/iter-v2-9/plan-6-interruptible.md`
- `docs/plans/iter-v2-12/plan.md`
- `docs/plans/iter-v2-12/verification_report.md`
