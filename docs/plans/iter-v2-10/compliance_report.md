# Compliance Report — v2-iter-10 规划验证

## 检查项

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 步骤完整覆盖任务目标 | ✅ | 7 步覆盖工具注册、executor、路由、主进程、renderer bridge、端到端验证 |
| 每步有明确验证检查点 | ✅ | 每步标注 `dotnet build` / `tsc` 验证 |
| 文件路径符合项目结构（AGENTS.md） | ✅ | 工具定义放 `WishfulClaw.Agent/Tools/Providers/`，executor 放 `WishfulClaw.Agent/`，主进程/前端路径正确 |
| 分层依赖正确 | ✅ | Agent 层 executor 通过 `DbClient` 访问 Infrastructure 层 Db；reverse request 走既有 `AgentRuntimeReverseRequests` |
| 工具注册机制符合现状 | ✅ | 核验 `IToolProvider` + `ToolProviderDiscovery` 自动发现 + `ToolDefinitionPlaceholder`；新工具归 `project` 类别，需加入 chat/coding/full preset 的 AllowedCategories |
| send_session_message 落地方式可行 | ✅ | 核验 reverse request 全链路（Worker → main `rendererMethods` → renderer `renderer-tool-bridge` → sendMessage 回调）；需在 rendererMethods 加 `project/send-session-message` |
| get_project_details 触发整理时序可行 | ✅ | send_session_message 走 reverse request 等待 renderer 整个 run 完成后返回，工具内先触发整理再读文件，天然解决时序 |
| 任务状态机制符合需求 | ✅ | 固定目录 `.wishful-claw/project-status.md` + 固定模版消息，项目会话自己整理，不扫 plans/goals 兜底 |

## 发现的补充项（需在执行态落实）

1. **ToolPreset 需修改**：`WishfulClaw.Core/Tools/ToolPreset.cs` 的 `chat` / `coding` preset 需在 `AllowedCategories` 中加入 `"project"`，或在 `AllowedTools` 中显式加入 4 个工具名——确保全局会话（项目经理）能访问这些工具。规划文档"涉及文件"需补入该文件。

2. **category 归属**：新增 `ProjectToolsProvider` 的 `Category = "project"`，通过 `PushCategory` 关联 4 个工具。

3. **main 进程 reverse 超时**：`SIDECAR_RENDERER_REQUEST_TIMEOUT_MS` 需确认足够覆盖 send_session_message 触发项目会话整个 run 的时长，必要时为该方法单独放宽。

## 结论

规划方案通过合规检查，可进入执行态。补充项（ToolPreset 修改）已纳入执行范围。
