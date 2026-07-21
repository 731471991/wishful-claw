# 迭代三探索报告：Agent Loop + 对话

## 探索日期
2026-07-21

## 当前项目状态

### 已有基础设施
- **IPC 通信**：Named Pipe + MessagePack 帧协议（前后端已跑通）
- **Worker 模块系统**：`IWorkerModule` + `WorkerModuleCatalog` + `WorkerDispatcher`
- **WorkerRequestContext**：支持 `EmitEventAsync`（JSON 事件）和 `EmitMessagePackEventAsync`（二进制事件）
- **前端 IPC**：`messagepack-handler.ts` + `window-ipc.ts`（支持 main→renderer MessagePack 推送）
- **Provider 管理**：28 个预设 + CRUD + 连通性测试 + 模型拉取（迭代二完成）
- **前端 Store**：Zustand + persist（provider-store, settings-store, ui-store）

### 关键缺口（迭代三需补齐）
1. **native-worker.ts 不处理事件帧**：当前 `handleResponseFrame` 只处理 response（有 `id` 的），不处理 event（有 `event` 字段的）。Agent Loop 的流式事件需要通过 event 帧推送到前端
2. **无 Agent Loop**：后端没有 `agent/run` 等端点
3. **无流式协议**：没有 `agent-stream-protocol.ts` / `agent-stream-codec.ts`
4. **无聊天 UI**：前端没有对话界面

## OpenCowork Agent Loop 架构分析

### 核心文件清单

| 文件 | 行数 | 职责 | 搬入策略 |
|------|------|------|----------|
| AgentRuntimeModule.cs | 29 | 端点注册 | 直接搬入，去掉 team/subagent 端点 |
| AgentRuntimeTools.cs | 516 | Run/Cancel/EmitAsync/RunState | 搬入核心，去掉 SubAgent/Team/Reverse |
| AgentRuntimeModels.cs | 156 | 数据模型（StreamEvent/Envelope/Usage 等） | 搬入，去掉 SubAgent 相关字段 |
| AgentRuntimeProviderModels.cs | 33 | ProviderTurnResult/ChatMessage/ToolCall | 直接搬入 |
| AgentRuntimeProviderSupport.cs | 268 | 共享工具方法（Header/JSON/图片等） | 搬入，去掉图片相关方法 |
| OpenAIChatRuntime.cs | 3828 | 主 Loop + openai-chat provider | **拆分**为 AgentLoop + OpenAIChatProvider |
| AgentRuntimeAnthropicMessagesProvider.cs | 134 | Anthropic provider 入口 | 搬入，去掉 cache_control/sanitizer |
| AgentRuntimeAnthropicMessagesEventParser.cs | 226 | Anthropic SSE 解析 | 直接搬入 |
| AgentRuntimeAnthropicMessagesInputWriter.cs | 888 | Anthropic 请求体构建 | 搬入简化版（去 cache_control） |
| AgentRuntimeAnthropicMessagesHeaders.cs | 51 | Anthropic 请求头 | 搬入，去掉 longcat 特殊处理 |
| AgentRuntimeAnthropicMessagesState.cs | 183 | Anthropic 解析状态/工具方法 | 直接搬入 |
| AgentRuntimeAnthropicMessagesWriteState.cs | 87 | 写入状态校验 | 直接搬入 |
| AgentRuntimeAnthropicMessagesRequestValidator.cs | 151 | 请求体校验 | 搬入简化版 |
| AgentRuntimeContextCompression.cs | 717 | 上下文压缩 | 搬入简化版（基础摘要） |
| AgentRuntimeHooks.cs | 260 | Hook 系统 | **跳过**（MVP 不需要） |
| AgentStreamMessagePackEmitter.cs | ~400 | 流事件 MessagePack 编码 | 搬入，去掉 SubAgent 相关字段 |
| 前端 chat-store.ts | 5409 | 聊天状态管理 | **重写简化版** |
| 前端 agent-stream-receiver.ts | 141 | 流事件接收 | 直接搬入 |
| 前端 stream-event-adapter.ts | 69 | 事件适配 | 搬入简化版 |
| 前端 MessageList.tsx | 2601 | 消息列表 | **重写简化版** |
| 前端 InputArea.tsx | 4852 | 输入区域 | **重写简化版** |
| 前端 AssistantMessage.tsx | 3277 | 助手消息渲染 | **重写简化版** |
| 前端 UserMessage.tsx | 875 | 用户消息渲染 | 搬入简化版 |

### Agent Loop 核心流程

```
前端调用 agent/run
  ↓
AgentRuntimeTools.RunAsync
  → 创建 AgentRuntimeRunState（含 CancellationToken）
  → 返回 { started: true, runId }（立即返回，后台执行）
  → Task.Run(ExecuteRunAsync)
      ↓
      EmitAsync(loop_start)
      ↓
      OpenAIChatRuntime.ExecuteLoopAsync
        → for each iteration:
            → 检查 cancellation
            → 检查 context compression（token 超阈值时触发）
            → ExecuteTurnAsync（调 Provider）
                → openai-chat: POST /chat/completions (stream=true)
                → anthropic: POST /v1/messages (stream=true)
                → 解析 SSE → EmitAsync(text_delta / thinking_delta / tool_use_*)
            → 如果无 tool_calls → 结束
            → 如果有 tool_calls → 执行工具 → 继续
      ↓
      EmitAsync(loop_end)
```

### 流式事件管道

```
Worker (C#)
  → AgentRuntimeTools.EmitAsync(StreamEvent)
  → AgentStreamMessagePackEmitter.Encode(envelope)
  → WorkerMessagePackEvent("agent/stream", bytes)
  → WorkerRequestContext.EmitMessagePackEventAsync()
  → Named Pipe → Main 进程

Main 进程 (TS)
  → native-worker.ts handleResponseFrame (检测 event 字段)
  → EventEmitter.emit('agent/stream', params)
  → window-ipc.ts → BrowserWindow.postMessage('agent:stream:msgpack', bytes)

Renderer (React)
  → AgentStreamReceiver.attach() 监听 IPC
  → decodeAgentStreamEnvelopes(bytes)
  → dispatch(runId, event) → chat-store handler
  → 更新 UI
```

### 关键发现

1. **OpenAIChatRuntime.cs 是巨型文件**（3828 行），包含 Loop 逻辑 + openai-chat provider + 工具执行 + 上下文压缩 + 各种辅助方法。需要拆分。

2. **事件帧处理是关键缺口**：当前 wishful-claw 的 `native-worker.ts` 的 `handleResponseFrame` 只处理 response（有 `id`），不处理 event（有 `event` 字段）。OpenCowork 的版本检测 `event === 'agent/stream'` 并转发原始帧。

3. **Agent Loop 是后台任务**：`agent/run` 立即返回 `{started, runId}`，Loop 在后台 `Task.Run` 中执行，通过流式事件推送进度。前端通过 `runId` 订阅事件。

4. **工具执行在迭代三不需要**：迭代三的验证标准是"流式看到模型回复 + 能中途取消"，不涉及工具调用。但 Loop 结构应预留工具执行的位置。

5. **上下文压缩可以简化**：OpenCowork 的压缩逻辑（717 行）包括摘要 LLM 调用、重试、边界扫描等。MVP 可以先做基础版（超阈值时截断旧消息或简单摘要），后续迭代完善。

6. **前端聊天 UI 需要大幅重写**：OpenCowork 的 chat-store.ts（5409 行）和 UI 组件包含大量 MVP 不需要的功能（SubAgent、Team、CodeGraph、工具卡片等）。需要写精简版。

## 搬入策略

### 后端拆分方案

将 OpenAIChatRuntime.cs（3828 行）拆分为：

| 新文件 | 来源 | 职责 |
|--------|------|------|
| `AgentLoop.cs` | ExecuteLoopAsync + 循环逻辑 | 主循环、迭代管理、压缩触发 |
| `OpenAIChatProvider.cs` | ExecuteTurnAsync (openai-chat) | 请求构建、SSE 解析、流式事件 |
| `AnthropicMessagesProvider.cs` | 已有独立文件 | Anthropic 协议 |
| `AgentLoopHelpers.cs` | 辅助方法 | ReadConversation、BuildRequestBody 等 |

### 跳过的功能（MVP 不需要）

- SubAgent / Team / CodeGraph
- Hooks 系统（PreToolUse/PostToolUse/PreCompact/PostCompact/Stop）
- 工具审批（requiresApproval）
- Prompt caching（cache_control / prompt cache）
- Debug payload（body 文件写入）
- OpenAI Responses API（只做 openai-chat + anthropic）
- Gemini / Vertex AI provider
- 图片生成 / Web 搜索 / 桌面控制
- 工具执行器（Task/Fs/Search/Skill/Widget/Goal/Memory 等）—— 迭代四
- 反向请求（ReverseRequest）
- 计划模式（PlanMode）
- 翻译（Translation）

### 简化的功能

- 上下文压缩：基础版（token 超阈值时，保留 system + 最近 N 条消息，旧消息截断或简单摘要）
- 前端聊天 UI：最小集（消息列表 + 输入框 + 流式文本渲染 + 取消按钮 + 模型选择器）
- 请求构建：基础字段（model, messages, temperature, max_tokens, stream），支持 thinkingConfig

## 风险评估

1. **MessagePack 事件编码**：`AgentStreamMessagePackEmitter` 是手写 MessagePack 编码（不用 MessagePack-CSharp），需要确保字段与前端解码一致
2. **SSE 解析正确性**：openai-chat 和 anthropic 的 SSE 格式不同，需要分别处理
3. **取消机制时序**：取消信号需要在 HTTP 请求和流式读取过程中都能及时响应
4. **前后端事件协议对齐**：StreamEvent 的字段名在 C#（PascalCase）和 TS（camelCase）之间需要正确映射
