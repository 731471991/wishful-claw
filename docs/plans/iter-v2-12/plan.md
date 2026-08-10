# Plan: v2-iter-12 Goal 系统全面修复 — 自动编排 + 中断重启

## 目标

全面修复 Goal 执行链路，让 Goal 真正能"自动编排、可暂停/恢复、进程重启后自动续跑、不丢进度"。一次性解决当前 Goal 系统"创建后不推进、重启后接不上、UI 与底层状态不匹配"的所有问题。

## 背景

当前 Goal 系统存在 4 层独立状态存储，Orchestrator 状态纯内存导致多重断点。详见 `docs/plans/iter-v2-12/exploration_findings.md`（规划验证阶段自动生成）。

## 设计决策

- **不删数据**：已有的 active goal 通过恢复机制自动续跑
- **状态以 DB 为唯一事实源**：Orchestrator 内存状态可从 DB 重建
- **前端 Resume/Pause 必须真正作用于 Orchestrator**，而非只改 DB 标签
- **AOT 合规**：所有新增/改造的序列化操作必须显式传 `JsonTypeInfo`

## 步骤清单

### 步骤 1：goalId 对齐 — StartAsync 接受 goalId 参数

**改动**：
- `GoalOrchestrator.StartAsync` 增加 `string goalId` 参数，改用传入的 goalId 而非内部生成新 ID
- `ConfirmGoalAsync` 调用 `StartAsync` 时传入 pending 的 goalId
- `AgentRuntimeGoalExecutor.AwaitGoalConfirmationAsync` 确认后 DbGoalTools.Create 与 StartAsync 用同一 goalId

**涉及文件**：
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs` — `StartAsync` 签名
- `src/runtime/WishfulClaw.Agent/AgentRuntimeGoalExecutor.cs` — 确认后传 goalId

**验证检查点**：
- 编译通过（C# 0 错误）
- 确认后 DB 中的 goalId 与 `ActiveGoals` 的 key 一致
- 单元测试：assert(ActiveGoals[goalId] != null)

---

### 步骤 2：新增 ResumeFromDb — 从 DB 恢复编排

**改动**：
- `GoalOrchestrator.cs` 新增 `ResumeFromDb(string goalId, string sessionId, JsonElement? parameters)`：
  - 调用 `DbGoalTools.Get(sessionId)` 读 DB 记录
  - 从 DB 的 `plansJson` 反序列化 `List<GoalPlanItem>`（AOT 合规：用 `AgentRuntimeJsonContext.Default.ListGoalPlanItem`）
  - 构建 `GoalContext`（含 Plans/CurrentPlanIndex/Status/GoalText），放入 `ActiveGoals`
  - 若 `Plans` 已有内容（>0）→ 跳过分解，启动 `RunAsync` 续跑
  - 若 `Plans` 为空 → 正常走分解流程
- `GoalOrchestrator.Resume(string goalId)` 在 `ActiveGoals.TryGetValue` 找不到时，回退到 `ResumeFromDb`
- `AgentRuntimeGoalExecutor.ResumeGoal(string sessionId)` 在 `GetActiveGoalId(sessionId)` 为空时，同样回退到 `ResumeFromDb`（通过 sessionId 查 DB）

**涉及文件**：
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs` — 新增 `ResumeFromDb` + 改造 `Resume`
- `src/runtime/WishfulClaw.Agent/AgentRuntimeGoalExecutor.cs` — `ResumeGoal` 增加 DB 兜底

**验证检查点**：
- 编译通过
- `ResumeFromDb` 能正确从 DB 恢复 `GoalContext`（含 plans）
- 恢复后 `ActiveGoals[goalId]` 存在，status 正确

---

### 步骤 3：RunAsync 支持续跑

**改动**：
- `GoalOrchestratorLoop.RunAsync` 在 `DecomposeGoalAsync` 前判断 `goal.Plans.Count > 0`：
  - 若已有 plans → 跳过分解，从 `goal.CurrentPlanIndex + 1` 开始循环
  - 若 `CurrentPlanIndex < 0` → 从 0 开始
- `GoalOrchestratorLoop.SyncGoalToDb` 中 `JsonSerializer.Serialize(goal.Plans)` 改为显式传 `AgentRuntimeJsonContext.Default.ListGoalPlanItem`（AOT 合规修复）

**涉及文件**：
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs` — `RunAsync` 续跑逻辑 + AOT 修复

**验证检查点**：
- 编译通过
- 已有 plans 的 goal 恢复后跳过分解步骤
- 从正确的 `CurrentPlanIndex` 继续执行

---

### 步骤 4：Worker 启动时自动恢复

**改动**：
- `IWorkerModule` 接口增加 `Task InitializeAsync(IWorkerModuleContext context)` 方法（可选，默认空实现）
- `WorkerHost.RunAsync` 在 `Register` 完成后，遍历所有模块调用 `InitializeAsync`
- `GoalModule` 实现 `InitializeAsync`：
  - 调用 `DbGoalTools.ListActive()` 获取所有 `active` / `paused` 的 goals
  - 对每个 goal 调用 `GoalOrchestrator.ResumeFromDb(goalId, sessionId, parameters)`
  - 日志记录恢复结果

**涉及文件**：
- `src/runtime/WishfulClaw.Contracts/IWorkerModule.cs` — 新增 `InitializeAsync`
- `src/runtime/WishfulClaw.Worker/WorkerHost.cs` — 启动时调用 `InitializeAsync`
- `src/runtime/WishfulClaw.Worker/Modules/GoalModule.cs` — 实现 `InitializeAsync` + 自动恢复

**验证检查点**：
- 编译通过
- Worker 启动后日志出现 `[GoalModule] Restored N active/paused goals from DB`
- `GetActiveGoalId(sessionId)` 能返回 DB 中的 goal

---

### 步骤 5：前端 Resume 修正

**改动**：
- `goal-session-views.tsx` 的 `setGoalStatus('active')` 中移除对 `dispatchNextQueuedMessageForSession(sessionId)` 的调用（空实现，无意义）

**涉及文件**：
- `src/renderer/src/components/goal/goal-session-views.tsx` — 移除空实现调用

**验证检查点**：
- TypeScript 编译通过（3/3 配置 0 错误）
- 前端 Resume 按钮点击后，后端 `GoalOrchestrator.Resume` 被正确调用（日志确认）

---

## 涉及文件完整清单

| 文件路径 | 改动类型 | 说明 |
|---------|---------|------|
| `src/runtime/WishfulClaw.Contracts/IWorkerModule.cs` | 修改 | 新增 `InitializeAsync` 方法（可选默认空实现） |
| `src/runtime/WishfulClaw.Worker/WorkerHost.cs` | 修改 | `RunAsync` 中 Register 后遍历调用 `InitializeAsync` |
| `src/runtime/WishfulClaw.Worker/Modules/GoalModule.cs` | 修改 | 实现 `InitializeAsync`：扫描 DB 恢复 active/paused goals |
| `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs` | 修改 | `StartAsync` 增加 goalId 参数；新增 `ResumeFromDb`；`Resume` 增加 DB 回退 |
| `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs` | 修改 | `RunAsync` 跳过分解；`SyncGoalToDb` AOT 修复 |
| `src/runtime/WishfulClaw.Agent/AgentRuntimeGoalExecutor.cs` | 修改 | `ResumeGoal` DB 兜底；确认后传正确 goalId |
| `src/renderer/src/components/goal/goal-session-views.tsx` | 修改 | 移除空实现 `dispatchNextQueuedMessageForSession` 调用 |

## AOT 合规要点

- `SyncGoalToDb` 中 `JsonSerializer.Serialize(goal.Plans)` → 改为 `JsonSerializer.Serialize(goal.Plans, AgentRuntimeJsonContext.Default.ListGoalPlanItem)`
- `ResumeFromDb` 反序列化 `plansJson` → 用 `JsonSerializer.Deserialize(dbPlansJson, AgentRuntimeJsonContext.Default.ListGoalPlanItem)`
- 若 `ListGoalPlanItem` 尚未注册 → 在 `AgentRuntimeJsonContext` 中新增 `[JsonSerializable(typeof(List<GoalPlanItem>))]`
- 所有新增序列化/反序列化操作必须显式传 `JsonTypeInfo`，禁止依赖泛型推断

## 验证标准

1. **编译通过**：C# `dotnet build` 0 错误；TypeScript 3/3 配置 0 错误
2. **自动编排**：创建并确认 goal 后，Orchestrator 自动分解并执行 plans
3. **暂停/恢复**：编排运行时点 Pause → 循环暂停；点 Resume → 循环继续
4. **进程重启恢复**：正在执行/暂停的 goal，重启 Worker 后自动恢复续跑，不重复分解，从断点继续
5. **goalId 一致**：DB goalId 与 ActiveGoals key 一致，Resume 能找到
6. **不删数据**：已有的 active goal 通过恢复机制续跑，无需重新创建
7. **AOT 0 警告**：`scripts/publish-aot-worker.mjs` 运行 0 警告