# Plan-001: 后端 DB 层（SqlSugar ORM + DbModule）

## 目标

在 .NET Worker 中用 SqlSugar ORM 创建 SQLite 持久化基础设施（projects/sessions/messages 三张表 + CRUD），注册为 DbModule。参考 OpenCowork 的表结构和逻辑，用 ORM 重写而非手写 SQL。

## 步骤清单

- [ ] 步骤1：添加 `SqlSugarCore` NuGet 包到 `WishfulClaw.Worker.csproj`
  - 验证：`dotnet build` 通过
- [ ] 步骤2：创建 `Modules/Db/DbEntities.cs` — 三张表的实体类（ProjectEntity / SessionEntity / MessageEntity），用 SugarTable/SugarColumn 特性标注
  - 验证：`dotnet build` 通过
- [ ] 步骤3：创建 `Modules/Db/DbClient.cs` — SqlSugar 客户端管理（单例 SqlSugarScope，WAL 模式，dbPath = ~/.wishful-claw/index.db，CodeFirst 自动建表）
  - 验证：`dotnet build` 通过
- [ ] 步骤4：创建 `Modules/Db/DbProjectTools.cs` — 项目 CRUD（List/Get/Create/Update/Delete/EnsureDefault），用 SqlSugar 操作
  - 验证：`dotnet build` 通过
- [ ] 步骤5：创建 `Modules/Db/DbSessionTools.cs` — 会话 CRUD（List/Get/Create/Update/Delete/ClearAll），用 SqlSugar 操作
  - 验证：`dotnet build` 通过
- [ ] 步骤6：创建 `Modules/Db/DbMessageTools.cs` — 消息 CRUD（List/Upsert/Add/AddBatch/Update/Clear/Delete/Count/DeleteLast/TruncateFrom），用 SqlSugar 操作
  - 验证：`dotnet build` 通过
- [ ] 步骤7：创建 `Modules/Db/DbModule.cs` — 注册所有 `db/*` IPC handler + 注册到 `WorkerModuleCatalog`
  - 验证：`dotnet build` 通过 + Worker 能启动并响应 `db/initialize`

## 涉及文件

### 新建
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbEntities.cs` — 实体类（3 张表）
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbClient.cs` — SqlSugar 客户端 + 初始化 + CodeFirst
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbProjectTools.cs` — 项目 CRUD
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbSessionTools.cs` — 会话 CRUD
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbMessageTools.cs` — 消息 CRUD
- `src/runtime/WishfulClaw.Worker/Modules/Db/DbModule.cs` — 模块注册

### 修改
- `src/runtime/WishfulClaw.Worker/WishfulClaw.Worker.csproj` — 添加 `SqlSugarCore` NuGet 包
- `src/runtime/WishfulClaw.Worker/WorkerModuleCatalog.cs` — 添加 DbModule

## 参考源码

- OpenCowork: `D:\gy\OpenCowork\sidecars\OpenCowork.Native.Worker\Modules\Db\` — 参考表结构、字段定义、CRUD 逻辑
  - `DbProjectModels.cs` / `DbSessionModels.cs` / `DbMessageModels.cs` — 实体字段参考
  - `DbProjectTools.cs` / `DbSessionTools.cs` / `DbMessageTools.cs` — 业务逻辑参考
  - `DbSchemaMigrator.cs` — 建表语句参考（确认表结构）
  - `DbModule.cs` — handler 注册参考

## 适配要点

1. **SqlSugar 客户端**：用 `SqlSugarScope` 单例，连接字符串 `Data Source=~/.wishful-claw/index.db`，开启 WAL 模式
2. **CodeFirst 建表**：`db.CodeFirst.InitTables(typeof(ProjectEntity), typeof(SessionEntity), typeof(MessageEntity))`，不需要手写建表 SQL
3. **实体类**：用 `[SugarTable("projects")]` 标注表名，`[SugarColumn(IsPrimaryKey = true)]` 标注主键，字段名用 snake_case 映射
4. **WorkerResponse**：用 `WorkerResponse.Json(T)` 单参数序列化
5. **命名空间**：`WishfulClaw.Worker.Modules.Db`
6. **去掉不需要的功能**：plugin/ssh/plan/goal/cron/draw/sync/usage/sub-agent 全部不搬
7. **消息 upsert**：SqlSugar 自带 `db.Storageable(entity).ExecuteCommand()` 实现 upsert
8. **PRAGMA 配置**：SqlSugar 连接后执行 `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;` 等优化
