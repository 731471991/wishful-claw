# Plan-002 审查报告

## 审查项

### 1. 代码是否符合分层约定
- db-helpers.ts 在 Renderer 层，通过 `window.api.workerRequest` 调用 Worker ✅
- 不需要 Electron Main 层额外 DAO/handler — `worker:request` 转发器已覆盖所有 `db/*` 方法 ✅
- 与现有 IPC 模式一致（ai-provider-handlers / agent-stream 都用同一模式） ✅

### 2. 是否有硬编码路径、密钥等
- 无硬编码路径（dbPath 由后端 DbClient.ResolveDbPath 决定） ✅
- 无密钥 ✅

### 3. 消息持久化逻辑
- 用户消息在 `sendMessage` 时 upsert（fire-and-forget） ✅
- 助手消息在 `message_end` 事件时 upsert（含最终 text/usage/timing/toolCalls） ✅
- 序列化：content=text, meta=JSON({thinking,toolCalls,isStreaming,error}), usage=JSON ✅
- 反序列化：loadRecentSessionMessages 从 DB 加载并还原 ChatMessage ✅

### 4. 错误处理
- dbLoadAll 有 try-catch，失败返回 null（降级到 ensureDefaultProject） ✅
- loadRecentSessionMessages 有 try-catch，失败时仍标记 messagesLoaded=true ✅
- 所有 fire-and-forget DB 调用用 void 前缀，不会阻塞 UI ✅

### 5. 架构简化决策
- 原计划需要 5 个 Main 侧文件（database.ts + 3 DAO + db-handlers.ts）
- 实际发现 `window.api.workerRequest` 已能直连 Worker 的 `db/*` handler
- 简化为 0 个 Main 侧新文件，全部在 Renderer 层完成
- 这符合 wishful-claw 的架构（Worker 是唯一的业务逻辑层） ✅

### 6. 启动加载流程
- MainLayout useEffect → dbLoadAll → hydrate store → 如果无项目则 ensureDefaultProject ✅
- 会话切换时 loadRecentSessionMessages 从 DB 按需加载消息 ✅

## 阻断项

❌ 项 = 0

## 结论

Plan-002 审查通过，可进入验证态。
