# Plan 8: PromptBuilder 集成 + 系统提示词 + 集成验证

## 目标

完成 PromptBuilder 对 Goal 模式的系统提示词适配，编排层和执行层的提示词调优，端到端集成验证。确保从"设定目标"到"Goal 达成"的完整链路跑通。

## 步骤清单

- [x] 步骤1：编排层系统提示词 — GoalOrchestrator 调 LLM 做目标拆分和自检评估时的 system prompt：角色定义（"你是 Goal 编排器"）、拆分规则（每计划粒度、验收标准）、评估标准（什么算达标）、调整策略（失败后怎么改）
- [x] 步骤2：执行层系统提示词 — 子 Agent 在 Goal 模式下的 guidance 注入："你处于自主执行模式，不需要等待用户确认，自行评估计划合理性后直接执行"
- [x] 步骤3：PromptBuilder 集成 — Goal 模式引导通过工具返回值注入（与计划模式一致的策略），不修改 system prompt 基础结构
- [x] 步骤4：目标拆分 prompt 模板 — 目标拆分 LLM 调用的 prompt 模板：包含项目上下文（工作区路径 + AGENTS.md + iteration-plan.md 摘要）+ 目标文本 + 输出格式要求（JSON 计划列表）
- [x] 步骤5：自检评估 prompt 模板 — 自检 LLM 调用的 prompt 模板：包含 Goal 目标 + 计划描述 + 子 Agent 执行结果 + 评估要求（达标/不达标/调整方案）
- [x] 步骤6：端到端测试 — 设定真实目标（如"给项目加 eslint 配置"），跑完整流程：拆分计划 → 子 Agent 串行执行 → 自检评估 → 状态更新 → 前端面板展示
- [x] 步骤7：429 模拟测试 — 模拟 429 错误（临时改 Provider 返回 429），验证退避策略正确触发，恢复后继续
- [x] 步骤8：中断测试 — 执行中点暂停 → 确认停止 → 点恢复 → 确认继续 → 点中止 → 确认停止
- [x] 步骤9：失败重试测试 — 子 Agent 故意返回失败结果，验证 LLM 自检评估 → 调整方案 → 重新分配子 Agent
- [x] 步骤10：三编译验证 — `dotnet build src/runtime/WishfulClaw.sln` + 三个 `tsc --noEmit -p` 全部零错误
- [x] 步骤11：应用启动验证 — `npm run dev` 启动应用，核心对话 + 工具调用 + 记忆 + 人格 + 计划模式全链路不回归

## 验证检查点

- 设定目标 → 完整跑通拆分 → 串行执行 → 自检 → 状态更新 → 前端展示
- 429 模拟 → 退避策略正确触发 → 恢复后继续
- 中断 → 暂停/恢复/中止正常
- 失败 → 自检评估 → 调整重试正常
- 编译零错误，核心功能不回归

## 涉及文件

- `src/runtime/WishfulClaw.Persona/PromptBuilder.cs` — 修改（Goal 模式 guidance 注入）
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLLM.cs` — 修改（prompt 模板调优）
- `src/runtime/WishfulClaw.Agent/Goal/GoalPromptTemplates.cs` — 新建（prompt 模板常量，拆分保持文件 < 500 行）
- `src/runtime/WishfulClaw.Agent/Goal/GoalOrchestrator.cs` — 修改（集成验证修复）

## 参考源码

- 现有 PromptBuilder.cs — guidance 注入模式参考
- 现有 AgentRuntimePlanExecutor guidance 注入 — 工具返回值注入模式参考
- Codex `D:\claw\codex\codex-rs\core\src\prompts\` — prompt 模板组织方式参考
- Codex `D:\claw\codex\codex-rs\core\src\session_prefix.rs` — session 前缀注入参考
