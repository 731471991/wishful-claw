# Plan: v2-iter-10 全局会话 + 项目编排工具

## 目标

全局会话作为"项目经理"小助手：用户只跟它沟通，它代替用户跟各个项目下的会话打交道——查询项目任务进度、给项目会话发布任务。全局会话自己不做具体执行，是调度/管理角色。同时打通微信渠道端到端场景。

## 背景

用户通过微信/全局会话发消息（如"xx 项目做完没"）→ 全局 Agent 作为项目经理 → 查询项目列表、项目下会话与任务状态 → 回复进度；需要派活时，给项目会话发任务消息。

## 设计决策（与老大确认）

### 角色定位
- 全局会话 = 项目经理助手，不绑项目目录，可正常聊天问答
- 只做查询 + 派发，不做具体执行

### 工具集（4 个）
| 工具 | 职责 | 执行位置 |
|------|------|---------|
| `list_projects` | 只列项目清单（id + 名称 + 路径），用于定位"有哪些项目" | Worker 内（读 DB） |
| `get_project_details` | 查某项目详情：该项目下会话列表 + 任务状态（取代 get_sessions） | Worker 内（读 DB + 读固定状态文件） |
| `create_session` | 给项目创建新会话 | Worker 内（写 DB） |
| `send_session_message` | 以用户身份向目标会话发消息/发布任务 | reverse-request → renderer 正常 sendMessage |

### 任务状态：固定目录 + 固定消息模版（关键决策）
- 任务和 goal 会越积越多，不采用"扫描 `.wishful-claw/plans/` + `goals/` 目录全量解析"的方式
- 约定固定目录 `.wishful-claw/project-status.md`：项目会话在收到模版消息后**自己整理**出干净、稳定的项目任务状态总览
- `get_project_details` 只读这个固定文件，**不扫 plans/goals 目录兜底**
- 固定消息模版：项目经理向项目会话发送标准化指令，引导其整理输出

### 落地方式
- `send_session_message` 完全走前端：通过 reverse request（`project/send-session-message`）转发给 renderer，renderer 用正常 `sendMessage` 链路执行（完全模拟用户操作）
- 复用现有的 reverse request 架构：Worker → `agent/reverse-request` → 主进程 `rendererMethods` → renderer `renderer-tool-bridge` → 回传响应

### 范围边界
- 只做后端 4 工具 + 全局会话可聊天 + 打通微信端到端
- **不做**前端项目管理 UI

## 步骤清单

### 步骤1：工具定义注册（4 个 IToolProvider）
- **文件**：`src/runtime/WishfulClaw.Agent/Tools/Providers/ProjectToolsProvider.cs`（新建）
- 定义 `list_projects` / `get_project_details` / `create_session` / `send_session_message` 的 ToolDefinitionPlaceholder 与输入 schema
- 遵循 AskUserToolProvider 的 IToolProvider 模式（自动发现注册）
- 验证：`dotnet build` 通过

### 步骤2：后端 Executor（list_projects / get_project_details / create_session）
- **文件**：`src/runtime/WishfulClaw.Agent/AgentRuntimeProjectExecutor.cs`（新建，partial class 按需拆分）
- `list_projects`：`DbClient.GetClient(parameters)` 查 ProjectEntity 列表，返回 id/name/working_folder
- `get_project_details`：查项目下会话 + 读 `.wishful-claw/project-status.md`；**文件不存在时，自动通过 `send_session_message` 向该项目会话发送固定模版消息触发整理，等整理完成后再读回文件返回**
- `create_session`：复用 `DbPluginSessionTools.CreatePluginSession` 逻辑，给项目建会话
- 验证：`dotnet build` 通过

### 步骤3：send_session_message Executor（reverse request）
- **文件**：`src/runtime/WishfulClaw.Agent/AgentRuntimeProjectExecutor.cs`（同一文件或拆分）
- 通过 `AgentRuntimeReverseRequests.RequestAsync(context, "project/send-session-message", params, token)` 转发给 renderer
- 入参：`sessionId` + `content`（消息内容）+ 可选 `workingFolder` / `projectId`
- 验证：`dotnet build` 通过

### 步骤4：ToolDispatchRouter 接入
- **文件**：`src/runtime/WishfulClaw.Agent/ToolDispatchRouter.cs`
- 新增 `AgentRuntimeProjectExecutor.IsProjectTool(toolCall.Name)` 分支，分发 4 个工具
- 验证：`dotnet build` 通过

### 步骤5：主进程 rendererMethods 注册
- **文件**：`src/main/ipc/native-agent-runtime.ts`
- 在 `rendererMethods` Set 中加入 `'project/send-session-message'`
- 验证：`npx tsc --noEmit -p tsconfig.node.json`

### 步骤6：renderer bridge + sendMessage 调用
- **文件**：`src/renderer/src/lib/ipc/renderer-tool-bridge.ts`
- 新增 `project/send-session-message` 分支，handler 调用 chat-store 的正常 `sendMessage`（复用 use-channel-auto-reply 的调用模式）
- 构建 provider 参数、注入用户消息、触发 agent/run，返回执行结果
- 验证：`npx tsc --noEmit -p tsconfig.web.json`

### 步骤7：全局会话 + 微信端到端验证
- 全局会话可正常聊天问答
- 微信发"xx 项目做完没" → Agent 调 `list_projects` → `get_project_details` 读项目状态 → 回复进度
- 需要派活 → `create_session` + `send_session_message` 给项目会话发任务 → 项目会话整理出 `project-status.md`
- 验证：三条 tsc + `dotnet build` 全零错误

## 涉及文件

### 新建
- `src/runtime/WishfulClaw.Agent/Tools/Providers/ProjectToolsProvider.cs` — 4 工具定义
- `src/runtime/WishfulClaw.Agent/AgentRuntimeProjectExecutor.cs` — 3 个 Worker 内工具 + send_session_message executor

### 修改
- `src/runtime/WishfulClaw.Agent/ToolDispatchRouter.cs` — 分发 4 工具
- `src/runtime/WishfulClaw.Core/Tools/ToolPreset.cs` — chat/coding/full preset 的 AllowedCategories 加 `"project"` 类别
- `src/main/ipc/native-agent-runtime.ts` — rendererMethods 加 `project/send-session-message`
- `src/renderer/src/lib/ipc/renderer-tool-bridge.ts` — 处理 `project/send-session-message`，调 sendMessage

### 复用（不新建）
- `WishfulClaw.Infrastructure/Db/DbProjectTools.cs` — 项目查询
- `WishfulClaw.Infrastructure/Db/DbPluginSessionTools.cs` — 会话创建/查询
- `WishfulClaw.Agent/AgentRuntimeReverseRequests.cs` — reverse request
- renderer `sendMessage` 正常链路

## 风险与注意事项

1. **send_session_message 异步性**：reverse request 等待 renderer 完成整个 agent/run 后返回，可能耗时较长；需确认主进程 reverse request 超时设置（SIDECAR_RENDERER_REQUEST_TIMEOUT_MS）是否足够，必要时为该方法单独放宽
2. **全局会话的 toolPreset**：项目经理场景需要能访问 4 个项目工具，确认 chat 预设包含这些工具
3. **project-status.md 不存在**：get_project_details 自动通过 send_session_message 发固定模版消息给项目会话触发整理，等整理完成后读回文件；需处理"等待整理完成"的时序（项目会话 agent/run 完成后文件才落盘）
4. **微信端到端**：涉及微信渠道入站路由（projectId 为 null 走全局），需确认 auto-reply 链路能驱动全局会话

## 验证标准

- 新建全局会话 → 正常聊天问答
- 微信发"xx 项目做完没" → Agent 调 list_projects 查到项目 → get_project_details 查会话与任务状态 → 有活跃任务回复"正在执行中"，无则 create_session + send_session_message 派发任务
- 三个 tsconfig 全部零错误 + dotnet build 通过
