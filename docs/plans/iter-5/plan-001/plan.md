# Plan-001: 后端 DB 层（SQLite + DbModule）

## 目标

在 .NET Worker 中搬入 OpenCowork 的 DB 层，创建 SQLite 持久化基础设施（projects/sessions/messages 三张表 + CRUD），注册为 DbModule。

## 步骤清单

- [ ] 步骤1：添加 `Microsoft.Data.Sqlite` NuGet 包到 `WishfulClaw.Worker.csproj`
  - 验证：`dotnet build` 通过
- [ ] 步骤2：创建 `Modules/Db/DbConnectionFactory.cs` — SQLite 连接管理（WAL 模式、PRAGMA 配置、dbPath = ~/.wishful-claw/index.db）
  - 验证：`dotnet build` 通过
- [ ] 步骤3：创建 `Modules/Db/DbSql.cs` — SQL 辅助（ExecuteNonQuery + SqlParam record）
  - 验证：`dotnet build` 通过
- [ ] 步骤4：创建 `Modules/Db/DbSchemaMigrator.cs` — 建表脚本（只含 projects/sessions/messages 三张表 + 索引）
  - 验证：`dotnet build` 通过
- [ ] 步骤5：创建 `Modules/Db/DbSchemaTools.cs` — Initialize 入口（调用 ConnectionFactory + SchemaMigrator）
  - 验证：`dotnet build` 通过
- [ ] 步骤6：创建 `Modules/Db/DbProjectModels.cs` + `DbProjectTools.cs` — 项目 CRUD（List/Get/Create/Update/Delete/EnsureDefault）
  - 验证：`dotnet build` 通过
- [ ] 步骤7：创建 `Modules/Db/DbSessionModels.cs` + `DbSessionTools.cs` — 会话 CRUD（List/Get/Create/Update/Delete/ClearAll）
  - 验证：`dotnet build` 通过
- [ ] 步骤8：创建 `Modules/Db/DbMessageModels.cs` + `DbMessageTools.cs` — 消息 CRUD（List/Upsert/Add/AddBatch/Update/Clear/Delete/Count/DeleteLast/TruncateFrom）
  - 验证：`dotnet build` 通过
- [ ] 步骤9：创建 `Modules/Db/DbModule.cs` — 注册所有 `db/*` IPC handler + 注册到 `WorkerModuleCatalog`
  - 验证：`dotnet build` 通过 + Worker 能启动并响应 `db/initialize`

## 涉及文件

- `src/runtime/WishfulClaw.Worker/WishfulClaw.Worker.csproj` — 添加 NuGet 包
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbConnectionFactory.cs` — 新建
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbSql.cs` — 新建
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbSchemaMigrator.cs` — 新建
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbSchemaTools.cs` — 新建
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbProjectModels.cs` — 新建
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbProjectTools.cs` — 新建
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbSessionModels.cs` — 新建
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbSessionTools.cs` — 新建
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbMessageModels.cs` — 新建
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbMessageTools.cs` — 新建
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbModule.cs` — 新建
- `src/runtime/WishfulClaw.Worker/WorkerModuleCatalog.cs` — 修改（添加 DbModule）

## 参考源码

- OpenCowork: `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\Db\` — 完整 DB 层
  - `DbConnectionFactory.cs` — 连接管理（改 dbPath）
  - `DbSchemaMigrator.cs` — 只取 projects/sessions/messages 建表语句
  - `DbSql.cs` — 直接搬入
  - `DbSchemaTools.cs` — 搬入并简化
  - `DbProjectTools.cs` / `DbProjectModels.cs` — 去掉 plugin/baseDirectory 逻辑
  - `DbSessionTools.cs` / `DbSessionModels.cs` — 去掉 plugin 逻辑
  - `DbMessageTools.cs` / `DbMessageModels.cs` — 只取核心 CRUD

## 适配要点

1. **命名空间**：所有类改为 `WishfulClaw.Worker.Modules.Db` 命名空间
2. **WorkerResponse**：去掉所有 `WorkerJsonContext.Default.X` 第二参数，用 `WorkerResponse.Json(T)` 单参数
3. **dbPath**：改为 `~/.wishful-claw/index.db`
4. **去掉不需要的功能**：plugin/ssh/plan/goal/cron/draw/sync/usage/sub-agent 全部不搬
5. **WorkerResponse.Json** 序列化用 `WorkerJsonHelper.JsonOptions`（camelCase），模型类的 `[JsonPropertyName]` 保持 snake_case（与 DB 列名对齐），前端读取时注意映射
