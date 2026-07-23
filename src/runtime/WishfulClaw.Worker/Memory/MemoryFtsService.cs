using System.Text.Json;
using SqlSugar;
using WishfulClaw.Worker.Modules.Db;
using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Worker.Memory;

/// <summary>
/// FTS5-based memory search service.
/// Manages the full-text search index for hot/warm/cold memory entries.
///
/// Hot/Warm: manually indexed via IndexAsync (called by MemoryStore on file changes).
/// Cold: auto-indexed via memory_archive table triggers.
///
/// Design based on OpenClaw.net's SqliteMemoryStore FTS5 approach.
/// </summary>
public sealed class MemoryFtsService : IMemorySearch
{
    private const int TokenCharEstimate = 4;

    // ── IMemorySearch: Search ──

    public Task<IReadOnlyList<MemorySearchResult>> SearchAsync(
        string query,
        string? scope = null,
        int limit = 10,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query) || limit <= 0)
            return Task.FromResult<IReadOnlyList<MemorySearchResult>>([]);

        limit = Math.Clamp(limit, 1, 50);
        var db = DbClient.GetClient();

        // Build FTS5 query — use simple MATCH with escaped query
        var ftsQuery = EscapeFtsQuery(query);
        if (string.IsNullOrWhiteSpace(ftsQuery))
            return Task.FromResult<IReadOnlyList<MemorySearchResult>>([]);

        var sql = scope is null or "global"
            ? """
                SELECT key, title, content, scope, tier, rank
                FROM memory_fts
                WHERE memory_fts MATCH @query
                ORDER BY rank
                LIMIT @limit
                """
            : """
                SELECT key, title, content, scope, tier, rank
                FROM memory_fts
                WHERE memory_fts MATCH @query AND scope = @scope
                ORDER BY rank
                LIMIT @limit
                """;

        var results = new List<MemorySearchResult>();
        try
        {
            var dt = db.Ado.GetDataTable(sql, new SugarParameter("@query", ftsQuery), new SugarParameter("@limit", limit));
            foreach (System.Data.DataRow row in dt.Rows)
            {
                ct.ThrowIfCancellationRequested();
                results.Add(RowToResult(row));
            }
        }
        catch
        {
            // FTS search failure is non-fatal
        }

        return Task.FromResult<IReadOnlyList<MemorySearchResult>>(results);
    }

    // ── IMemorySearch: Index (hot/warm) ──

    public Task IndexAsync(string scope, string key, string title, string content, CancellationToken ct = default)
    {
        var db = DbClient.GetClient();

        try
        {
            // Remove existing entry for this scope+key, then insert
            db.Ado.ExecuteCommand(
                "DELETE FROM memory_fts WHERE scope = @scope AND key = @key;",
                new SugarParameter("@scope", scope),
                new SugarParameter("@key", key));

            db.Ado.ExecuteCommand(
                "INSERT INTO memory_fts(scope, key, title, content, tier) VALUES (@scope, @key, @title, @content, @tier);",
                new SugarParameter("@scope", scope),
                new SugarParameter("@key", key),
                new SugarParameter("@title", title ?? key),
                new SugarParameter("@content", content ?? ""),
                new SugarParameter("@tier", "hot"));
        }
        catch
        {
            // Index update failure is non-fatal
        }

        return Task.CompletedTask;
    }

    // ── IMemorySearch: Remove from index ──

    public Task RemoveFromIndexAsync(string scope, string key, CancellationToken ct = default)
    {
        var db = DbClient.GetClient();
        try
        {
            db.Ado.ExecuteCommand(
                "DELETE FROM memory_fts WHERE scope = @scope AND key = @key;",
                new SugarParameter("@scope", scope),
                new SugarParameter("@key", key));
        }
        catch
        {
            // Non-fatal
        }
        return Task.CompletedTask;
    }

    // ── IMemorySearch: Archive to cold (DB) ──

    public Task ArchiveToColdAsync(string scope, string key, string title, string content, MemoryPriority priority, CancellationToken ct = default)
    {
        var db = DbClient.GetClient();
        var id = $"{scope}:{key}";
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        try
        {
            // Check if already archived
            var existing = db.Queryable<MemoryArchiveEntity>()
                .Where(e => e.Id == id)
                .First();

            if (existing is not null)
            {
                // Update existing
                existing.Title = title;
                existing.Content = content;
                existing.Priority = priority.ToString().ToLowerInvariant();
                existing.ArchivedAt = now;
                db.Updateable(existing).ExecuteCommand();
            }
            else
            {
                // Insert new
                db.Insertable(new MemoryArchiveEntity
                {
                    Id = id,
                    Scope = scope,
                    Key = key,
                    Title = title,
                    Content = content,
                    Priority = priority.ToString().ToLowerInvariant(),
                    CreatedAt = now,
                    ArchivedAt = now
                }).ExecuteCommand();
            }

            // Remove from hot/warm FTS index (cold is auto-indexed via trigger)
            db.Ado.ExecuteCommand(
                "DELETE FROM memory_fts WHERE scope = @scope AND key = @key AND tier != 'cold';",
                new SugarParameter("@scope", scope),
                new SugarParameter("@key", key));
        }
        catch
        {
            // Non-fatal
        }

        return Task.CompletedTask;
    }

    // ── IMemorySearch: Search cold only ──

    public Task<IReadOnlyList<MemorySearchResult>> SearchColdAsync(
        string query,
        string? scope = null,
        int limit = 10,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query) || limit <= 0)
            return Task.FromResult<IReadOnlyList<MemorySearchResult>>([]);

        limit = Math.Clamp(limit, 1, 50);
        var db = DbClient.GetClient();

        var ftsQuery = EscapeFtsQuery(query);
        if (string.IsNullOrWhiteSpace(ftsQuery))
            return Task.FromResult<IReadOnlyList<MemorySearchResult>>([]);

        var sql = scope is null or "global"
            ? """
                SELECT key, title, content, scope, 'cold' AS tier, rank
                FROM memory_fts
                WHERE memory_fts MATCH @query AND tier = 'cold'
                ORDER BY rank
                LIMIT @limit
                """
            : """
                SELECT key, title, content, scope, 'cold' AS tier, rank
                FROM memory_fts
                WHERE memory_fts MATCH @query AND tier = 'cold' AND scope = @scope
                ORDER BY rank
                LIMIT @limit
                """;

        var results = new List<MemorySearchResult>();
        try
        {
            var dt = db.Ado.GetDataTable(sql, new SugarParameter("@query", ftsQuery), new SugarParameter("@limit", limit));
            foreach (System.Data.DataRow row in dt.Rows)
            {
                ct.ThrowIfCancellationRequested();
                results.Add(RowToResult(row));
            }
        }
        catch
        {
            // Non-fatal
        }

        return Task.FromResult<IReadOnlyList<MemorySearchResult>>(results);
    }

    // ── Helpers ──

    private static MemorySearchResult RowToResult(System.Data.DataRow row)
    {
        var key = row["key"]?.ToString() ?? "";
        var title = row["title"]?.ToString() ?? key;
        var content = row["content"]?.ToString() ?? "";
        var scope = row["scope"]?.ToString() ?? "global";
        var tierStr = row["tier"]?.ToString() ?? "hot";
        var rankObj = row["rank"];
        var score = rankObj is double d ? d : 0;

        var tier = tierStr.ToLowerInvariant() switch
        {
            "warm" => MemoryTier.Warm,
            "cold" => MemoryTier.Cold,
            _ => MemoryTier.Hot
        };

        return new MemorySearchResult
        {
            Key = key,
            Title = title,
            Content = content,
            Scope = scope,
            Tier = tier,
            Score = score,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    /// <summary>
    /// Escape a query string for FTS5 MATCH.
    /// Wraps each term in double quotes to prevent special character interpretation.
    /// </summary>
    private static string EscapeFtsQuery(string query)
    {
        var terms = query
            .Trim()
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(t => t.Length > 0)
            .Select(t => $"\"{t.Replace("\"", "\"\"", StringComparison.Ordinal)}\"");

        var result = string.Join(" ", terms);
        return string.IsNullOrWhiteSpace(result) ? "" : result;
    }
}
