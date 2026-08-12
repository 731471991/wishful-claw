# Plan: v2-iter-12 Goal 生命周期一致性收口

> 状态：用户已确认，执行中。
> 归属：v2-iter-12 Goal 目标状态与执行状态分离的生命周期收口子计划。

## 目标

彻底收口 Goal 的持久化状态、运行状态、编排循环、工具接口和前端展示，使同一个 Goal 在创建、确认、执行、暂停、恢复、中止、失败、完成、清除和进程重启后的行为一致、可恢复、不会重复执行。

本迭代不继续扩展 Goal 功能，优先修复生命周期正确性：

- Pause 后 Resume 不得产生第二个编排循环。
- Abort 必须取消当前 Goal 子 Agent，而不是只让外层循环以后退出。
- DB 中的计划列表必须能够完整往返并在重启后恢复。
- Goal 终态必须统一、持久化，并让 `RunState` 回到 `idle`。
- 工具、编排器、DB 和前端不得继续维护互相冲突的 Goal 状态副本。
- Clear 不得留下仍在后台执行的 Goal。
- 所有新增或修改的序列化代码必须满足 Native AOT 限制。

## 执行前置条件

用户已确认本计划并入 `dev/v2-iter-12` 执行，不另开 v2-iter-13。执行前置条件：

1. 保留并验证原有 Goal UI、locale 和 chat-store 改动，禁止覆盖或回退用户工作。
2. 原有前端改动形成独立安全检查点后再修改生命周期代码。
3. 不跳过本计划的逐步验证、独立审查和最终用户验收。
4. v2-iter-12 是否最终完结仍由用户在验证结果出来后裁定。

## 探索结论

### 已确认的根因

1. `Status / RunState` 只在 `GoalOrchestrator` 内部完成了部分分离，工具层、DB 模型和前端仍混用旧状态语义。
2. `StartRunLoopAsync` 无法区分 `idle` 与 `paused`：paused Goal 恢复时会启动新 `RunAsync`，同时唤醒旧循环。
3. `plansJson` 以 JSON 字符串写入 patch，DB 更新使用 `GetRawText()`，恢复时可能得到双重编码字符串，无法反序列化为计划数组。
4. Goal 的 CancellationToken 没有连接到传给 `SubAgentExecutor` 的 `AgentRuntimeRunState`，Abort 无法取消当前子 Agent。
5. 目标终态同时存在 `complete`、`completed`、`completed_with_failures` 等表达，Prompt、工具 schema、编排器和前端判断不一致。
6. 分解失败、外层异常和取消等退出路径没有统一持久化终态。
7. 终态事件可能仍携带 `runState=running`，前端计时和按钮无法可靠收尾。
8. `AgentRuntimeGoalExecutor.Goals`、`GoalOrchestrator.ActiveGoals` 和 SQLite `goals` 是三套独立状态源，重启后 `get_goal` 可能与 UI/DB 不一致。
9. DB 更新主要按 `sessionId` 选择“最新 Goal”，没有保证更新的是当前 `goalId`。
10. Clear 只删除 DB，不中止编排器，后台仍可能执行并继续发事件。

## 设计决策

### GoalStatus：持久化目标状态

只允许：

- `active`：目标尚未结束。
- `complete`：目标全部要求已满足并验证通过。
- `failed`：目标执行失败，无法继续完成。
- `aborted`：用户永久中止。

`completed_with_failures` 不再作为 GoalStatus。存在失败计划且最终目标未满足时，Goal 进入 `failed`；失败细节由 plans 和 goal_events 表达。

### GoalRunState：仅内存执行状态

只允许：

- `idle`：没有编排循环运行，可手动 Resume。
- `running`：唯一编排循环正在运行。
- `paused`：唯一编排循环仍存在，但停在安全点等待恢复。

终态 Goal 的 RunState 必须为 `idle`。Pause/Resume 永不修改 DB GoalStatus。

### 状态源边界

- SQLite `goals`：Goal 持久化事实源，保存目标状态、计划快照、进度、预算和使用量。
- `GoalContext`：当前 Worker 进程内的运行态，保存 `RunState`、唯一循环任务和取消对象。
- `goal_progress`：向前端同步瞬时运行态，不作为持久化事实源。
- `.wishful-claw/goals/*.state.json`：项目内可读审计快照；与 DB 同步更新，但不作为启动恢复的首选事实源。
- `AgentRuntimeGoalExecutor`：只做工具适配，不再维护独立 Goal 字典。

## Native AOT 硬性约束

本节是执行和审查的阻断条件，不是建议项。

1. 禁止使用匿名类型参与 `JsonSerializer.Serialize`、`SerializeToElement`、`WorkerResponse.Json` 或任何 IPC/持久化序列化。
2. 新增响应、事件、状态快照或工具结果时，必须定义具名 `record` 或 `class`。
3. 新增序列化类型必须注册到正确的 `JsonSerializerContext`：
   - Agent 类型：`AgentRuntimeJsonContext`
   - Infrastructure 类型：`InfrastructureJsonContext`
   - Worker/IPC 类型：`WishfulClawJsonContext`
4. 泛型集合必须显式注册，例如 `List<GoalPlanItem>`、`List<GoalLifecycleEvent>`。
5. 所有 `WorkerResponse.Json` 必须显式传入对应 `JsonTypeInfo`。
6. 所有 `JsonSerializer.Serialize`、`Deserialize` 和 `SerializeToElement` 必须使用已注册的 `JsonTypeInfo`。
7. 禁止 `Activator.CreateInstance`、`Assembly.GetTypes()`、`System.Reflection` 扫描和动态代码生成。
8. 禁止创建未通过 `WorkerJsonHelper.ConfigureAotResolver` 配置的独立 `JsonSerializerOptions`。
9. `JsonArray.Add<T>` 必须使用 AOT 安全的非泛型 `JsonNode` 重载。
10. 最终必须运行 `scripts/publish-aot-worker.mjs`，结果要求 AOT 0 警告。

## 步骤清单

### [✓] 步骤 1：统一 Goal 状态常量、终态规则和 API 契约

改动：

- 在 Agent 层定义 AOT 友好的 Goal 状态常量和判定方法，消除散落字符串。
- 统一 GoalStatus 为 `active / complete / failed / aborted`。
- 统一 GoalRunState 为 `idle / running / paused`。
- 将编排器的 `completed` 改为 `complete`；将 `completed_with_failures` 收口为 `failed`。
- 更新 `update_goal` schema、Prompt、DTO 注释、前端 `SessionGoalStatus` 和所有终态判断。
- 计划项状态继续使用 `pending / executing / completed / failed`，不得与 GoalStatus 混用。
- 如新增 IPC 返回类型，使用具名 DTO 并完成 JsonSerializerContext 注册。

涉及文件：

- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorModels.cs`
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs`
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs`
- `src/runtime/WishfulClaw.Agent/Tools/Providers/GoalToolProvider.cs`
- `src/runtime/WishfulClaw.Infrastructure/Db/Entities/GoalEntity.cs`
- `src/renderer/src/stores/goal-store-helpers.ts`
- `src/renderer/src/lib/agent/goal-context.ts`
- `src/renderer/src/components/goal/GoalSessionControls.tsx`
- `src/renderer/src/components/goal/goal-session-utils.tsx`

验证检查点：

- Goal 领域不再把 `completed` 当 GoalStatus，也不再写入 `completed_with_failures`。
- `update_goal status=complete` 能通过工具 schema。
- 无匿名类型参与新增序列化。
- C# build 和三个 TypeScript 配置全部零错误。

### [✓] 步骤 2：建立单循环所有权，修复 Resume 双循环和并发竞态

改动：

- `GoalContext` 增加唯一运行任务/循环所有权字段，例如 `RunTask`、同步锁和必要的循环代次标识。
- 将 Start/Resume 收口为一个原子生命周期方法，返回明确结果：`started / resumed / already_running / terminal / not_found`。
- `idle → running`：仅创建一个 `RunAsync`。
- `paused → running`：只唤醒现有循环，不创建新任务。
- `running → Resume`：幂等 no-op。
- 并发两次 Resume 只能有一个调用成功创建循环。
- 循环结束时只能由持有该循环所有权的任务清理 `ActiveGoals`，旧循环不得删除新上下文。
- `GoalModule.ResumeGoal` 统一调用编排器生命周期 API。
- 生命周期 IPC 响应使用具名 DTO，不使用匿名对象。

涉及文件：

- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorModels.cs`
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs`
- `src/runtime/WishfulClaw.Worker/Modules/GoalModule.cs`
- `src/runtime/WishfulClaw.Contracts/AotResultTypes.cs`
- `src/runtime/WishfulClaw.Worker/WishfulClawJsonContext.cs`

验证检查点：

- paused Goal Resume 后只出现一个后续 `PlanStarted`。
- 同时发出两次 Resume，编排器内部只有一个未完成 `RunTask`。
- running Goal 再次 Resume 不创建任务、不重置计时。
- Worker IPC 返回真实 action/result，Goal 不存在或终态时不返回伪成功。
- 新增 DTO 均完成 AOT 注册，`WorkerResponse.Json` 显式传 `JsonTypeInfo`。

### [✓] 步骤 3：连接取消链路，明确 Pause/Abort 安全点

改动：

- 为每个 Goal 编排循环创建专属 `AgentRuntimeRunState`，并将 Goal CancellationToken 连接到该 run state。
- 目标分解、计划执行、自检评估、429 退避均使用同一 Goal 取消链路。
- Abort：取消当前子 Agent，等待循环退出，再持久化 `aborted`。
- Pause：不取消当前子 Agent；当前子 Agent 返回后，在自检、重试或启动下一计划前进入 paused 等待。
- 在分解前后、计划执行前后、自检前后、每次 retry 前、429 等待前后、最终评估前统一检查 Pause/Abort。
- Abort 后不得把 Cancelled 结果继续送入自检或 retry。

涉及文件：

- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs`
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs`
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLLM.cs`
- `src/runtime/WishfulClaw.Agent/AgentRuntimeRunState.cs`（仅当现有 API 不足时修改）
- `src/runtime/WishfulClaw.Agent/SubAgentExecutor.cs`（优先复用 parentState 取消传播）

验证检查点：

- 正在执行计划时 Abort，子 Agent 状态进入 canceled，后续不启动自检、重试或下一计划。
- 正在执行计划时 Pause，当前子 Agent完成后停止，Resume 后从正确安全点继续。
- 429 退避期间 Abort 立即退出；Pause 后不再重新执行计划，直到 Resume。

### [✓] 步骤 4：修复计划快照持久化和精确 Goal 查询

改动：

- 修复 `plansJson` 双重编码：DB 中存储 JSON 数组文本，不存带外层引号的 JSON 字符串。
- `List<GoalPlanItem>` 使用 `AgentRuntimeJsonContext.Default.ListGoalPlanItem` 等显式 JsonTypeInfo 序列化和反序列化。
- 新增按 `goalId + sessionId` 精确读取和更新的 Infrastructure API；Orchestrator 不再按 sessionId 选择“最新一条”。
- `ResumeFromDb` 校验传入 goalId 与数据库记录一致。
- 新写入路径使用事务式 Set/Replace，保证同一 session 不出现多个当前 Goal。
- 为已有数据库提供幂等迁移/清理策略后再增加唯一索引，避免旧数据导致启动失败。
- DB plans 快照与 `.state.json` 使用同一状态值和 currentPlanIndex 语义。

涉及文件：

- `src/runtime/WishfulClaw.Infrastructure/Db/DbGoalTools.cs`
- `src/runtime/WishfulClaw.Infrastructure/Db/DbClient.cs`
- `src/runtime/WishfulClaw.Infrastructure/Db/Entities/GoalEntity.cs`
- `src/runtime/WishfulClaw.Infrastructure/InfrastructureJsonContext.cs`
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs`
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs`
- `src/runtime/WishfulClaw.Agent/Goal/GoalFileTools.cs`
- `src/runtime/WishfulClaw.Agent/AgentRuntimeJsonContext.cs`

验证检查点：

- `List<GoalPlanItem> → DB → GoalRow.PlansJson → Deserialize` 完整往返一致。
- 重启恢复后 plans 数量、状态、retryCount、currentPlanIndex 与重启前一致。
- 旧 Goal 后台同步不能覆盖同 session 的新 Goal。
- 迁移对无重复数据和有历史重复数据的数据库都可幂等执行。
- 所有序列化调用均使用已注册 JsonTypeInfo，AOT 编译无新增警告。

### [✓] 步骤 5：统一终态收尾和持久化顺序

改动：

- 新增唯一的 Goal 收尾方法，覆盖 complete、failed、aborted 和未处理异常。
- 收尾顺序固定为：
  1. 设置 GoalStatus 终态；
  2. 设置 RunState=`idle`；
  3. 更新计划快照和 currentPlanIndex；
  4. 写 `.state.json`；
  5. 按 goalId 精确更新 DB；
  6. 写关键 goal_event；
  7. 发送最终 `goal_progress`；
  8. 清理运行上下文。
- 分解失败、外层异常、取消和正常完成均走同一收尾方法，禁止提前 return 绕过持久化。
- GoalCompleted、GoalFailed、GoalAborted 事件语义分开。
- 新增事件/状态 DTO 必须是具名类型并注册 AOT JsonTypeInfo。

涉及文件：

- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs`
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs`
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorModels.cs`
- `src/runtime/WishfulClaw.Infrastructure/Db/DbGoalTools.cs`
- `src/renderer/src/stores/goal-store-helpers.ts`

验证检查点：

- 正常完成：DB=`complete`、RunState=`idle`、前端计时停止。
- 分解失败：DB=`failed`，重启后不会作为 active Goal 恢复。
- Abort：DB=`aborted`，最终事件携带 idle。
- 所有 `RunAsync` 退出路径均走统一收尾。
- 新增事件和响应序列化满足 AOT 硬性约束。

### [ ] 步骤 6：删除工具层独立状态源，统一 Goal 工具行为

改动：

- 删除 `AgentRuntimeGoalExecutor.Goals` 静态字典及 `GoalRecord` 副本。
- `get_goal` 从 SQLite 读取持久化 Goal，并从 Orchestrator 合并当前 RunState 和计划进度。
- `create_goal` 的 pending 确认流程仍可在 `PendingGoals` 中暂存，但确认后只创建一条 DB Goal，并通过 Orchestrator 启动。
- `update_goal` 更新持久化 Goal；终态更新走编排器统一收尾或明确拒绝与运行循环竞争。
- `pause_goal / resume_goal / abort_goal` 直接调用统一生命周期 API，返回真实状态和错误。
- 所有工具返回值使用具名 AOT DTO，禁止手写匿名序列化对象。

涉及文件：

- `src/runtime/WishfulClaw.Agent/AgentRuntimeGoalExecutor.cs`
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs`
- `src/runtime/WishfulClaw.Agent/Tools/Providers/GoalToolProvider.cs`
- `src/runtime/WishfulClaw.Infrastructure/Db/DbGoalTools.cs`
- `src/runtime/WishfulClaw.Contracts/AotAgentResultTypes.cs` 或现有 Goal AOT DTO 文件
- `src/runtime/WishfulClaw.Agent/AgentRuntimeJsonContext.cs`

验证检查点：

- Worker 重启后 `get_goal` 不返回 null，且 goalId/objective/status 与 DB、UI 一致。
- `update_goal status=complete` 保留 goalId，不产生新的内存副本。
- 工具调用与 UI IPC 对 Pause/Resume/Abort 得到相同结果。
- 无匿名类型序列化，所有结果 DTO 已注册 JsonTypeInfo。

### [ ] 步骤 7：收口前端运行态、按钮和清除流程

改动：

- 所有 Goal UI 区域统一使用 `runState` 决定 Pause/Resume，使用 GoalStatus 决定是否允许继续。
- `goal_progress` 解析统一从 Input 中读取 `runState`，去掉临时 `console.warn`。
- 终态或 Goal clear 时同时清理 progress、runState、activeRun。
- Clear running/paused Goal 改为后端原子流程：`Abort → 等待循环退出 → 删除 DB → 清前端状态`；若失败，UI 保留 Goal 并提示错误。
- `abortGoal` 不再把 DB status 改成 `paused`。
- Pause 不再调用仅清 UI streaming id 的 `abortSession` 假装取消运行。
- GoalManagerDialog、GoalSessionBar、GoalPanelCard 采用同一派生状态 helper。
- 保留用户当前未提交的“0 秒不展示”和文案调整，不覆盖这些修改。

涉及文件：

- `src/renderer/src/stores/chat-store/index.ts`
- `src/renderer/src/stores/goal-store.ts`
- `src/renderer/src/stores/goal-store-helpers.ts`
- `src/renderer/src/components/goal/GoalSessionControls.tsx`
- `src/renderer/src/components/goal/goal-session-utils.tsx`
- `src/renderer/src/components/goal/goal-session-views.tsx`
- `src/renderer/src/lib/tools/goal-native-ui.ts`
- `src/shared/messagepack/binary-ipc.ts`
- `src/main/index.ts`
- `src/runtime/WishfulClaw.Worker/Modules/GoalModule.cs`

验证检查点：

- idle 显示 Resume、不计时；running 显示 Pause、计时；paused 显示 Resume、不计时；终态无 Resume/Pause。
- 三个 Goal UI 区域展示一致。
- Clear 进行中 Goal 后，后端无 ActiveGoal、DB 无 Goal、前端无 progress/runState/activeRun。
- IPC 失败有 toast，不能静默吞掉并乐观改错状态。

### [ ] 步骤 8：补 Goal 生命周期回归测试和故障注入 seam

改动：

- 为 GoalOrchestrator 提取最小可注入执行 seam，使测试可使用可控的分解器、计划执行器和事件收集器，不依赖真实 Provider。
- 新增小型 .NET 测试或回归工程，优先覆盖纯生命周期和 DB 往返。
- 测试工程不被 Worker 生产项目引用，不进入 AOT 发布产物。
- 测试代码同样禁止匿名类型参与生产序列化路径。
- 覆盖至少以下场景：
  1. idle Resume 创建唯一循环；
  2. paused Resume 只唤醒旧循环；
  3. 并发双 Resume 不重复执行；
  4. Abort 传播到当前子 Agent；
  5. Pause 停在安全点；
  6. plansJson 往返；
  7. 重启恢复为 idle，并从正确计划继续；
  8. complete/failed/aborted 统一收尾；
  9. 分解失败持久化 failed；
  10. Clear 不留下后台循环；
  11. 旧 goalId 不能覆盖新 Goal；
  12. 工具 get_goal 与 DB/Orchestrator 一致。

涉及文件：

- `src/runtime/WishfulClaw.Agent/Goal/` 下按职责新增内部 seam 文件
- `src/runtime/WishfulClaw.Goal.Tests/WishfulClaw.Goal.Tests.csproj`（新建，具体测试方案在执行前根据可用 SDK/包缓存选择）
- `src/runtime/WishfulClaw.Goal.Tests/*.cs`
- `src/runtime/WishfulClaw.sln`

验证检查点：

- 生命周期测试全部通过，并能稳定覆盖双循环、plansJson 和 Abort 问题。
- 测试不访问真实模型、不依赖网络、不修改用户实际 `~/.wishful-claw/index.db`。
- Worker 普通 build 与 Native AOT 发布不包含测试程序集。

### [ ] 步骤 9：应用级冒烟验证与文档闭环

验证场景：

1. 创建 Goal → 确认 → 自动拆分并启动。
2. 计划执行中 Pause → 当前计划安全停下 → Resume → 只继续一次。
3. 连续点击两次 Resume → 无重复 PlanStarted。
4. 计划执行中 Abort → 子 Agent 停止 → Goal 为 aborted。
5. 运行中退出 Worker/应用 → 重启后 Goal 为 active + idle → 手动 Resume 从正确计划继续。
6. 正常完成 → Goal 为 complete，计时停止，重启不恢复。
7. 人为制造分解失败 → Goal 为 failed，重启不恢复。
8. 运行中 Clear → 无后台任务和后续 goal_progress。

输出：

- `docs/plans/iter-v2-12/lifecycle-review-report.md`
- `docs/plans/iter-v2-12/lifecycle-verification-report.md`
- 更新 `docs/PROGRESS.md`

验证检查点：

- `dotnet build src/runtime/WishfulClaw.sln`：0 错误。
- `npx tsc --noEmit -p tsconfig.web.json`：0 错误。
- `npx tsc --noEmit -p tsconfig.node.json`：0 错误。
- `npx tsc --noEmit -p tsconfig.json`：0 错误。
- `node scripts/publish-aot-worker.mjs`：AOT 0 警告。
- Goal 生命周期回归测试全部 PASS。
- 应用级 8 个场景均有日志或截图证据。
- 独立代码审查 0 个阻断项。

## 涉及模块汇总

### Agent

- GoalOrchestrator 生命周期与循环所有权
- Goal 状态模型和事件
- 子 Agent 取消传播
- Goal 工具 facade
- 计划快照与项目状态文件

### Infrastructure

- Goal 精确 CRUD
- plansJson 存储
- session 唯一当前 Goal 约束和幂等迁移
- goal_events 关键生命周期记录

### Worker / Contracts

- Pause/Resume/Abort/Clear/Status IPC 契约
- AOT 具名响应 DTO 与 JsonTypeInfo 注册

### Renderer / Main / Shared

- goal_progress 解析
- Goal store 清理和派生状态
- 三处 Goal UI 控制一致性
- 原子 Clear 流程和错误反馈

## 风险与处理

1. 当前工作区不干净：执行前先形成安全检查点，任何修复不得覆盖用户已有 UI/locale 修改。
2. DB 唯一索引迁移风险：必须先处理历史重复 session Goal，再创建索引；迁移要幂等并在副本数据库验证。
3. 取消语义变化风险：Goal 专属 parentState 可能影响事件 runId；测试需核对前端仍能按 payload.sessionId 路由。
4. Clear 原子性：等待循环退出需要有限超时；超时应返回失败并保留 DB，不能先删后等。
5. 测试框架缺失：项目目前没有测试工程。优先选择与 .NET 10/AOT 兼容且不污染生产依赖的方案；若包不可用，使用无第三方依赖的回归控制台程序，但不得降低场景覆盖。
6. 历史状态兼容：已有 `completed`、`completed_with_failures`、`paused` DB 记录需一次性归一化迁移，不能只修新数据。
7. AOT 序列化风险：每一步审查新增 DTO、集合 JsonTypeInfo 和 `WorkerResponse.Json` 调用；普通 build 通过不能替代 AOT 验证。

## 不在本迭代范围

- Goal 并行计划执行。
- 多 Goal 同会话并存。
- Goal 跨设备同步。
- 新的 Goal 管理页面或大规模视觉重设计。
- Token/时间预算策略重写。
- 将 `.state.json` 改为主事实源。
- 与本次生命周期无关的 AgentLoop、Provider 或 SubAgent 重构。

## 完成判定

以下条件全部满足后进入用户验收，不由 Agent 自行宣布迭代完成：

1. 状态枚举全链路一致，GoalStatus 与 PlanStatus 不混用。
2. 任意时刻每个 Goal 至多一个编排循环。
3. Pause/Resume/Abort 行为符合定义，Abort 能取消当前子 Agent。
4. DB、`.state.json`、Orchestrator、工具 `get_goal` 和前端展示一致。
5. 重启恢复不会丢计划、重复计划或自动启动。
6. 所有终态均持久化，最终 RunState 为 idle。
7. Clear 不留下后台任务。
8. 所有新增序列化均使用具名类型、已注册 JsonTypeInfo，0 个匿名类型序列化。
9. 生命周期回归测试、C#、三个 TypeScript 配置和 AOT 全部通过。
10. 应用级 8 个冒烟场景有实际日志或截图证据。
11. 独立代码审查 0 个阻断项，用户最终裁定 PASS。
