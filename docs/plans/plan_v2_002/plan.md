# Plan: v2-iter-2 缓存命中率修复

## 目标

C# 端维护 conversation 状态，每轮只接收增量消息，消除全量重建导致的 prefix cache miss。同一会话缓存命中率稳定在 90%+。

## 步骤清单

- [ ] 步骤1：在 Agent 端创建 SessionConversation 状态管理器 — 按 sessionId 持有 `List<AgentRuntimeChatMessage>`，支持初始化/追加/替换/清除。验证：dotnet build 通过。
- [ ] 步骤2：AgentLoop 改为增量模式 — `ExecuteLoopAsync` 首次调用时从 messages 全量初始化 conversation，后续调用时从 SessionConversation 取已有 conversation + 追加增量消息。验证：dotnet build 通过。
- [ ] 步骤3：前端改为增量发送 — `use-chat-actions.ts` 首次对话发全量 messages，后续对话只发增量 user message。复用已有 `agent/append-messages` 或扩展 `agent/run` 支持增量模式。验证：tsc 通过。
- [ ] 步骤4：InjectTimestampPrefix 稳定化 — 时间戳精度从秒级降为分钟级或移到不影响缓存的位置。验证：dotnet build 通过。
- [ ] 步骤5：cache_control 断点对齐 Reasonix — 第二个断点从 tools 最后一个改为最后一条 message 的最后一个 content block。验证：dotnet build 通过。
- [ ] 步骤6：session 切换边界处理 — 用户切换会话时重置 SessionConversation 状态；context compression 时替换 conversation。验证：dotnet build 通过。
- [ ] 步骤7：双编译验证 + 功能测试 — `dotnet build` + `tsc --noEmit` 零错误；实际对话观察缓存命中率。

## 涉及文件

### 修改（Agent）
- `WishfulClaw.Agent/SessionConversation.cs` — 新建，per-session conversation 状态管理
- `WishfulClaw.Agent/AgentLoop.cs` — 改为增量模式
- `WishfulClaw.Agent/AgentLoop.Helpers.cs` — InjectTimestampPrefix 稳定化
- `WishfulClaw.Agent/AgentRuntimeTools.cs` — agent/run 支持增量模式
- `WishfulClaw.Agent/AgentRuntimeRunState.cs` — 持有 conversation 引用
- `WishfulClaw.Agent/AnthropicMessagesInputWriter.cs` — cache_control 断点调整

### 修改（前端）
- `src/renderer/src/hooks/use-chat-actions.ts` — 增量消息发送
- `src/renderer/src/stores/chat-store/` — session 级 message count 追踪

## 参考源码

- Reasonix `internal/agent/session.go` — Session 结构和 Add/Snapshot/CloneWithMessages
- Reasonix `internal/agent/agent.go` — Agent Run 方法中 session.Add 和 stream 中 requestMessages 构建
- Reasonix `internal/provider/anthropic/anthropic.go` 第 317-329 行 — cache_control 断点设置
- Reasonix `internal/agent/normalize.go` — 加载时修复不影响缓存前缀

## 设计决策

### 增量模式 vs 全量模式

| 场景 | 模式 | 说明 |
|------|------|------|
| 首次对话 | 全量初始化 | 从 messages 构建 conversation，存入 SessionConversation |
| 后续对话 | 增量追加 | 只发新 user message，C# 端追加到已有 conversation |
| 会话恢复 | 全量初始化 | 从 DB 加载历史消息，全量重建 conversation |
| Context compression | 替换 | 压缩后的新消息列表替换旧 conversation |
| Session 切换 | 清除+重建 | 清除旧 session 状态，新 session 全量初始化 |

### 前端如何判断首次 vs 增量

方案：前端追踪已发送的 message count。每次 agent/run 发送时附带 `messageCount`（已发送的消息数）：
- `messageCount === 0`：全量模式，C# 端初始化 conversation
- `messageCount > 0`：增量模式，C# 端从 messageCount 之后的消息开始追加
