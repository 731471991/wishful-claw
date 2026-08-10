# Plan: v2-iter-12 Goal 系统全面修复 — 自动编排 + 中断重启

## 目标

全面修复 Goal 执行链路，让 Goal 真正能"自动编排、可暂停/恢复、进程重启后自动续跑、不丢进度"。一次性解决当前 Goal 系统"创建后不推进、重启后接不上、UI 与底层状态不匹配"的所有问题。

## 背景

当前 Goal 系统存在 4 层独立状态存储，各自为政，且 Orchestrator 状态纯内存导致多重断点：

| 层次 | 存储位置 | 数据 | 生命周期 |
|------|---------|------|---------|
| A | AgentRuntimeGoalExecutor.Goals 内存字典 | Agent 工具看到的 goal 状态 | Worker 重启丢失 |
| B | GoalOrchestrator.ActiveGoals 内存字典 | 编排运行状态（plans/进度/循环） | Worker 重启丢失 |
| C | DB goals 表 | goal 客观记录（status/objective/plans） | 持久化 |
| D | 前端 GoalStore.goalsBySession | 从 DB 加载 + 事件同步 | 页面重启重新加载 |

## 问题清单（6 个断点）

### 问题 1：goalId 不一致
- `CreatePendingGoal` 生成 `goal-{Guid}` 并写入 DB
- `StartAsync` 内部**又生成一个新的** `goal-{Guid}` 作为 `ActiveGoals` 的 key
- 结果：DB 里的 goalId ≠ ActiveGoals 的 key，Resume 永远找不到

### 问题 2：没有恢复机制
- `ActiveGoals` / `PendingGoals` 纯内存 `ConcurrentDictionary`
- Worker 进程重启后清空，DB 里 active 的 goal 无人接管

### 问题 3：Resume 不认 DB
- `GoalOrchestrator.Resume` 只查 `ActiveGoals`，找不到就什么都不做
- 没有"从 DB 读回 goal + 重新启动编排"的 fallback

### 问题 4：RunAsync 不能续跑
- `RunAsync` 每次从头 `DecomposeGoalAsync` 重新分解
- 即使已有 plans 进度，也不知道从哪继续

### 问题 5：前端 Resume 是空壳
- `dispatchNextQueuedMessageForSession` 是空实现（`return false`）
- 点击 Resume 只改 DB 标签，不真正触发 Orchestrator

### 问题 6：进程重启后无自动恢复入口
- Worker 启动时没有扫描 DB 中 active/paused goals 并恢复编排的逻辑
- 数据库有 goal，但 Orchestrator 不知道

## 设计决策（与老大确认）

### 修复方针
- **不删数据**：已有的 active goal（如 `goal-388cff850a2f414c`）通过恢复机制自动续跑
- **状态以 DB 为唯一事实源**：Orchestrator 内存状态可从 DB 重建
- **前端 Resume/Pause 必须真正作用于 Orchestrator**，而非只改 DB 标签

### 恢复机制（核心）
Worker 启动后：
1. `DbGoalTools.ListActive()` 扫描 DB 中 `active` / `paused` 的 goals
2. 对每个 goal 调用 `ResumeFromDb(goalId, sessionId)` 恢复编排：
   - 读 DB（objective, status, plans, currentPlanIndex）
   - 构建 `GoalContext` 放入 `ActiveGoals`
   - 启动 `RunAsync` 后台循环
3. 用户点击 Resume 时，若 `ActiveGoals` 找不到 → 同样走 `ResumeFromDb`

### RunAsync 续跑逻辑
- 若 `goal.Plans` 已有内容 → 跳过分解
- 若 `goal.CurrentPlanIndex >= 0` → 从 `index + 1` 续跑
- 否则从 index 0 开始

## 改动清单

### 后端（核心）

| 文件 | 改动 |
|------|------|
| `GoalOrchestrator.cs` | `StartAsync` 增加 goalId 参数（不再生成新 ID）；新增 `ResumeFromDb`；`Resume` 找不到时回退到 `ResumeFromDb` |
| `GoalOrchestratorLoop.cs` | `RunAsync` 支持已有 plans 时跳过分解、从 currentPlanIndex+1 续跑 |
| `AgentRuntimeGoalExecutor.cs` | 确认后 `DbGoalTools.Create` 与 `StartAsync` 用同一 goalId；`UpdateGoal` 兜底同步 DB status |
| `GoalModule.cs` | 新增 Init 入口：Worker 启动时扫描 DB active goals 并恢复编排 |

### 前端（小）

| 文件 | 改动 |
|------|------|
| `goal-session-views.tsx` | 移除对空实现 `dispatchNextQueuedMessageForSession` 的依赖，Resume 直接触发后端恢复 |

## 验证标准

1. **编译通过**：C# `dotnet build` 0 错误；TypeScript 3/3 配置 0 错误
2. **自动编排**：创建并确认 goal 后，Orchestrator 自动分解并执行 plans
3. **暂停/恢复**：
   - 编排运行时点 Pause → 循环暂停，状态 paused
   - 点 Resume → 循环继续
4. **进程重启恢复**：
   - 正在执行/暂停的 goal，重启 Worker 后自动恢复续跑
   - 已有 plans 的 goal 不重复分解，从断点继续
5. **goalId 一致**：DB goalId 与 ActiveGoals key 一致，Resume 能找到
6. **不删数据**：已有的 active goal 通过恢复机制续跑，无需重新创建

## 完成判定

- 上述 6 项验证标准全部通过
- 用户确认功能完整可用