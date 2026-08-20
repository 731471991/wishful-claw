# 合规审查报告：v2-iter-12 Goal 生命周期一致性收口

## 审查范围

- `docs/plans/iter-v2-12/lifecycle-exploration-findings.md`
- `docs/plans/iter-v2-12/lifecycle-plan.md`
- `AGENTS.md` 七层架构、AOT 编译规范、大文件拆分规范和迭代交付标准
- `docs/dev-workflow.md` 六阶段开发工作流

## 审查结果

| 检查项 | 结果 | 说明 |
|---|---|---|
| 目标覆盖 | 通过 | 9 个步骤覆盖状态统一、循环所有权、取消传播、持久化、终态、工具状态源、前端、测试和应用验证 |
| 每步验证检查点 | 通过 | 每个步骤均定义可观察、可自动化或可提供日志证据的验证项 |
| 文件路径符合架构 | 通过 | 编排逻辑位于 Agent，DB 位于 Infrastructure，IPC 组合位于 Worker，DTO 位于 Contracts，UI 位于 Renderer |
| 依赖方向 | 通过 | 未要求 Infrastructure 依赖 Agent，未要求 Core/Contracts 引用上层项目 |
| AOT 约束 | 通过 | 已设独立硬性约束；具名 DTO、JsonSerializerContext、显式 JsonTypeInfo 和 AOT 0 警告均为阻断条件 |
| 匿名类型序列化 | 通过 | 计划明确禁止所有新增匿名类型参与 JSON/IPC/持久化序列化 |
| 历史数据兼容 | 通过 | 计划包含 completed/completed_with_failures/paused 历史状态归一化和唯一索引前的数据清理 |
| 用户工作保护 | 通过 | 执行前置条件明确保护当前未提交 Goal UI/locale/chat-store 改动 |
| 测试策略 | 通过 | 覆盖 12 类生命周期回归和 8 个 Electron + Worker 冒烟场景 |
| 最终用户裁定 | 通过 | 计划明确由用户裁定 PASS/FAIL/PARTIAL，Agent 不自行宣布完结 |

## AOT 专项审查

### 必须执行

1. 新增 IPC、事件、工具结果和状态快照必须使用具名 `record` 或 `class`。
2. 所有新增类型及集合类型注册到对应 `JsonSerializerContext`。
3. 所有 `WorkerResponse.Json` 显式传 `JsonTypeInfo`。
4. 所有 `JsonSerializer.Serialize`、`Deserialize`、`SerializeToElement` 使用已注册的 `JsonTypeInfo`。
5. 禁止匿名类型序列化、反射扫描、动态实例化和未配置 resolver 的独立 JsonSerializerOptions。
6. 执行 `scripts/publish-aot-worker.mjs`，要求 0 警告。

### 执行态审查重点

- `GoalModule` 生命周期响应 DTO。
- `AgentRuntimeGoalExecutor` 的 get/update/pause/resume/abort 返回值。
- `goal_progress` 和 goal_events 新增字段或事件。
- `plansJson` 的 `List<GoalPlanItem>` JsonTypeInfo。
- DB 迁移或测试辅助类型是否误进入生产序列化路径。

## 风险判定

| 风险 | 等级 | 计划中的控制措施 |
|---|---|---|
| Resume 双循环导致重复执行 | 阻断 | 唯一 RunTask、原子状态迁移、并发 Resume 回归测试 |
| Abort 无法取消子 Agent | 阻断 | Goal 专属 parentState 和取消传播测试 |
| plansJson 恢复为空 | 阻断 | 显式 JsonTypeInfo 往返测试 |
| 终态未落库或 runState 不归零 | 阻断 | 统一收尾方法和所有退出路径检查 |
| 工具/DB/UI 状态分叉 | 阻断 | 删除工具层独立字典，DB 作为持久化事实源 |
| Clear 留下后台执行 | 阻断 | 后端原子 Abort/等待/Delete 流程 |
| AOT 序列化回归 | 阻断 | 具名 DTO、Context 注册、AOT 0 警告 |
| DB 唯一索引破坏旧数据 | 高 | 幂等清理后建索引，使用副本数据库验证 |
| 覆盖用户未提交改动 | 高 | 执行前安全检查点，禁止 reset/checkout 用户文件 |

## 审查结论

规划方案符合项目开发工作流、七层架构和 Native AOT 规范。

阻断项：0。

用户已确认计划，可进入执行态；执行期间按步骤验证并保留可回滚检查点。
