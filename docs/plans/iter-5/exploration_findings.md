# 迭代五探索发现：项目注册 + 会话历史

## 当前项目状态

- 分支：`dev/iter-5`（从 `dev/iter-4` 切出）
- 迭代一~四已完成，基础设施完备：Electron + React 前端 + .NET 10 后端 + MessagePack IPC 全链路打通
- 前端布局完整（NavRail + WorkspaceSidebar + TitleBar + SessionConversationPane + ChatHomePage + ProjectHomePage）
- 聊天 UI 完整可用（流式渲染 + 工具调用卡片 + ModelSwitcher）
- chat-store 已拆分为 session-slice / project-slice / streaming-slice，db-helpers 全是 placeholder

## IPC 架构（wishful-claw 模式）

```
Renderer (React)
  → window.api.workerRequest('db/xxx', params)
  → invokeMessagePackBinary('worker:request', {method, params})
  → ipcRenderer.invoke(toMessagePackChannel('worker:request'), encodedPayload)

Electron Main
  → registerMessagePackHandler('worker:request', (args) => worker.request(args.method, args.params))
  → getNativeWorker().request('db/xxx', params)  [via named pipe + MessagePack]

.NET Worker
  → WorkerDispatcher routes to DbModule registered handler
  → DbProjectTools/DbSessionTools/DbMessageTools.Execute(JsonElement params)
  → WorkerResponse.Json(result)  [单参数，无 JsonContext]
```

### 关键差异（vs OpenCowork）

| 项目 | OpenCowork | wishful-claw |
|------|-----------|--------------|
| WorkerResponse.Json | 双参数 `(T, JsonContext)` | 单参数 `(T)` |
| 前端 DAO → Worker | `getNativeWorker().request()` 直接调用 | 通过 `window.api.workerRequest()` → Electron Main 中转 |
| DB 路径 | `~/.open-cowork/data.db` | `~/.wishful-claw/index.db` |
| 命名空间 | 无（internal class） | `WishfulClaw.Worker.Modules.Db` |
| SQLite 依赖 | 已有 `Microsoft.Data.Sqlite` | **未安装**，需添加 |
| DB IPC handler 注册 | `electronIpcMain.handle(channel, ...)` + MessagePack 编解码 | `registerMessagePackHandler(channel, handler)` 封装 |
| 前端 MessagePack 通道 | 手动 `DB_XXX_MSGPACK_CHANNEL` 常量 | `toMessagePackChannel(channel)` 自动转换 |

## 参考源码关键文件

### OpenCowork 后端 C#（`D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\Db\`）

| 文件 | 用途 | 搬入策略 |
|------|------|----------|
| `DbConnectionFactory.cs` | SQLite 连接管理（WAL/PRAGMA/dbPath） | 搬入，改 dbPath 为 `~/.wishful-claw/index.db` |
| `DbSchemaMigrator.cs` | 建表脚本（43K，含大量不需要的表） | **只取** projects/sessions/messages 三张表 + 索引 |
| `DbSql.cs` | SQL 辅助（ExecuteNonQuery + SqlParam） | 直接搬入 |
| `DbSchemaTools.cs` | Initialize 入口 | 搬入，简化 |
| `DbProjectModels.cs` | ProjectRow + result records | 搬入 |
| `DbProjectTools.cs` | 项目 CRUD（22K） | 搬入，去掉 EnsurePluginProject/FindByPluginId |
| `DbSessionModels.cs` | SessionRow + result records | 搬入，去掉 plugin 相关字段 |
| `DbSessionTools.cs` | 会话 CRUD（25K） | 搬入，去掉 plugin/clear-project 逻辑 |
| `DbMessageModels.cs` | MessageRow + MessageInput + results | 搬入 |
| `DbMessageTools.cs` | 消息 CRUD（58K，含大量高级功能） | **只取** List/Upsert/Add/AddBatch/Update/Clear/Delete/Count/DeleteLast/TruncateFrom |
| `DbModule.cs` | 模块注册（含大量不需要的 handler） | **只注册** projects/sessions/messages 的核心 handler |

### OpenCowork 前端 TS（`D:\gy\OpenCowork\src\main\db\` + `src\main\ipc\`）

| 文件 | 用途 | 搬入策略 |
|------|------|----------|
| `database.ts` | 初始化 DB | 搬入，改路径，用 `workerRequest` 代替 `getNativeWorker().request()` |
| `sessions-dao.ts` | 会话 DAO | 搬入，用 `workerRequest` 适配 |
| `projects-dao.ts` | 项目 DAO | 搬入，去掉 plugin/baseDirectory 逻辑 |
| `messages-dao.ts` | 消息 DAO | 搬入，去掉高级功能（window/search/locator） |
| `db-handlers.ts` | IPC 桥接（939 行） | **重写**，用 `registerMessagePackHandler` 模式，只保留核心 handler |

## wishful-claw 现有桩代码

### 前端 db-helpers.ts（全是 placeholder）
- `dbCreateSession(Session)` — no-op
- `dbDeleteSession(sessionId)` — no-op
- `dbUpdateSession(sessionId, patch)` — no-op
- `dbCreateProject(Project)` — no-op
- `dbDeleteProject(projectId)` — no-op
- `dbUpdateProject(projectId, patch)` — no-op
- `dbLoadAll()` — 返回 null

### 前端 types.ts（已定义完整）
- `Session` 接口：id/title/mode/messages/messageCount/createdAt/updatedAt/projectId/workingFolder/providerId/modelId/modelSelectionMode 等
- `Project` 接口：id/name/createdAt/updatedAt/workingFolder/pinned/providerId/modelId/sessionCount
- `ChatMessage` 接口：id/role/text/thinking/isStreaming/usage/timing/error/toolCalls/createdAt

### 前端 session-slice.ts / project-slice.ts
- CRUD 逻辑完整，已调用 `dbCreateSession` 等 placeholder
- 需要将 placeholder 替换为真正的 IPC 调用

### 前端 chat-store/index.ts
- `sendMessage` 中调用 `beginUserTurn` 添加用户消息和 assistant placeholder
- `handleEnvelope` 处理流式事件（text_delta/thinking_delta/message_end/tool_call/loop_end/error）
- **当前无消息持久化**——需要在此集成

### 后端 WorkerModuleCatalog.cs
- 当前 6 个模块：SystemModule/ConfigModule/ProviderModule/ProviderTestModule/AgentRuntimeModule/ToolModule
- 需要添加 `DbModule`

### 后端 Worker.csproj
- 无 `Microsoft.Data.Sqlite` 依赖
- 需要添加 NuGet 包引用

## 潜在风险

1. **SQLite 依赖安装**：需要 `dotnet add package Microsoft.Data.Sqlite`，确保网络可用
2. **WorkerResponse 适配**：OpenCowork 用 `WorkerResponse.Json(T, JsonContext)`，wishful-claw 用 `WorkerResponse.Json(T)`——需去掉所有 JsonContext 参数
3. **命名空间**：OpenCowork 的 DB 类全是 `internal` 无命名空间，需改为 `WishfulClaw.Worker.Modules.Db` 命名空间 + `public`/`internal` 可见性
4. **消息序列化**：ChatMessage 含 toolCalls/usage/timing 等复杂对象，持久化时需序列化为 JSON（meta 字段），反序列化时需还原
5. **流式写入时机**：用户要求对话流式输出时就写入 SQLite——需要在 `message_end` 事件时 upsert 最终消息，而不是等对话结束
6. **DB 初始化时机**：需要在 Electron Main `app.whenReady()` 时初始化 DB，且在渲染进程加载前完成
