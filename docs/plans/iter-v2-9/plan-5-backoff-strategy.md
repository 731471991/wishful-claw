# Plan 5: 429 限流长退避策略

## 目标

在 GoalOrchestrator 中实现 429 限流的分层退避策略：快速退避（处理模型过载/RPM 限制）→ 分钟级轮询（处理额度限制）→ 超时暂停（通知用户）。子 Agent 因 429 崩溃后，GoalOrchestrator 自动等待恢复，恢复后重新 spawn 子 Agent 继续当前计划。

## 步骤清单

- [x] 步骤1：429 检测 — 在 PlanExecutionResult 中增加 Is429 标志和 RetryAfterHint 字段。SubAgentExecutor 捕获 Provider 返回的 429 错误时，提取 HTTP Retry-After header，封装到 PlanExecutionResult
- [x] 步骤2：退避策略类 — `GoalBackoffStrategy.cs`：封装退避计算逻辑。输入：重试次数、是否有 Retry-After、上次 429 时间。输出：等待时长 + 当前阶段（FastBackoff / MinutePolling / TimeoutPause）
- [x] 步骤3：快速退避阶段 — 2s → 4s → 8s → 16s（4 次），每次重试前通过事件推送状态给前端："等待中，第 N 次重试，下次尝试 +Xs"。成功后重置退避计数器，重启子 Agent 继续
- [x] 步骤4：切换到分钟级轮询 — 快速退避 4 次后仍 429，切换到 600s（10 分钟）固定间隔轮询。前端状态："额度限制，等待恢复中... 已等待 X 分钟"
- [x] 步骤5：Retry-After 优先 — 如果 Provider 返回了 Retry-After header，直接等指定秒数，不走退避计算
- [x] 步骤6：6 小时超时暂停 — 连续轮询 6 小时仍 429，暂停 Goal，推事件 `goal_paused` 通知用户"额度可能本日耗尽，需手动确认"
- [x] 步骤7：退避期间可中断 — 退避等待期间 CancellationToken 仍然有效，用户可随时中止
- [x] 步骤8：恢复后重启 — 退避结束后重新 spawn 子 Agent，传入原计划描述继续执行（不是从头开始，而是继续当前计划）
- [x] 步骤9：事件推送 — 增加 429 相关事件：`backoff_started`（阶段 + 等待时长）/ `backoff_progress`（已等待时间）/ `backoff_resolved`（恢复）/ `backoff_timeout`（超时暂停）
- [x] 步骤10：state.json 更新 — 退避状态写入 state.json：当前阶段、重试次数、预计恢复时间（如有）
- [x] 步骤11：编译验证 — `dotnet build` 零错误

## 验证检查点

- 子 Agent 因 429 崩溃 → 快速退避 4 次 → 切换分钟级轮询
- 有 Retry-After header 时直接等待指定秒数
- 退避期间前端收到实时状态推送
- 用户可在退避期间中止 Goal
- 恢复后子 Agent 重新 spawn 继续原计划
- 6 小时超时后 Goal 暂停，用户收到通知

## 涉及文件

- `src/runtime/WishfulClaw.Agent/Goal/GoalBackoffStrategy.cs` — 新建（退避策略计算）
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs` — 修改（集成 429 退避逻辑）
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorModels.cs` — 修改（PlanExecutionResult 增加 429 字段）
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorEventEmitter.cs` — 修改（增加退避事件）
- `src/runtime/WishfulClaw.Agent/SubAgentExecutor.cs` — 修改（429 错误捕获 + Retry-After 提取）
- `src/runtime/WishfulClaw.Agent/Providers/` — 修改（Provider 层透传 429 的 Retry-After header）

## 参考源码

- Codex `D:\claw\codex\codex-rs\core\src\responses_retry.rs` — handle_retryable_response_stream_error 参考
- Codex `D:\claw\codex\codex-rs\core\src\util.rs` — backoff() 函数：200ms 初始，2x 指数，±10% jitter
- Codex `D:\claw\codex\codex-rs\protocol\src\error.rs` — UsageLimitReached / ServerOverloaded / is_retryable() 分类参考
