# Plan: 迭代三 — Agent Loop + 对话

## 目标

能跟模型对话，流式输出，能中途取消。左侧聊天 + 右侧活动面板（悬浮可折叠），聊天流只保留对话文本，工具调用/文件操作/迭代进度等显示在活动面板中。

## 验证标准

1. 选择已配置的 Provider 和模型
2. 在对话页面输入消息并发送
3. 流式看到模型回复（文本逐块出现）
4. 点击取消按钮能中断正在进行的对话
5. 活动面板显示迭代进度（iteration_start/end 事件）
6. 思考模型正确渲染 thinking_delta
7. `dotnet build` + `npm run typecheck` + `electron-vite build` 全部通过

## 设计原则

### Agent Loop 架构（融合三项目）

| 设计点 | 来源 | 说明 |
|--------|------|------|
| Loop = 反复 StepAsync | KodaClaw | 每步 = 一次模型调用 + 可选工具执行，循环直到无 tool_calls |
| Provider 实现 | OpenCowork | SSE 解析、请求构建、流式事件，直接搬入 |
| 事件通道分离 | KodaClaw 三通道 | Progress（聊天流）/ Activity（活动面板）/ Monitor（日志） |
| 记忆主动回忆 | OpenClaw.net | Loop 前自动搜记忆注入（迭代三预留接口，迭代六实现） |
| 上下文管理 | KodaClaw ContextManager | 独立组件，不混在 Loop 里（迭代三简化版） |
| UI 布局 | 灵犀 | 左聊天 + 右活动面板，不把所有东西塞聊天流 |

### 事件分流

**聊天流事件**（推送到聊天 UI）：
- `loop_start` / `loop_end` — 对话开始/结束
- `text_delta` — 模型回复文本增量
- `thinking_delta` — 思考过程增量
- `message_end` — 消息完成（usage, timing）
- `error` — 错误信息

**活动面板事件**（推送到活动面板 UI）：
- `iteration_start` / `iteration_end` — 迭代进度
- `tool_call_start` / `tool_call_result` — 工具调用（迭代三不执行工具，但事件类型预留）
- `context_compression_start` / `context_compressed` — 上下文压缩
- `request_debug` — 请求调试信息

## 步骤清单

- [ ] 步骤1：后端 — 流式协议数据模型
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentRuntimeModels.cs`
    - AgentRuntimeStreamEvent（扁平 record，字段 camelCase 与前端对齐）
    - AgentRuntimeStreamEnvelope（v / runId / sessionId / seq / events[]）
    - AgentRuntimeTokenUsage、AgentRuntimeRequestTiming
    - AgentRuntimeProviderTurnResult、AgentRuntimeChatMessage、AgentRuntimeNativeToolCall
    - AgentRuntimeChatToolUse、AgentRuntimeToolResult、AgentRuntimeToolUseBlock
    - AgentRuntimeToolCallState（迭代三不使用但类型预留）
  - 参考：OpenCowork AgentRuntimeModels.cs + AgentRuntimeProviderModels.cs
  - 验证：`dotnet build` 通过

- [ ] 步骤2：后端 — AgentStreamMessagePackEmitter
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentStreamMessagePackEmitter.cs`
    - Encode(AgentRuntimeStreamEnvelope) → WorkerMessagePackEvent
    - 手写 MessagePack 编码（使用已有的 MessagePackWriter）
    - 字段名 camelCase，与前端解码一致
    - 只编码迭代三需要的事件字段
  - 参考：OpenCowork AgentStreamMessagePackEmitter.cs
  - 验证：`dotnet build` 通过

- [ ] 步骤3：后端 — AgentRuntimeTools + RunState
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentRuntimeTools.cs`
    - RunAsync：创建 RunState → 后台 Task.Run 执行 Loop → 立即返回 {started, runId}
    - Cancel：通过 runId 查找 RunState，调用 Cancel()
    - RequestStop：请求优雅停止
    - EmitAsync：封装 envelope → MessagePack → EmitMessagePackEventAsync
    - AgentRuntimeRunState：CancellationTokenSource、seq 计数器、消息队列、参数管理
    - 并发限制（SemaphoreSlim，MaxConcurrentRuns=8）
  - 参考：OpenCowork AgentRuntimeTools.cs（去掉 SubAgent/Team/Reverse）
  - 验证：`dotnet build` 通过

- [ ] 步骤4：后端 — AgentLoop（主循环）
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentLoop.cs`
    - ExecuteLoopAsync：主循环
      - 每次迭代：检查 cancellation → 检查上下文压缩 → EmitAsync(iteration_start) → ExecuteTurnAsync → 如果无 tool_calls → 结束 → 如果有 tool_calls → 迭代三不执行工具，直接结束并返回
    - 预留 TryInjectRecallAsync 调用点（迭代六实现记忆注入）
    - 预留工具执行调用点（迭代四实现）
  - 设计参考：KodaClaw StepAsync（Step 抽象 + 状态检查）、OpenCowork ExecuteLoopAsync（循环结构）
  - 验证：`dotnet build` 通过

- [ ] 步骤5：后端 — OpenAIChatProvider
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/OpenAIChatProvider.cs`
    - ExecuteTurnAsync：构建请求体 → POST /chat/completions (stream=true) → 解析 SSE
    - BuildRequestBody：messages + model + temperature + max_tokens + stream + tools(可选)
    - ProcessSseData：解析 choices[0].delta.content / reasoning_content / tool_calls
    - 流式事件：text_delta / thinking_delta / tool_use_streaming_start / tool_use_args_delta
    - 支持 thinkingConfig（reasoning_effort 注入）
    - 支持 requestOverrides.omitBodyKeys
    - 辅助方法：BuildHeaders、ReadConversation、CreateAssistantWireMessage 等
  - 参考：OpenCowork OpenAIChatRuntime.cs 中的 openai-chat 部分
  - 验证：`dotnet build` 通过

- [ ] 步骤6：后端 — AnthropicMessagesProvider（partial class 多文件）
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AnthropicMessagesProvider.cs` — 入口 ExecuteTurnAsync
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AnthropicMessagesEventParser.cs` — SSE 解析
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AnthropicMessagesInputWriter.cs` — 请求体构建
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AnthropicMessagesHeaders.cs` — 请求头
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AnthropicMessagesState.cs` — 解析状态 + 工具方法
  - 搬入简化版：去掉 cache_control、sanitizer、request validator
  - 参考：OpenCowork AgentRuntimeAnthropicMessages*.cs
  - 验证：`dotnet build` 通过

- [ ] 步骤7：后端 — ContextCompression + ProviderSupport + AgentRuntimeModule
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/ContextCompression.cs`
    - 简化版：token 超阈值（80% context window）时，保留 system + 最近 N 条消息，旧消息截断
    - 不做 LLM 摘要（后续迭代加），EmitAsync 事件
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentRuntimeProviderSupport.cs` — 共享工具方法
  - 新建 `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentRuntimeModule.cs` — 注册端点
    - agent/run, agent/cancel, agent/request-stop, agent/append-messages
  - 修改 `WorkerModuleCatalog.cs` — 添加 AgentRuntimeModule
  - 验证：`dotnet build` 通过，Worker 能启动

- [ ] 步骤8：前端 — 共享协议类型 + MessagePack 编解码
  - 新建 `src/shared/agent-stream-protocol.ts` — 类型定义
    - AgentStreamEnvelope / AgentStreamEvent
    - 聊天流事件类型：loop_start/end, text_delta, thinking_delta, message_end, error
    - 活动面板事件类型：iteration_start/end, tool_call_start/result, context_compression_*, request_debug
    - 去掉 SubAgent/Team/Image/WebSearch 等
  - 新建 `src/shared/messagepack/agent-stream-codec.ts` — encode/decode
  - 参考：OpenCowork agent-stream-protocol.ts + agent-stream-codec.ts
  - 验证：`npm run typecheck` 通过

- [ ] 步骤9：前端 — Main 进程事件转发
  - 修改 `src/main/lib/native-worker.ts`
    - handleResponseFrame：检测 `event` 字段，区分 response 和 event 帧
    - event 帧：emit 到 EventEmitter（'agent/stream'）
    - 添加 onEvent 方法
  - 新建 `src/main/ipc/agent-stream-handler.ts`
    - 监听 native-worker 'agent/stream' 事件
    - 通过 safeSendMessagePackToWindow 转发到 renderer
  - 修改 `src/preload/index.ts` — 暴露 agent API
  - 参考：OpenCowork native-worker.ts 的 handleResponseFrame
  - 验证：`npm run typecheck` + `electron-vite build` 通过

- [ ] 步骤10：前端 — AgentStreamReceiver + 事件分发
  - 新建 `src/renderer/src/lib/ipc/agent-stream-receiver.ts`
    - 监听 IPC 通道，解码 MessagePack envelope
    - 按 runId 订阅，分发事件
  - 新建 `src/renderer/src/lib/agent/stream-event-adapter.ts`
    - 将 AgentStreamEvent 适配为内部事件类型
    - **事件分流**：聊天流事件 → chatStore，活动面板事件 → activityStore
  - 验证：`npm run typecheck` 通过

- [ ] 步骤11：前端 — chat-store + activity-store（Zustand）
  - 新建 `src/renderer/src/stores/chat-store.ts`（精简版）
    - 状态：messages[], isStreaming, currentRunId, error
    - 动作：sendMessage, cancelStream, appendTextDelta, appendThinkingDelta, finalizeMessage
    - sendMessage 构建 agent/run 参数，调用 IPC，订阅 stream 事件
    - 只处理聊天流事件
  - 新建 `src/renderer/src/stores/activity-store.ts`
    - 状态：activities[] (迭代/工具/压缩/调试记录)
    - 动作：addActivity, updateActivity, clearActivities
    - 处理活动面板事件
  - 验证：`npm run typecheck` 通过

- [ ] 步骤12：前端 — 对话 UI（左聊天 + 右活动面板）
  - 新建 `src/renderer/src/components/chat/ChatPage.tsx` — 页面容器（左右布局）
  - 新建 `src/renderer/src/components/chat/MessageList.tsx` — 消息列表
  - 新建 `src/renderer/src/components/chat/AssistantMessage.tsx` — 助手消息（Markdown + 思考折叠 + 流式光标）
  - 新建 `src/renderer/src/components/chat/UserMessage.tsx` — 用户消息
  - 新建 `src/renderer/src/components/chat/InputArea.tsx` — 输入区域（文本框 + 发送 + 取消 + 模型选择）
  - 新建 `src/renderer/src/components/chat/ModelSwitcher.tsx` — 模型选择下拉
  - 新建 `src/renderer/src/components/activity/ActivityPanel.tsx` — 活动面板（悬浮可折叠）
    - 迭代进度条
    - 工具调用卡片（迭代三为空，预留）
    - 上下文压缩状态
    - 请求调试信息（可折叠）
  - 修改 `src/renderer/src/App.tsx` — 添加对话页面路由
  - 依赖：react-markdown + remark-gfm
  - 验证：`npm run typecheck` + `electron-vite build` 通过

- [ ] 步骤13：集成验证
  - 启动应用 → 选择 Provider 和模型 → 输入消息 → 流式看到回复 → 取消
  - 活动面板显示迭代进度
  - 验证思考模型（如果配置了支持 thinking 的模型）
  - 产出验证报告

## 涉及文件

### 新建（后端 .NET）
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentRuntimeModels.cs`
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentStreamMessagePackEmitter.cs`
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentRuntimeTools.cs`
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentLoop.cs`
- `src/runtime/WishfulClaw.Worker/AgentRuntime/OpenAIChatProvider.cs`
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AnthropicMessagesProvider.cs`
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AnthropicMessagesEventParser.cs`
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AnthropicMessagesInputWriter.cs`
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AnthropicMessagesHeaders.cs`
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AnthropicMessagesState.cs`
- `src/runtime/WishfulClaw.Worker/AgentRuntime/ContextCompression.cs`
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentRuntimeProviderSupport.cs`
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentRuntimeModule.cs`

### 新建（前端 TS/React）
- `src/shared/agent-stream-protocol.ts`
- `src/shared/messagepack/agent-stream-codec.ts`
- `src/main/ipc/agent-stream-handler.ts`
- `src/renderer/src/lib/ipc/agent-stream-receiver.ts`
- `src/renderer/src/lib/agent/stream-event-adapter.ts`
- `src/renderer/src/lib/agent/types.ts`
- `src/renderer/src/stores/chat-store.ts`
- `src/renderer/src/stores/activity-store.ts`
- `src/renderer/src/components/chat/ChatPage.tsx`
- `src/renderer/src/components/chat/MessageList.tsx`
- `src/renderer/src/components/chat/AssistantMessage.tsx`
- `src/renderer/src/components/chat/UserMessage.tsx`
- `src/renderer/src/components/chat/InputArea.tsx`
- `src/renderer/src/components/chat/ModelSwitcher.tsx`
- `src/renderer/src/components/activity/ActivityPanel.tsx`

### 修改
- `src/runtime/WishfulClaw.Worker/WorkerModuleCatalog.cs`
- `src/main/lib/native-worker.ts`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/App.tsx`
- `package.json`

## 参考源码

### OpenCowork（搬入来源）
- `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\AgentRuntime\OpenAIChatRuntime.cs` — Loop + openai-chat provider
- `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\AgentRuntime\AgentRuntimeTools.cs` — Run/Cancel/EmitAsync
- `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\AgentRuntime\AgentRuntimeModels.cs` — 数据模型
- `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\AgentRuntime\AgentRuntimeAnthropicMessages*.cs` — Anthropic 全套
- `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\AgentRuntime\AgentRuntimeContextCompression.cs` — 压缩
- `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Runtime\AgentStreamMessagePackEmitter.cs` — 流事件编码
- `D:\gy\OpenCowork\src\shared\agent-stream-protocol.ts` — 协议类型
- `D:\gy\OpenCowork\src\shared\messagepack\agent-stream-codec.ts` — 编解码
- `D:\gy\OpenCowork\src\main\lib\native-worker.ts` — 事件帧处理
- `D:\gy\OpenCowork\src\renderer\src\lib\ipc\agent-stream-receiver.ts` — 流事件接收

### KodaClaw（设计思路参考）
- `D:\gy\koda-claw\koda-claw\src\Kode.Agent.Sdk\Core\Agent\Partials\Agent.Processing.cs` — 后台循环 + 状态机
- `D:\gy\koda-claw\koda-claw\src\Kode.Agent.Sdk\Core\Agent\Partials\Agent.Step.cs` — Step 抽象（单步 = 模型调用 + 工具执行）
- `D:\gy\koda-claw\koda-claw\src\Kode.Agent.Sdk\Core\Context\ContextManager.cs` — 上下文管理独立组件
- `D:\gy\koda-claw\koda-claw\src\Kode.Agent.Sdk\Core\Events\EventBus.cs` — 三通道事件总线
- `D:\gy\koda-claw\koda-claw\src\Kode.Agent.Sdk\Core\Abstractions\IEventBus.cs` — 事件类型定义
- `D:\gy\koda-claw\koda-claw\products\KodaClaw\src\KodaClaw.Runtime\Prompt\PromptBuilder.cs` — 分段 Prompt 构建

### OpenClaw.net（记忆机制参考）
- `D:\claw\openclaw.net\src\OpenClaw.Agent\AgentRuntime.cs` — TryInjectRecallAsync（记忆主动回忆）
- `D:\claw\openclaw.net\src\OpenClaw.Core\Memory\ContextBudgetPlanner.cs` — 上下文预算
