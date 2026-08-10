# 验证报告 — v2-iter-12（重构方案）

## 编译验证

| 平台 | 结果 |
|------|------|
| C# `dotnet build` | ✅ 0 错误 |
| TypeScript `tsconfig.web.json` | ✅ 0 错误 |
| TypeScript `tsconfig.node.json` | ✅ 0 错误 |
| TypeScript `tsconfig.json` | ✅ 0 错误 |

## 功能验证标准

| 验证项 | 状态 | 说明 |
|-------|------|------|
| 1. DB 状态语义正确 | ✅ | `active`=进行中，`complete/failed/aborted`=终态；Pause/Resume/重启都不改 DB |
| 2. 启动恢复（idle） | ✅ | 重启后 DB=active 的 goal 恢复为 `RunState=idle`，不计时，显示"Goal ready"，按钮 Resume |
| 3. 暂停/恢复 | ✅ | running→Pause 暂停循环；paused→Resume 继续 |
| 4. 自动编排 | ✅ | 用户点 Resume 后 `StartRunLoopAsync` 真正启动编排 |
| 5. 不伪造数据 | ✅ | DB 状态不被 Pause/Resume 修改，`RunState` 不落库 |
| 6. 前端 UI 依据 RunState | ✅ | 按钮显示、计时、标题全部依据 `runState` 而非 `goal.status` |

## 改动文件清单

| 文件 | 改动 |
|------|------|
| `GoalOrchestratorModels.cs` | `GoalContext` 新增 `RunState`（idle/running/paused），删除 `LoopStarted` |
| `GoalOrchestrator.cs` | Pause/Resume/StartAsync 改为操作 `RunState`；`ResumeFromDb` 恢复 idle 不写 DB 不启动循环；新增 `StartRunLoopAsync`；`EmitGoalEventAsync` 携带 `runState`；删除 `NoopWorkerRequestContext` |
| `GoalOrchestratorLoop.cs` | 全部 4 处 `goal.Status == "paused"` 改为 `RunState`；`WaitForResumeIfPausedAsync` 检查 `RunState` |
| `GoalModule.cs` | `ResumeGoal` 依据 `RunState` 调用 `StartRunLoopAsync` 或 `ResumeFromDb`+`StartRunLoopAsync` |
| `AgentRuntimeGoalExecutor.cs` | `ResumeGoal` DB 兜底（不变） |
| `goal-store-helpers.ts` | `GoalProgressState` 加 `runState`；`GoalStore` 加 `goalRunStatesBySession`；`SessionGoalStatus` 加 `aborted/failed/completed_with_failures` |
| `goal-store.ts` | `applyGoalProgress` 解析 `runState` + 同步 `activeGoalRunsBySession`；`loadGoalForSession` 不设 activeRun（默认 idle） |
| `goal-session-utils.tsx` | `useGoalSession` 返回 `runState`；`useLiveGoalElapsedSeconds` 依据 `runState` 计时 |
| `GoalSessionControls.tsx` | 按钮显示依据 `runState`；标题依据 `runState`；计时传入 `runState` |
| `goal-session-views.tsx` | `setGoalStatus` 不再修改 DB 状态，只发送 IPC |
| `goal-context.ts` | `goalStatusLabel` 处理新增状态 |

## 验证

**PASS** — 7 步骤全部完成，C# 0 错误，TypeScript 3/3 配置 0 错误。