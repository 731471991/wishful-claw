# Plan-002: 前端 DB 层 + IPC 桥接 + 消息持久化

## 目标

实现前端 DB 通信层（Electron Main DAO + IPC 桥接 + Renderer db-helpers），将对话消息实时持久化到 SQLite，应用启动时从 DB 加载项目和会话历史。

## 步骤清单

- [ ] 步骤1：创建 `src/main/db/database.ts` — DB 初始化（调用 `workerRequest('db/initialize')`，管理初始化 Promise）
  - 验证：`tsc` 通过
- [ ] 步骤2：创建 `src/main/db/projects-dao.ts` — 项目 DAO（通过 `workerRequest` 调用后端 `db/projects-*`）
  - 验证：`tsc` 通过
- [ ] 步骤3：创建 `src/main/db/sessions-dao.ts` — 会话 DAO（通过 `workerRequest` 调用后端 `db/sessions-*`）
  - 验证：`tsc` 通过
- [ ] 步骤4：创建 `src/main/db/messages-dao.ts` — 消息 DAO（通过 `workerRequest` 调用后端 `db/messages-*`）
  - 验证：`tsc` 通过
- [ ] 步骤5：创建 `src/main/ipc/db-handlers.ts` — MessagePack IPC 桥接（注册 `db:*` handler，转发到 Worker）
  - 验证：`tsc` 通过
- [ ] 步骤6：修改 `src/main/index.ts` — 注册 DB handlers + 应用启动时初始化 DB
  - 验证：`tsc` + `electron-vite build` 通过
- [ ] 步骤7：重写 `src/renderer/src/stores/chat-store/db-helpers.ts` — 将所有 placeholder 替换为真正的 IPC 调用（`window.api.invoke('db:*', ...)`）
  - 验证：`tsc` 通过
- [ ] 步骤8：修改 `chat-store/index.ts` — 在 `sendMessage` 中持久化用户消息，在 `handleEnvelope` 的 `message_end` 中 upsert 助手消息
  - 验证：`tsc` 通过
- [ ] 步骤9：修改 `chat-store/index.ts` — 实现 `dbLoadAll`，在 `MainLayout` 启动时调用加载项目+会话
  - 验证：`tsc` + `build` 通过
- [ ] 步骤10：修改 `session-slice.ts` — 实现 `loadRecentSessionMessages`，从 DB 加载历史消息
  - 验证：`tsc` + `build` 通过 + 端到端验证

## 涉及文件

### 新建
- `src/main/db/database.ts` — DB 初始化
- `src/main/db/projects-dao.ts` — 项目 DAO
- `src/main/db/sessions-dao.ts` — 会话 DAO
- `src/main/db/messages-dao.ts` — 消息 DAO
- `src/main/ipc/db-handlers.ts` — IPC 桥接

### 修改
- `src/main/index.ts` — 注册 DB handlers + 启动初始化
- `src/renderer/src/stores/chat-store/db-helpers.ts` — 实现 IPC 调用
- `src/renderer/src/stores/chat-store/index.ts` — 消息持久化 + dbLoadAll
- `src/renderer/src/stores/chat-store/session-slice.ts` — loadRecentSessionMessages 实现
- `src/renderer/src/components/layout/MainLayout.tsx` — 启动时调用 dbLoadAll

## 参考源码

- OpenCowork 前端 DAO: `D:\gy\OpenCowork\src\main\db\` — database.ts / sessions-dao.ts / projects-dao.ts / messages-dao.ts
- OpenCowork IPC 桥接: `D:\gy\OpenCowork\src\main\ipc\db-handlers.ts` — 参考结构，用 `registerMessagePackHandler` 重写
- wishful-claw 现有 IPC 模式: `src/main/ipc/ai-provider-handlers.ts` — 转发模式参考

## 适配要点

1. **IPC 模式**：OpenCowork 前端 DAO 直接调 `getNativeWorker().request()`；wishful-claw 需通过 `window.api.workerRequest()` → Electron Main → Worker。但 DB handler 在 Main 侧注册，Renderer 通过 `window.api.invoke('db:*', ...)` 调用 Main 侧的 handler，Main 再调 Worker
2. **通道命名**：Renderer → Main 用 `db:projects:list` / `db:sessions:create` 等（冒号分隔）；Main → Worker 用 `db/projects-list` / `db/sessions-create` 等（斜线分隔）
3. **消息序列化**：ChatMessage 的 text/thinking/toolCalls/usage/timing 需序列化为 JSON 存入 messages.content 或 messages.meta 字段
4. **实时持久化**：用户消息在 `sendMessage` 时立即 upsert；助手消息在 `message_end` 事件时 upsert（含最终 text/usage/timing/toolCalls）
5. **启动加载**：`dbLoadAll` 返回 projects + sessions（不含 messages，按需加载），在 MainLayout useEffect 中调用
6. **消息按需加载**：切换会话时调 `loadRecentSessionMessages` 从 DB 加载消息，避免一次性加载所有消息
