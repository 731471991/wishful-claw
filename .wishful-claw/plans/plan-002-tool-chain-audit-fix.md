# Plan: 迭代四/五工具链审查修复

## 背景

审查发现迭代四（工具链 + Agent Runtime）和迭代五（项目注册 + 会话历史）存在 12 个问题，涵盖 P0 运行时崩溃到 P2 代码质量。本计划按优先级分 6 个步骤执行。

---

## Step 1: 修复 renameSession 未定义 (P0-1)

**文件**: `src/renderer/src/stores/chat-store/session-slice.ts`

在 SessionSlice 接口和实现中添加 `renameSession` 方法：
- 接口: `renameSession: (id: string, title: string) => void`
- 实现: 更新 session.title + session.updatedAt，调用 `dbUpdateSession(id, { title, updatedAt })`

---

## Step 2: sendMessage 接入 agentStore 生命周期 (P0-2, P0-3, P1-7)

**文件**: `src/renderer/src/stores/chat-store/index.ts`

在 sendMessage 方法中，`state.beginUserTurn` 之后、`workerRequest` 之前：
1. 调用 `useAgentStore.getState().switchToolCallSession(prevSessionId, sessionId)` 设置当前 session 为 liveSession
2. 调用 `useAgentStore.getState().resetLiveSessionExecution(sessionId)` 清空残留工具调用

在 cancelStream 方法中：
1. 调用 `useAgentStore.getState().resetLiveSessionExecution(sessionId)` 清空工具调用

在 error 事件处理中：
1. 清空 agentStore pending tool calls

---

## Step 3: 添加缺失的事件处理 (P1-4, P1-5, P1-6)

**文件**: `src/renderer/src/stores/chat-store/index.ts`

在 handleEnvelope 的 switch 中添加：

### iteration_end
- 重置思考状态标志（下一轮迭代的思考是新段落）
- 工具结果不需要作为独立消息插入——wishful-claw 的 ChatMessage 结构与 OpenCowork 不同，工具调用和结果都在同一条 assistant message 的 toolCalls 数组中，不需要像 OpenCowork 那样插入 tool_result user message

### thinking_encrypted
- 存储到 ChatMessage.thinking（以标记形式）或忽略（当前没有加密思考的解密能力，先跳过）

### error 事件增强
- 同步清空 agentStore pendingToolCalls

---

## Step 4: 修复历史消息构建 (P1-8)

**文件**: `src/renderer/src/hooks/use-chat-actions.ts`

当前构建 historyMessages 只发 `content: m.text`，丢失了工具调用上下文。

修改 `historyMessages` 构建：
- assistant 消息: 如果有 toolCalls，content 改为 ContentBlock 数组 `[{type:'text', text}, {type:'tool_use', ...}...]`
- user 消息: 保持 `content: m.text`
- 过滤掉 isStreaming 的消息（已有）
- 过滤掉 error 消息

需要确认 Worker 的 AgentLoop 是否支持接收 ContentBlock 数组格式的消息。

---

## Step 5: 修复 streamingMessages null 类型问题 (P2-9)

**文件**: `src/renderer/src/stores/chat-store/streaming-slice.ts` + `index.ts`

将 `streamingMessages: Record<string, string>` 改为 `Record<string, string | null>` 不合理（key 存在即表示在 streaming）。

实际上 handleEnvelope 中用 `state.streamingMessages[targetSessionId] = null` 来清除，应该改为 `delete state.streamingMessages[targetSessionId]`（与 streaming-slice 中 setStreamingMessageId 的逻辑一致）。

涉及位置：
- handleEnvelope loop_end case: `state.streamingMessages[targetSessionId] = null` → `delete state.streamingMessages[targetSessionId]`
- handleEnvelope error case: 同上
- cancelStream: `state.setStreamingMessageId(sessionId, null)` 已经正确（内部 delete）

---

## Step 6: 补全 provider 参数 (P2-11)

**文件**: `src/renderer/src/hooks/use-chat-actions.ts`

当前传给 worker 的 provider 对象缺少字段。对照 AIProvider 接口和 AgentLoop 的 ValidateProvider，补全：
- `sendTemperature` / `sendMaxOutputTokens`（从 settings 传入）
- 从 settings 传入 `temperature` / `maxTokens`

---

## 不在本计划中

- P1-7 loop_end 后 agentStore 残留: Step 2 的 resetLiveSessionExecution 已覆盖
- P2-10 cancelStream 没清 agentStore: Step 2 已覆盖
- P2-12 DB 消息缺少 tool_result: Step 3 的 iteration_end 说明已覆盖（wishful-claw 不需要独立 tool_result 消息）

---

## 验证

每个 Step 修改后运行 `npx tsc --noEmit -p tsconfig.web.json` 确认无新增类型错误。
全部完成后 `npx electron-vite build` 确认构建通过。

---

## 执行结果

**状态: 已完成**

| Step | 描述 | 状态 | 修改文件 |
|------|------|------|----------|
| 1 | 修复 renameSession 未定义 (P0-1) | ✅ | session-slice.ts (添加 renameSession 接口+实现) |
| 2 | sendMessage 接入 agentStore 生命周期 (P0-2, P0-3, P1-7) | ✅ | chat-store/index.ts (sendMessage/cancelStream/error/catch 中添加 resetLiveSessionExecution + switchToolCallSession) |
| 3 | 添加缺失的事件处理 (P1-4, P1-5, P1-6) | ✅ | chat-store/index.ts (添加 iteration_end/thinking_encrypted case, error 事件同步 agentStore) |
| 4 | 修复历史消息构建 (P1-8) | ✅ | use-chat-actions.ts (historyMessages 构建 assistant 消息含 tool_use blocks + tool_result user 消息) |
| 5 | 修复 streamingMessages null 类型 (P2-9) | ✅ | chat-store/index.ts (loop_end/error 中 `= null` 改为 `delete`) |
| 6 | 补全 provider 参数 (P2-11) | ✅ | use-chat-actions.ts (添加 temperature/maxTokens) |

**类型检查**: 无新增类型错误（预先存在的 ToolDefinition/RequestDebugInfoWire 类型错误不受影响）
**构建**: `npx electron-vite build` 通过
