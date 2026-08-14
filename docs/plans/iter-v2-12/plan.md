# Plan: v2-iter-12 Goal 状态模型重构 — 目标状态与执行状态分离

## 目标

彻底解决 Goal 系统的状态语义混乱问题：**DB（目标状态）与执行状态（内存）分离**，让 Goal 真正支持自动编排、暂停/恢复、进程重启恢复，且不伪造数据、不强行改写 DB。

## 背景

### 问题：单一 `status` 字段混用两种语义

当前系统只有一个 `status` 字段，同时承担两个完全不同的语义，导致一系列错误：

| 语义 | 含义 | 应该存哪 |
|------|------|---------|
| **目标状态** | 这个 goal 是否还存在、是否已完成 | 持久化（DB） |
| **执行状态** | 是否在跑、暂停、空闲 | 运行时（内存） |

### 已确认的方向（与老大讨论）

1. **DB 层面的状态**：只有「进行中」和「已完成」——`active`（进行中，未完成）/ `complete` / `failed` / `aborted`（终态）
2. **运行状态同步**：沿用现有 goal 事件流（`goal_progress`）
3. **暂停不持久化**：暂停是运行时状态，不写 DB，进程重启后自动回到"未运行"

### 之前犯的错误（需纠正）

- ❌ 用 `planCount==0` 去"猜"goal 没执行过 → 不可靠
- ❌ 把 DB 改成 `paused` → 混淆目标状态，把"进行中"改没了
- ❌ 前端直接读 DB status 当执行状态 → 不知道真实是否在跑

## 设计决策

### 两套状态完全分离

| 维度 | 字段 | 存哪 | 值 | 谁写 |
|------|------|------|----|------|
| **目标状态** | `Status` | DB + 内存 | `active` / `complete` / `failed` / `aborted` | 编排完成/失败时写 |
| **执行状态** | `RunState` | 仅内存 | `idle` / `running` / `paused` | Pause/Resume 按钮、启动恢复时写 |

- `Status` **永不被** Pause/Resume 修改，**永不被**"启动时恢复"修改
- `RunState` **不写进 DB**

### 状态流转

```
启动恢复（DB=active）→ RunState: idle（目标进行中，未运行）
  用户点 Resume → RunState: running（编排启动）
  用户点 Pause  → RunState: paused（编排暂停，等待）
  用户点 Resume → RunState: running（编排继续）
  编排全部完成 → Status: complete（目标状态终态）
```

## 步骤清单

### 步骤 1：执行状态模型 — 新增 RunState

**改动**：
- `GoalContext` 新增 `RunState` 属性（`idle` / `running` / `paused`），默认 `idle`
- `StartAsync` 中 `RunState = "running"`
- `Pause(goalId)` → `RunState = "paused"`（不再改 `Status`）
- `Resume(goalId)` → `RunState = "running"`（不再改 `Status`）

**涉及文件**：
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorModels.cs` — `GoalContext` 加 `RunState`
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs` — Pause/Resume/StartAsync 改 `RunState`

**验证检查点**：
- 编译通过
- Pause 后 `Status` 不变、`RunState` 变 paused

---

### 步骤 2：RunAsync 依据 RunState 暂停等待

**改动**：
- `RunAsync` 循环中检测 `RunState == "paused"` 等待（不再检测 `Status`）
- 开头对 `RunState == "paused"` 也等待（恢复场景）
- 完成判断处 `if (goal.Status != "aborted" && goal.Status != "paused")` 改为 `if (goal.Status != "aborted" && goal.RunState != "paused")`
- `WaitForResumeIfPausedAsync` 共享方法改为检查 `RunState`
- 全部 `goal.Status == "paused"` 引用点一并改为 `RunState`（共 4 处：开头等待、循环内检查、完成判断、WaitForResumeIfPausedAsync）

**涉及文件**：
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs`

**验证检查点**：
- 编译通过
- paused 时循环挂起，resume 后继续

---

### 步骤 3：ResumeFromDb 恢复为 idle，不写 DB

**改动**：
- `ResumeFromDb` 恢复时 `RunState = "idle"`，`Status = row.Status`（保持 DB 原样）
- **不启动 RunAsync**（idle 状态下不自动编排）
- **不写 DB**（不改变目标状态）
- `SyncGoalToDb` 只持久化 `Status`（终态），`RunState` 永不落库
- `InitializeAsync` 只是把 goal 放入 `ActiveGoals`，不启动循环

**涉及文件**：
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs` — `ResumeFromDb`
- `src/runtime/WishfulClaw.Worker/Modules/GoalModule.cs` — `InitializeAsync`

**验证检查点**：
- 编译通过
- 重启后 goal 在 `ActiveGoals` 中，`RunState=idle`，DB 未被修改
- 不自动计时、不自动编排

---

### 步骤 4：Resume 依据 RunState 启动/恢复循环

**改动**：
- `GoalModule.ResumeGoal`（前端点击 Resume）：
  - 若 `RunState == "idle"` → 启动 RunAsync + 设 `running`
  - 若 `RunState == "paused"` → 设 `running`（循环已在跑，直接解除等待）
- `Resume(goalId)` 只改 `RunState = "running"`，不负责启动循环
- 启动循环的职责放 `ResumeGoal` 或 `StartAsync`

**涉及文件**：
- `src/runtime/WishfulClaw.Worker/Modules/GoalModule.cs` — `ResumeGoal`
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs` — `Resume`

**验证检查点**：
- 编译通过
- idle goal 点 Resume → 真正启动编排
- paused goal 点 Resume → 解除等待继续

---

### 步骤 5：goal_progress 事件携带 RunState

**改动**：
- `EmitGoalEventAsync` 的 payload 加 `runState` 字段
- `GoalProgressState`（前端）接口加 `runState` 可选字段
- `applyGoalProgress` 解析 `runState` 存入 `goalRunStates` 字典

**涉及文件**：
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs` — `EmitGoalEventAsync`
- `src/renderer/src/stores/goal-store-helpers.ts` — `GoalProgressState`
- `src/renderer/src/stores/goal-store.ts` — `applyGoalProgress`

**验证检查点**：
- 编译通过
- 事件 payload 含 `runState`，前端成功解析

---

### 步骤 6：前端 UI 依据 RunState 显示 + 计时

**改动**：
- `useGoalSession` / `GoalSessionBar` 按钮显示依据 `goalRunStates[sessionId]`：
  - `running` → 显示 Pause
  - `paused` / `idle` → 显示 Resume
- 计时器只在 `runState == 'running'` 时计时
- `useLiveGoalElapsedSeconds` 依据 `runState` 而非 `goal.status`

**涉及文件**：
- `src/renderer/src/components/goal/goal-session-utils.tsx` — `useGoalSession`、`useLiveGoalElapsedSeconds`
- `src/renderer/src/components/goal/GoalSessionControls.tsx` — 按钮显示
- `src/renderer/src/stores/goal-store.ts` — `goalRunStates` 字典

**验证检查点**：
- TypeScript 编译通过（3/3）
- idle goal 显示 Resume 且不计时
- running goal 显示 Pause 且计时
- paused goal 显示 Resume 且不计时

---

### 步骤 7：清理之前补丁方向

**改动**：
- 撤销 `ResumeFromDb` 中"降级 DB 为 paused"的逻辑（stash 中的改动）
- 确认 DB 中的 `active` goal 保持原样

**涉及文件**：
- 检查 `git stash` / 还原

**验证检查点**：
- 编译通过
- DB 无被错误修改的 goal

## 涉及文件完整清单

| 文件路径 | 改动类型 | 说明 |
|---------|---------|------|
| `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorModels.cs` | 修改 | `GoalContext` 加 `RunState` |
| `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs` | 修改 | Pause/Resume/StartAsync 改 RunState；ResumeFromDb 恢复 idle 不写 DB |
| `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs` | 修改 | RunAsync 检查 RunState |
| `src/runtime/WishfulClaw.Agent/AgentRuntimeGoalExecutor.cs` | 修改 | ResumeGoal 兜底（如前） |
| `src/runtime/WishfulClaw.Worker/Modules/GoalModule.cs` | 修改 | ResumeGoal 依据 RunState 启动循环；InitializeAsync 只恢复 idle |
| `src/renderer/src/stores/goal-store-helpers.ts` | 修改 | `GoalProgressState` 加 `runState` |
| `src/renderer/src/stores/goal-store.ts` | 修改 | `goalRunStates` 字典 + `applyGoalProgress` 解析 |
| `src/renderer/src/components/goal/goal-session-utils.tsx` | 修改 | 计时 + 状态读取依据 runState |
| `src/renderer/src/components/goal/GoalSessionControls.tsx` | 修改 | 按钮显示依据 runState |

## 验证标准

1. **编译通过**：C# `dotnet build` 0 错误；TypeScript 3/3 配置 0 错误
2. **DB 状态语义正确**：`active`=进行中，`complete/failed/aborted`=终态；Pause/Resume/重启都不改 DB
3. **启动恢复**：重启后 DB=active 的 goal 显示"未运行"（idle），不计时，可手动 Resume
4. **暂停/恢复**：running→Pause 暂停循环；paused→Resume 继续
5. **自动编排**：用户点 Resume 后真正启动编排
6. **不伪造数据**：不把 DB 改成分层语义外的值
7. **AOT 0 警告**：`scripts/publish-aot-worker.mjs` 运行 0 警告（本次改动不新增序列化类型，但需回归验证）

## 完成判定

- 上述 6 项验证标准全部通过
- 用户确认"UI 和内存状态一致、DB 状态语义正确"