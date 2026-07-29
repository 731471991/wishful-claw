using System.Text.Json;
using SqlSugar;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.Modules.Db;

/// <summary>
/// SqlSugar 客户端单例 + DB 初始化。
/// dbPath = ~/.wishful-claw/index.db
/// </summary>
internal static class DbClient
{
    private static SqlSugarScope? _db;
    private static string? _dbPath;
    private static bool _initialized;

    /// <summary>
    /// 解析 dbPath。优先用参数传入的 dbPath，否则用默认路径 ~/.wishful-claw/index.db
    /// </summary>
    public static string ResolveDbPath(JsonElement? parameters = null)
    {
        if (parameters.HasValue &&
            parameters.Value.ValueKind == JsonValueKind.Object &&
            parameters.Value.TryGetProperty("dbPath", out var dbPathEl) &&
            dbPathEl.ValueKind == JsonValueKind.String &&
            !string.IsNullOrWhiteSpace(dbPathEl.GetString()))
        {
            return Path.GetFullPath(dbPathEl.GetString()!);
        }

        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".wishful-claw",
            "index.db");
    }

    /// <summary>
    /// 初始化 DB：创建目录、打开连接、CodeFirst 建表、PRAGMA 配置。
    /// 线程安全，只执行一次。
    /// </summary>
    public static DbInitializeResult Initialize(string? dbPathOverride = null)
    {
        var dbPath = dbPathOverride ?? ResolveDbPath();
        try
        {
            var dir = Path.GetDirectoryName(dbPath);
            if (!string.IsNullOrEmpty(dir))
            {
                Directory.CreateDirectory(dir);
            }

            _dbPath = dbPath;
            _db = new SqlSugarScope(new ConnectionConfig
            {
                ConnectionString = $"Data Source={dbPath}",
                DbType = DbType.Sqlite,
                IsAutoCloseConnection = true,
                InitKeyType = InitKeyType.Attribute
            },
            client =>
            {
                // PRAGMA 配置
                client.Ado.ExecuteCommand("PRAGMA journal_mode = WAL;");
                client.Ado.ExecuteCommand("PRAGMA synchronous = NORMAL;");
                client.Ado.ExecuteCommand("PRAGMA busy_timeout = 5000;");
                client.Ado.ExecuteCommand("PRAGMA foreign_keys = ON;");
            });

            // CodeFirst 建表（已存在则跳过）
            WorkerLog.Info("DbClient: starting CodeFirst.InitTables");
            _db.CodeFirst.InitTables(
                typeof(ProjectEntity),
                typeof(SessionEntity),
                typeof(MessageEntity),
                typeof(SubAgentRunEntity),
                typeof(SshConnectionEntity));
            WorkerLog.Info("DbClient: CodeFirst.InitTables completed (5 entities, MemoryArchiveEntity excluded)");

            // memory_entries 表（手动创建，不通过 CodeFirst）
            WorkerLog.Info("DbClient: creating memory_entries table");
            _db!.Ado.ExecuteCommand(
                "CREATE TABLE IF NOT EXISTS memory_entries (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                "scope TEXT NOT NULL DEFAULT 'global', " +
                "title TEXT, " +
                "content TEXT NOT NULL DEFAULT '', " +
                "priority TEXT NOT NULL DEFAULT 'standard', " +
                "status TEXT NOT NULL DEFAULT 'active', " +
                "created_at INTEGER NOT NULL, " +
                "updated_at INTEGER NOT NULL);");
            WorkerLog.Info("DbClient: memory_entries table ready");

            // FTS5 虚拟表（记忆全文搜索）— 外部内容表模式 + trigram 分词器
            // content='memory_entries' 让 FTS5 通过主表 rowid 关联，支持 'delete' 命令
            WorkerLog.Info("DbClient: creating memory_fts virtual table (external content)");
            _db!.Ado.ExecuteCommand(
                "CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(" +
                "title, content, content='memory_entries', content_rowid='id', tokenize='trigram');");
            WorkerLog.Info("DbClient: memory_fts virtual table ready");

            // memory_entries → memory_fts 同步触发器（自动维护索引）
            // 使用原生 Microsoft.Data.Sqlite 执行触发器创建，避免 SqlSugar ExecuteCommand 对 SQL 做预处理
            var triggerSqls = new[]
            {
                "CREATE TRIGGER IF NOT EXISTS memory_entries_ai AFTER INSERT ON memory_entries BEGIN " +
                "INSERT INTO memory_fts(rowid, title, content) " +
                "VALUES (new.id, COALESCE(new.title, ''), new.content); END;",
                "CREATE TRIGGER IF NOT EXISTS memory_entries_ad AFTER DELETE ON memory_entries BEGIN " +
                "INSERT INTO memory_fts(memory_fts, title, content) " +
                "VALUES ('delete', COALESCE(old.title, ''), old.content); END;",
                "CREATE TRIGGER IF NOT EXISTS memory_entries_au_del AFTER UPDATE ON memory_entries BEGIN " +
                "INSERT INTO memory_fts(memory_fts, title, content) " +
                "VALUES ('delete', COALESCE(old.title, ''), old.content); END;",
                "CREATE TRIGGER IF NOT EXISTS memory_entries_au_ins AFTER UPDATE ON memory_entries BEGIN " +
                "INSERT INTO memory_fts(rowid, title, content) " +
                "VALUES (new.id, COALESCE(new.title, ''), new.content); END;"
            };
            WorkerLog.Info($"DbClient: creating {triggerSqls.Length} triggers via raw SqliteCommand");
            using (var trigConn = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={dbPath}"))
            {
                trigConn.Open();
                foreach (var tsql in triggerSqls)
                {
                    using var tcmd = trigConn.CreateCommand();
                    tcmd.CommandText = tsql;
                    tcmd.ExecuteNonQuery();
                }
                WorkerLog.Info("DbClient: all triggers created successfully");
            }

            // ── Migrations: add columns that CodeFirst doesn't add to existing tables ──
            WorkerLog.Info("DbClient: running EnsureColumn migrations");
            EnsureColumn(_db, "sessions", "persona_id", "TEXT");
            WorkerLog.Info("DbClient: migrations completed");

            _initialized = true;
            WorkerLog.Info($"DbClient: initialization completed successfully dbPath={dbPath}");
            return new DbInitializeResult(true, dbPath, null);
        }
        catch (Exception ex)
        {
            _initialized = false;
            WorkerLog.Error($"DbClient: initialization FAILED at dbPath={dbPath} error={ex.GetType().Name}: {ex.Message}\n{ex.StackTrace}");
            return new DbInitializeResult(false, dbPath, ex.Message);
        }
    }

    /// <summary>
    /// 获取已初始化的 DB 客户端。如未初始化则用默认路径初始化。
    /// </summary>
    public static SqlSugarScope GetClient(JsonElement? parameters = null)
    {
        if (_db is null || !_initialized)
        {
            var dbPath = parameters.HasValue ? ResolveDbPath(parameters) : ResolveDbPath();
            var result = Initialize(dbPath);
            if (!result.Success)
            {
                throw new InvalidOperationException($"DB initialization failed: {result.Error}");
            }
        }

        return _db!;
    }

    /// <summary>
    /// 确保 DB 已初始化（从 IPC 参数中解析 dbPath）。
    /// </summary>
    public static void EnsureInitialized(JsonElement parameters)
    {
        if (_db is null || !_initialized)
        {
            var dbPath = ResolveDbPath(parameters);
            var result = Initialize(dbPath);
            if (!result.Success)
            {
                throw new InvalidOperationException($"DB initialization failed: {result.Error}");
            }
        }
    }
    /// <summary>
    /// 确保 DB 已初始化（无参版本，用于非 IPC 上下文调用）。
    /// 要求 DB 已通过 IPC handler 初始化过。
    /// </summary>
    public static void EnsureInitialized()
    {
        if (_db is null || !_initialized)
        {
            throw new InvalidOperationException("DB has not been initialized. Call EnsureInitialized(parameters) from an IPC handler first.");
        }
    }

    /// <summary>
    /// Adds a column to an existing table if it doesn't exist.
    /// CodeFirst.InitTables only creates new tables, not new columns on existing ones.
    /// </summary>
    private static void EnsureColumn(SqlSugarScope db, string table, string column, string columnType)
    {
        try
        {
            // Check if column exists (SQLite PRAGMA table_info)
            var columns = db.Ado.SqlQuery<string>($"PRAGMA table_info({table});");
            var hasColumn = false;
            // PRAGMA table_info returns rows with columns: cid, name, type, notnull, dflt_value, pk
            // SqlSugar might return the name column; let's use a safer approach
            var dt = db.Ado.GetDataTable($"PRAGMA table_info({table});");
            if (dt.Columns.Contains("name"))
            {
                foreach (System.Data.DataRow row in dt.Rows)
                {
                    if (string.Equals(row["name"]?.ToString(), column, StringComparison.OrdinalIgnoreCase))
                    {
                        hasColumn = true;
                        break;
                    }
                }
            }

            if (!hasColumn)
            {
                db.Ado.ExecuteCommand($"ALTER TABLE {table} ADD COLUMN {column} {columnType};");
            }
        }
        catch
        {
            // Ignore migration errors (column may already exist or table not created yet)
        }
    }
}
