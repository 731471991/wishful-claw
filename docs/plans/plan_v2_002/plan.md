# Plan: v2-iter-2 缓存命中率修复

## 目标

C# 端维护 conversation 状态，每轮只接收增量消息，消除全量重建导致的 prefix cache miss。同一会话缓存命中率稳定在 90%+。

## 步骤清单

- [x] 步骤1：在 Agent 端创建 SessionConversation 状态管理器 — 按 sessionId 持有 `List<AgentRuntimeChatMessage>`，支持初始化/追加/替换/清除。验证：dotnet build 通过。
- [x] 步骤2：AgentLoop 改为增量模式 — `ExecuteLoopAsync` 首次调用时从 messages 全量初始化 conversation，后续调用时从 SessionConversation 取已有 conversation + 追加增量消息。验证：dotnet build 通过。
- [x] 步骤3：前端改为增量发送 — `use-chat-actions.ts` 发送 `messageCount`（historyMessages.length），C# 端据此判断全量 vs 增量模式。验证：tsc 通过。
- [x] 步骤4：InjectTimestampPrefix 稳定化 — 时间戳精度从秒级降为分钟级。验证：dotnet build 通过。
- [x] 步骤5：cache_control 断点对齐 Reasonix — 第二个断点从 tools 最后一个改为最后一条 message 的最后一个 content block。验证：dotnet build 通过。
- [x] 步骤6：session 切换边界处理 — deleteSession/clearSessionMessages 时调用 `agent/clear-session` 清理 C# 端状态；context compression 时通过 `sessionConv.Replace()` 替换。验证：dotnet build + tsc 通过。
- [x] 步骤7：双编译验证 — `dotnet build` + `tsc --noEmit` 零错误。
- [x] 步骤8：ContextCompression 升级为 LLM 总结式压缩 — 重写 ContextCompression.cs，实现 SummarizeAsync（LLM 调用）+ PlanCompaction（分区：pinned prefix + foldable middle + recent tail）+ PartitionFold（小 user turns 保留，assistant/tool 折叠）+ MechanicalFold（失败回退）。参考 Reasonix compact.go 7 段式 summary prompt。
- [x] 步骤9：AgentLoop 压缩流程升级 — ShouldCompress 从硬编码改为读取前端传入的 compressionThreshold；压缩时调 CompactAsync（异步 LLM）；压缩后 sessionConv.Replace() 同步状态。
- [x] 步骤10：前端传递压缩设置 — sendMessage 参数增加 contextCompressionEnabled + contextCompressionThreshold 字段，从 settings store 读取。
- [x] 步骤11：GeneralPanel 添加压缩设置 UI — Switch（开关）+ Slider（阈值 30%-90%），参考 OpenCowork SettingsPage 布局。i18n 补充翻译。
- [x] 步骤12：双编译验证 + 功能测试。

## 涉及文件

### 新建（Agent）
- `WishfulClaw.Agent/SessionConversation.cs` — per-session conversation 状态管理 + SessionConversationManager 静态注册表

### 修改（Agent）
- `WishfulClaw.Agent/AgentLoop.cs` — 改为增量模式，context compression 使用 sessionConv.Replace()
- `WishfulClaw.Agent/AgentLoop.Helpers.cs` — InjectTimestampPrefix 分钟级精度 + FormatSessionId 辅助方法
- `WishfulClaw.Agent/AgentRuntimeTools.cs` — 新增 ClearSession 方法
- `WishfulClaw.Agent/AgentRuntimeModule.cs` — 注册 agent/clear-session 路由
- `WishfulClaw.Agent/AnthropicMessagesInputWriter.cs` — cache_control 断点从 tools[last] 改为 messages[last]，重构 WriteMessages + 新增 WriteSingleMessage + WriteCacheControl

### 修改（前端）
- `src/renderer/src/hooks/use-chat-actions.ts` — sendMessage 增加 messageCount 字段
- `src/renderer/src/stores/chat-store/index.ts` — sendMessage 类型定义增加 messageCount
- `src/renderer/src/stores/chat-store/session-slice.ts` — deleteSession/clearSessionMessages 调用 agent/clear-session

## 参考源码

- Reasonix `internal/agent/session.go` — Session 结构和 Add/Snapshot/CloneWithMessages
- Reasonix `internal/agent/agent.go` — Agent Run 方法中 session.Add 和 stream 中 requestMessages 构建
- Reasonix `internal/provider/anthropic/anthropic.go` 第 317-329 行 — cache_control 断点设置

## 设计决策

### 增量模式 vs 全量模式

| 场景 | 模式 | 说明 |
|------|------|------|
| 首次对话 | 全量初始化 | 从 messages 构建 conversation，存入 SessionConversation |
| 后续对话 | 增量追加 | C# 端复用已存储 conversation，只追加新消息 |
| 会话恢复 | 全量初始化 | messageCount=0 或与 C# 端不匹配，触发全量重建 |
| Context compression | 替换 | sessionConv.Replace() 替换整个 conversation |
| Session 删除/清除 | 清除 | agent/clear-session IPC 清理 C# 端 SessionConversation |

### 前端如何判断首次 vs 增量

前端发送 `messageCount = historyMessages.length`（已发送的消息数）：
- `messageCount === 0`：全量模式，C# 端初始化 conversation
- `messageCount > 0` 且 `messageCount === sessionConv.MessageCount`：增量模式，C# 端追加新消息
- `messageCount > 0` 但不匹配：全量模式（安全回退，处理 C# 重启等场景）

### cache_control 断点策略

| 断点位置 | 内容 | 说明 |
|---------|------|------|
| system[last] | system prompt | 系统提示词缓存（不变） |
| messages[last][last content block] | 最后一条消息的最后内容块 | 整个对话历史缓存（每轮扩展） |

tools 不再设断点 — messages 断点已覆盖 tools + messages 的完整前缀。
