using SqlSugar;
using WishfulClaw.Infrastructure.Db;
using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Workspace.Memory;

/// <summary>
/// Memory search service using SQLite FTS5 (trigram tokenizer) with LIKE fallback.
/// All memory data lives in the memory_entries table; FTS index is auto-maintained by triggers.
/// </summary>
public sealed class MemoryFtsService : IMemorySearch
{
    public Task<IReadOnlyList<MemorySearchResult>> SearchAsync(
        string query,
        string? scope = null,
        int limit = 10,
        bool includeDeprecated = false,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query) || limit <= 0)
            return Task.FromResult<IReadOnlyList<MemorySearchResult>>([]);

        limit = Math.Clamp(limit, 1, 50);
        var q = query.Trim();
        var db = DbClient.GetClient();
        var results = new List<MemorySearchResult>();
        var statusFilter = includeDeprecated ? "" : " AND status = 'active'";
        var scopeFilter = string.IsNullOrWhiteSpace(scope) || scope == "global"
            ? ""
            : $" AND scope = '{EscapeSql(scope)}'";

        // ── Method 1: FTS trigram search ──
        try
        {
            var ftsSql = $"""
                SELECT e.id, e.title, e.content, e.scope, e.priority, e.status, e.updated_at
                FROM memory_fts f
                JOIN memory_entries e ON f.rowid = e.id
                WHERE memory_fts MATCH @query{scopeFilter}{statusFilter}
                ORDER BY rank
                LIMIT @limit
                """;
            var dt = db.Ado.GetDataTable(ftsSql,
                new SugarParameter("@query", q),
                new SugarParameter("@limit", limit));
            foreach (System.Data.DataRow row in dt.Rows)
            {
                ct.ThrowIfCancellationRequested();
                results.Add(RowToResult(row));
            }
        }
        catch
        {
            // FTS failed — will fall through to LIKE
        }

        // ── Method 2: LIKE fallback (if FTS returned nothing) ──
        if (results.Count == 0)
        {
            var likeSql = $"""
                SELECT id, title, content, scope, priority, status, updated_at
                FROM memory_entries
                WHERE (content LIKE @pattern OR title LIKE @pattern){scopeFilter}{statusFilter}
                ORDER BY updated_at DESC
                LIMIT @limit
                """;
            var dt = db.Ado.GetDataTable(likeSql,
                new SugarParameter("@pattern", $"%{q}%"),
                new SugarParameter("@limit", limit));
            foreach (System.Data.DataRow row in dt.Rows)
            {
                ct.ThrowIfCancellationRequested();
                results.Add(RowToResult(row));
            }
        }

        return Task.FromResult<IReadOnlyList<MemorySearchResult>>(results);
    }

    private static MemorySearchResult RowToResult(System.Data.DataRow row)
    {
        var id = row["id"] is long l ? l : Convert.ToInt64(row["id"]);
        var title = row["title"]?.ToString() ?? "";
        var content = row["content"]?.ToString() ?? "";
        var scope = row["scope"]?.ToString() ?? "global";
        var priority = row["priority"]?.ToString() ?? "standard";
        var status = row["status"]?.ToString() ?? "active";
        var updatedAtVal = row["updated_at"];
        var updatedAt = updatedAtVal is long u
            ? DateTimeOffset.FromUnixTimeSeconds(u)
            : DateTimeOffset.UtcNow;

        return new MemorySearchResult
        {
            Id = id,
            Title = title,
            Content = content,
            Scope = scope,
            Priority = priority,
            Status = status,
            UpdatedAt = updatedAt
        };
    }

    private static string EscapeSql(string s) => s.Replace("'", "''", StringComparison.Ordinal);
}
