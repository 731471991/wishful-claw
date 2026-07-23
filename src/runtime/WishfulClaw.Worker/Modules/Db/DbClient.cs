using System.Text.Json;
using SqlSugar;

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
            _db.CodeFirst.InitTables(
                typeof(ProjectEntity),
                typeof(SessionEntity),
                typeof(MessageEntity));

            // ── Migrations: add columns that CodeFirst doesn't add to existing tables ──
            EnsureColumn(_db, "sessions", "persona_id", "TEXT");

            _initialized = true;
            return new DbInitializeResult(true, dbPath, null);
        }
        catch (Exception ex)
        {
            _initialized = false;
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
