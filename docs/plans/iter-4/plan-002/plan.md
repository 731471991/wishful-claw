# Plan: 迭代四 plan-002 — AgentLoop 工具执行集成 + 前端工具 UI

## 目标

AgentLoop 能执行工具、回传结果、继续循环；前端能展示工具调用卡片。端到端验证：发消息让 Agent 读文件，Agent 调 Read → 展示工具卡片 → 返回总结。

## 步骤清单

- [✓] 步骤1：修改 AgentLoop.cs — 替换占位代码，加入工具执行 + 结果回传 + 继续循环
  - 通过 ToolModuleState.Registry 获取工具执行器
  - 每个工具调用发 tool_call_start/tool_call_result 事件
  - 工具结果作为 user 消息追加到会话继续循环
  - 新增 CreateToolResultsWireMessage 构造工具结果消息

- [✓] 步骤2：修改前端 sendMessage — 传入 tools 定义 + workingFolder
  - use-chat-actions.ts: 获取 tool/list + 传入 tools/workingFolder/maxIterations
  - chat-store/index.ts: AgentActions 接口扩展 tools/workingFolder/maxIterations

- [✓] 步骤3：前端工具 UI — ToolCallCard 组件
  - ToolCallCard.tsx: 可折叠卡片（状态指示/输入输出展示）
  - AssistantMessage.tsx: 渲染 toolCalls 列表

- [✓] 步骤4：前端事件处理 — handleEnvelope 处理工具事件
  - agent-stream-protocol.ts: tool_call_start/tool_call_result 加入 CHAT_STREAM_EVENTS
  - stream-event-adapter.ts: 工具事件纳入 ChatStreamEvent 类型
  - chat-store/index.ts: handleEnvelope 处理 tool_call_start（添加 toolCalls 条目）/ tool_call_result（更新状态和输出）
  - types.ts: 新增 ToolCallInfo 接口 + ChatMessage.toolCalls 字段

- [✓] 步骤5：验证
  - tsc 0 错误
  - electron-vite build 2203 模块
  - dotnet build 0 错误

## 涉及文件

### 新建
- `src/renderer/src/components/chat/ToolCallCard.tsx`
- `docs/plans/iter-4/plan-002/plan.md`

### 修改
- `src/runtime/WishfulClaw.Worker/AgentRuntime/AgentLoop.cs`
- `src/renderer/src/stores/chat-store/types.ts`
- `src/renderer/src/stores/chat-store/index.ts`
- `src/renderer/src/hooks/use-chat-actions.ts`
- `src/renderer/src/lib/agent/stream-event-adapter.ts`
- `src/shared/agent-stream-protocol.ts`
- `src/renderer/src/components/chat/AssistantMessage.tsx`
- `src/renderer/src/locales/en/chat.json`
- `src/renderer/src/locales/zh/chat.json`

## 参考源码

- `D:\gy\OpenCowork\src\renderer\src\components\chat\ToolCallCard.tsx`（3538行，精简搬入）
- `D:\gy\OpenCowork\src\renderer\src\components\chat\ToolCallGroup.tsx`（172行）
