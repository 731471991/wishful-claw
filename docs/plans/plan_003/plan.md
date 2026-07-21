# Plan: 迭代三 — Agent Loop + 对话

## 目标

能跟模型对话，流式输出，能中途取消。选择已配置的 Provider 和模型 → 输入消息 → 流式看到模型回复 → 能中途取消。

## 验证标准

1. 在设置页面选择已配置的 Provider 和模型
2. 在对话页面输入消息，发送
3. 流式看到模型回复（文本逐字/逐块出现）
4. 点击取消按钮能中断正在进行的对话
5. 支持思考模型（thinking_delta 事件正确渲染）
6. `dotnet build` + `npm run typecheck` + `electron-vite build` 全部通过

## 步骤清单

- [ ] 步骤1：后端 — 流式协议数据模型
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentRuntimeModels.cs`
    - AgentRuntimeStreamEvent（扁平 record，字段与 OpenCowork 对齐但去掉 SubAgent 字段）
    - AgentRuntimeStreamEnvelope（v / runId / sessionId / seq / events）
    - AgentRuntimeTokenUsage、AgentRuntimeRequestTiming
    - AgentRuntimeProviderTurnResult、AgentRuntimeChatMessage、AgentRuntimeNativeToolCall、AgentRuntimeChatToolUse
    - AgentRuntimeToolResult、AgentRuntimeToolUseBlock、AgentRuntimeToolCallState
  - 验证：`dotnet build` 通过

- [ ] 步骤2：后端 — AgentStreamMessagePackEmitter
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentStreamMessagePackEmitter.cs`
    - Encode(AgentRuntimeStreamEnvelope) → WorkerMessagePackEvent
    - 手写 MessagePack 编码，字段名 camelCase（与前端一致）
    - 只编码迭代三需要的事件字段（type / text / thinking / iteration / stopReason / reason / usage / timing / toolCallId / toolName / partialInput / toolUseBlock / toolResults / errorType / message / details / stackTrace）
  - 验证：`dotnet build` 通过

- [ ] 步骤3：后端 — AgentRuntimeTools + RunState
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentRuntimeTools.cs`
    - RunAsync：创建 RunState，后台 Task.Run 执行 Loop，立即返回 {started, runId}
    - Cancel：通过 runId 查找 RunState，调用 Cancel()
    - EmitAsync：封装 envelope → MessagePack → EmitMessagePackEventAsync
    - AgentRuntimeRunState：CancellationTokenSource、seq 计数器、参数管理
    - 并发限制（SemaphoreSlim，MaxConcurrentRuns=8）
  - 验证：`dotnet build` 通过

- [ ] 步骤4：后端 — OpenAIChatProvider
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/OpenAIChatProvider.cs`
    - ExecuteTurnAsync：构建请求体 → POST /chat/completions (stream=true) → 解析 SSE
    - BuildRequestBody：messages 数组 + model + temperature + max_tokens + stream + tools（可选）
    - ProcessSseData：解析 choices[0].delta.content / reasoning_content / tool_calls
    - 流式事件：text_delta / thinking_delta / tool_use_streaming_start / tool_use_args_delta
    - 支持 thinkingConfig（reasoning_effort 参数注入）
    - 支持 requestOverrides.omitBodyKeys
  - 搬入辅助方法：BuildDebugHeaders、ApplyHeaders、ReadConversation、CreateAssistantWireMessage 等
  - 验证：`dotnet build` 通过

- [ ] 步骤5：后端 — AnthropicMessagesProvider
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AnthropicMessagesProvider.cs`（partial class，拆分多文件）
    - AnthropicMessagesProvider.cs — ExecuteTurnAsync 入口
    - AnthropicMessagesEventParser.cs — SSE 事件解析（content_block_start/delta/stop, message_delta, message_stop）
    - AnthropicMessagesInputWriter.cs — 请求体构建（messages + system + tools）
    - AnthropicMessagesHeaders.cs — 请求头（x-api-key, anthropic-version, anthropic-beta）
    - AnthropicMessagesState.cs — 解析状态 + 工具方法
  - 搬入简化版：去掉 cache_control、sanitizer、request validator 的复杂逻辑
  - 验证：`dotnet build` 通过

- [ ] 步骤6：后端 — AgentLoop + 上下文压缩
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentLoop.cs`
    - ExecuteLoopAsync：主循环（迭代、cancellation 检查、compression 检查、ExecuteTurnAsync、工具执行占位）
    - 迭代三不执行工具（Loop 在无 tool_calls 时结束），但结构预留
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/ContextCompression.cs`
    - 简化版：token 超阈值（80%）时，保留 system + 最近 N 条消息，旧消息直接截断
    - 不做 LLM 摘要（后续迭代加）
    - EmitAsync(context_compression_start / context_compressed)
  - 验证：`dotnet build` 通过

- [ ] 步骤7：后端 — AgentRuntimeModule + 注册
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentRuntimeModule.cs`
    - 注册端点：agent/run, agent/cancel, agent/request-stop, agent/append-messages
    - 去掉：initialize, ping, shutdown, capabilities/check, team-/*, debug-body-read, reverse-response, session-visibility
  - 修改 `WorkerModuleCatalog.cs`：添加 AgentRuntimeModule
  - 验证：`dotnet build` 通过，Worker 能启动并注册端点

- [ ] 步骤8：前端 — 共享协议类型 + MessagePack 编解码
  - 新建 `src/shared/agent-stream-protocol.ts` — AgentStreamEnvelope / AgentStreamEvent 类型定义
    - 只保留迭代三需要的事件类型（loop_start, iteration_start/end, text_delta, thinking_delta, message_end, loop_end, error, context_compression_start/compressed, request_debug, tool_use_streaming_start/args_delta/generated, tool_call_start/result）
    - 去掉 SubAgent、Team、Image、WebSearch 等事件
  - 新建 `src/shared/messagepack/agent-stream-codec.ts` — encode/decode 函数
  - 验证：`npm run typecheck` 通过

- [ ] 步骤9：前端 — Main 进程事件转发
  - 修改 `src/main/lib/native-worker.ts`
    - handleResponseFrame：检测 `event` 字段，区分 response 和 event 帧
    - 事件帧：emit 到 EventEmitter（'agent/stream' 等）
    - 添加 onEvent / onRawEvent 方法
  - 修改 `src/main/index.ts` 或新建 `src/main/ipc/agent-stream-handler.ts`
    - 监听 native-worker 的 'agent/stream' 事件
    - 通过 safeSendMessagePackToWindow 转发到 renderer
  - 修改 `src/preload/index.ts`：暴露 agent API（agent:run, agent:cancel, agent:stream:msgpack）
  - 验证：`npm run typecheck` + `electron-vite build` 通过

- [ ] 步骤10：前端 — AgentStreamReceiver + stream-event-adapter
  - 新建 `src/renderer/src/lib/ipc/agent-stream-receiver.ts`
    - 监听 `agent:stream:msgpack` IPC 通道
    - 解码 MessagePack envelope
    - 按 runId 分发事件
  - 新建 `src/renderer/src/lib/agent/stream-event-adapter.ts`
    - 将 AgentStreamEvent 适配为内部 AgentEvent 类型
  - 验证：`npm run typecheck` 通过

- [ ] 步骤11：前端 — chat-store（Zustand）
  - 新建 `src/renderer/src/stores/chat-store.ts`（精简版）
    - 状态：messages[], isStreaming, currentRunId, error
    - 动作：sendMessage, cancelStream, appendTextDelta, appendThinkingDelta, addMessage, finalizeMessage
    - sendMessage：构建 agent/run 参数（provider + model + messages + system prompt），调用 IPC，订阅 stream 事件
    - 事件处理：text_delta → 追加文本，thinking_delta → 追加思考，message_end → 记录 usage，loop_end → 结束流
  - 验证：`npm run typecheck` 通过

- [ ] 步骤12：前端 — 对话 UI
  - 新建 `src/renderer/src/components/chat/ChatPage.tsx` — 对话页面容器
  - 新建 `src/renderer/src/components/chat/MessageList.tsx` — 消息列表（用户消息 + 助手消息 + 流式渲染）
  - 新建 `src/renderer/src/components/chat/AssistantMessage.tsx` — 助手消息（Markdown 渲染 + 思考折叠 + 流式光标）
  - 新建 `src/renderer/src/components/chat/UserMessage.tsx` — 用户消息
  - 新建 `src/renderer/src/components/chat/InputArea.tsx` — 输入区域（文本框 + 发送按钮 + 取消按钮 + 模型选择器）
  - 新建 `src/renderer/src/components/chat/ModelSwitcher.tsx` — 模型选择下拉框
  - 修改 `src/renderer/src/App.tsx`：添加对话页面路由
  - 依赖：react-markdown + remark-gfm（Markdown 渲染）
  - 验证：`npm run typecheck` + `electron-vite build` 通过

- [ ] 步骤13：集成验证
  - 启动应用 → 选择 Provider 和模型 → 输入消息 → 流式看到回复 → 取消
  - 验证思考模型（如果配置了支持 thinking 的模型）
  - 产出验证报告

## 涉及文件

### 新建（后端 .NET）
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentRuntimeModels.cs` — 数据模型
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentStreamMessagePackEmitter.cs` — 流事件 MessagePack 编码
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentRuntimeTools.cs` — Run/Cancel/EmitAsync/RunState
- `src/runtime/WishfulClaw.Worker/AgentRuntime/OpenAIChatProvider.cs` — OpenAI 兼容 chat provider
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AnthropicMessagesProvider.cs` — Anthropic provider 入口
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AnthropicMessagesEventParser.cs` — Anthropic SSE 解析
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AnthropicMessagesInputWriter.cs` — Anthropic 请求体构建
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AnthropicMessagesHeaders.cs` — Anthropic 请求头
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AnthropicMessagesState.cs` — Anthropic 解析状态
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentLoop.cs` — 主循环
- `src/runtime/WishfulClaw.Worker/AgentRuntime/ContextCompression.cs` — 上下文压缩（简化版）
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentRuntimeModule.cs` — 模块注册
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentRuntimeProviderSupport.cs` — 共享工具方法

### 新建（前端 TS/React）
- `src/shared/agent-stream-protocol.ts` — 流式协议类型
- `src/shared/messagepack/agent-stream-codec.ts` — MessagePack 编解码
- `src/main/ipc/agent-stream-handler.ts` — Main 进程事件转发
- `src/renderer/src/lib/ipc/agent-stream-receiver.ts` — 流事件接收器
- `src/renderer/src/lib/agent/stream-event-adapter.ts` — 事件适配
- `src/renderer/src/lib/agent/types.ts` — Agent 事件类型
- `src/renderer/src/stores/chat-store.ts` — 聊天状态管理
- `src/renderer/src/components/chat/ChatPage.tsx` — 对话页面
- `src/renderer/src/components/chat/MessageList.tsx` — 消息列表
- `src/renderer/src/components/chat/AssistantMessage.tsx` — 助手消息
- `src/renderer/src/components/chat/UserMessage.tsx` — 用户消息
- `src/renderer/src/components/chat/InputArea.tsx` — 输入区域
- `src/renderer/src/components/chat/ModelSwitcher.tsx` — 模型选择器

### 修改
- `src/runtime/WishfulClaw.Worker/WorkerModuleCatalog.cs` — 注册 AgentRuntimeModule
- `src/main/lib/native-worker.ts` — 添加事件帧处理
- `src/main/index.ts` — 注册 agent stream handler
- `src/preload/index.ts` — 暴露 agent API
- `src/renderer/src/App.tsx` — 添加对话页面路由
- `package.json` — 添加 react-markdown, remark-gfm 依赖

## 参考源码

- OpenCowork AgentRuntime 目录：`D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\AgentRuntime\`
  - OpenAIChatRuntime.cs — 主 Loop + openai-chat provider（拆分来源）
  - AgentRuntimeTools.cs — Run/Cancel/EmitAsync/RunState
  - AgentRuntimeModels.cs — 数据模型
  - AgentRuntimeProviderModels.cs — Provider 数据模型
  - AgentRuntimeProviderSupport.cs — 共享工具方法
  - AgentRuntimeAnthropicMessages*.cs — Anthropic provider 全套
  - AgentRuntimeContextCompression.cs — 上下文压缩
  - AgentStreamMessagePackEmitter.cs — 流事件编码（在 Runtime/ 目录）
- OpenCowork 前端：
  - `src/shared/agent-stream-protocol.ts` — 协议类型
  - `src/shared/messagepack/agent-stream-codec.ts` — 编解码
  - `src/main/lib/native-worker.ts` — 事件帧处理（参考 handleResponseFrame）
  - `src/renderer/src/lib/ipc/agent-stream-receiver.ts` — 流事件接收
  - `src/renderer/src/stores/chat-store.ts` — 聊天 store（参考结构，重写简化版）
  - `src/renderer/src/components/chat/` — UI 组件（参考结构，重写简化版）
