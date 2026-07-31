# 探索发现：v2-iter-2 缓存命中率修复

## 问题现象

同一会话缓存命中率在 31%~99% 之间剧烈跳动，连续两轮请求命中率差异可达 50%+。

## 根因：无状态架构 — 每轮全量重建消息历史

### 当前流程（wishful-claw）

```
前端 use-chat-actions.ts
  → 遍历 session.messages 全量构建 historyMessages（JSON 对象数组）
  → 连同新 user message 一起发给 C# Worker（agent/run）
  → Worker 的 AgentLoop.ExecuteLoopAsync 收到 parameters
  → ReadWireConversation(parameters) 从 JSON 中解析全部 messages
  → ReadConversation(wireConversation) 逐条反序列化为 AgentRuntimeChatMessage
  → 发给 Provider（OpenAI/Anthropic）
```

每一轮都从头重建整个消息历史。只要重建过程中有任何 byte 差异，前缀缓存就 miss。

### Reasonix 流程（目标参考）

```
Agent 实例长驻，持有 Session 对象
  → Session.Messages 是 []provider.Message 切片
  → 用户发消息 → session.Add(userMessage) — 追加，不重建
  → Agent Loop stream() → requestMessages = append([]Message(nil), session.Messages...)
  → 发给 Provider
  → 收到 assistant 回复 → session.Add(assistantMessage)
  → 工具执行完 → session.Add(toolResultMessage)
```

**关键区别**：Reasonix 的消息历史在内存中持续存在，每轮只追加新消息，前缀部分天然 byte-stable。

## Reasonix 的缓存优化机制

### 1. Session 内存状态

```go
type Session struct {
    mu          sync.RWMutex
    Messages    []provider.Message  // 持续追加，不重建
    version     uint64               // 每次追加 +1
    rewriteVersion int               // 压缩/折叠时 +1
}
```

- `Add(message)` — 追加消息，version++
- `Snapshot()` — 返回副本供跨 goroutine 读取
- `CloneWithMessages(msgs)` — 压缩后用新消息列表替换

### 2. cache_control 断点设置（≤2 个）

```go
// 断点1: system prompt 最后一个 block（缓存 tools + system）
if n := len(system); n > 0 {
    system[n-1].CacheControl = ephemeral()
} else if n := len(tools); n > 0 {
    tools[n-1].CacheControl = ephemeral()
}
// 断点2: 最后一条 message 的最后一个 block（缓存对话前缀）
if n := len(msgs); n > 0 {
    if k := len(msgs[n-1].Content); k > 0 {
        msgs[n-1].Content[k-1].CacheControl = ephemeral()
    }
}
```

### 3. CreatedAt 剥离

```go
// CreatedAt 是 UI 元数据，不是模型输入。发送前剥离，避免时间戳变化影响缓存前缀。
requestMessages := append([]Message(nil), provider.ModelMessages(a.session.Messages)...)
for i := range requestMessages {
    requestMessages[i].CreatedAt = 0
}
```

### 4. Normalize（加载时修复，不 perturb 缓存）

```go
// 加载历史时修复格式问题（空工具名、悬空调用等），修复后的消息在下次保存时持久化
// 常见情况是 no-op，不分配内存，不影响缓存前缀
func NormalizeSession(msgs []Message) []Message {
    return provider.NormalizeSessionMessages(msgs)
}
```

## wishful-claw 当前的问题点

### 问题1：前端全量重建

`use-chat-actions.ts` 第 55-97 行：每轮从 `session.messages` 遍历构建 `historyMessages`，包括：
- JSON 对象的字段顺序可能不稳定
- tool_use / tool_result 的 content 格式化可能有差异
- 消息数量多时序列化开销大

### 问题2：C# 端每轮反序列化

`ConversationCodec.cs`：`ReadWireConversation` 从 JsonElement 解析全部 messages，`ReadConversation` 逐条构建 `AgentRuntimeChatMessage`。每轮都做完整反序列化。

### 问题3：InjectTimestampPrefix 每秒变化

`AgentLoop.Helpers.cs` 第 165 行：`DateTimeOffset.Now` 精确到秒，注入到最后一条 user message 前面。虽然不碰 system prompt，但改变了消息前缀。

### 问题4：cache_control 断点位置

当前在 system prompt + 最后一个 tool 上设断点（2 个断点）。Reasonix 在 system + 最后一条 message 上设断点（也是 2 个断点）。**没有在消息上设断点**是关键差异——Reasonix 的第二个断点在最后一条消息上，随着消息追加，前缀部分被缓存；我们的第二个断点在 tools 上，消息部分没有缓存断点。

## 修复方案

### 核心：C# 端维护 Session 状态

参考 Reasonix 的 Session 模式：

1. **AgentRuntimeRunState 持有 conversation** — 当前 RunState 只持有 Parameters（包含 messages），改为持有 `List<AgentRuntimeChatMessage>` conversation 状态
2. **agent/run 首次调用**：全量初始化 conversation（从 messages 构建）
3. **后续轮次（agent/append-messages 或 agent/run）**：只发送增量消息（新 user message + tool results），C# 端追加到现有 conversation
4. **session 切换**：重置 conversation 状态
5. **context compression**：压缩后替换 conversation（类似 Reasonix 的 RewriteVersion）

### 前端改造

`use-chat-actions.ts` 改为：
- 首次对话：发送全量 messages（初始化）
- 后续对话：只发送新的 user message（增量）
- 复用 `agent/append-messages` IPC 通道（已有，但当前未用于此场景）

### 动态注入稳定化

- **InjectTimestampPrefix**：改为日期级精度（`yyyy-MM-dd`），或移到 system prompt 外部
- **buildRuntimeReminder**：确保内容在会话期间尽量稳定，避免每轮变化

### cache_control 断点对齐 Reasonix

当前：system prompt 断点 + tools 最后一个断点
改为：system prompt 断点 + 最后一条 message 断点（对齐 Reasonix）

## 风险

1. **session 切换边界**：用户切换会话时需要重置 conversation 状态。当前 AgentRuntimeRunState 是 per-run 的（每次 agent/run 创建新的），改为 per-session 需要管理生命周期。
2. **context compression**：压缩后需要替换 conversation 而非追加。
3. **增量消息协议**：前端需要知道哪些消息已发送、哪些是新增的。可用 message ID 或 count 追踪。
4. **兼容性**：需要同时支持全量模式（首次/恢复会话）和增量模式（后续轮次）。
