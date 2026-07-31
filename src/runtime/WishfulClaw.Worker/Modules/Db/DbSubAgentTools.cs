using System.Text.Json;
using SqlSugar;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Infrastructure.Db;

namespace WishfulClaw.Worker.Modules.Db;

/// <summary>
/// CRUD operations for sub-agent run history.
/// Front-end sends full SubAgentState JSON as "data"; we store it verbatim
/// and return it as-is so the UI can reconstruct the full state.
/// </summary>
internal static class DbSubAgentTools
{
    // ── Read: single sub-agent run by toolUseId ──

    public static WorkerResponse ReadByToolUseId(JsonElement parameters)
    {
        try
        {
            var toolUseId = RequireString(parameters, "toolUseId");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var entity = db.Queryable<SubAgentRunEntity>()
                .First(e => e.ToolUseId == toolUseId);

            if (entity is null)
                return WorkerResponse.Json(new { found = false });

            return WorkerResponse.Json(new
            {
                found = true,
                data = JsonSerializer.Deserialize<JsonElement>(entity.Data, WorkerJsonHelper.JsonOptions)
            });
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbSubAgentTools.ReadByToolUseId failed: {ex.GetType().Name}: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ── Read: list all sub-agent runs for a session ──

    public static WorkerResponse ReadSession(JsonElement parameters)
    {
        try
        {
            var sessionId = RequireString(parameters, "sessionId");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var entities = db.Queryable<SubAgentRunEntity>()
                .Where(e => e.SessionId == sessionId)
                .OrderBy("started_at DESC")
                .ToList();

            var rows = entities.Select(SubAgentRunRow.FromEntity).ToList();
            return WorkerResponse.Json(rows);
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbSubAgentTools.ReadSession failed: {ex.GetType().Name}: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ── Index: list all sessions that have sub-agent runs ──

    public static WorkerResponse Index(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var sessions = db.Queryable<SubAgentRunEntity>()
                .GroupBy(e => e.SessionId)
                .Select(e => new
                {
                    SessionId = e.SessionId,
                    Count = SqlFunc.AggregateCount(e.ToolUseId),
                    LatestStartedAt = SqlFunc.AggregateMax(e.StartedAt)
                })
                .OrderBy("LatestStartedAt DESC")
                .ToList();

            var total = db.Queryable<SubAgentRunEntity>().Count();
            return WorkerResponse.Json(new { total, sessions });
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbSubAgentTools.Index failed: {ex.GetType().Name}: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ── Apply: upsert + remove ──

    public static WorkerResponse Apply(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            // Process upserts
            if (parameters.TryGetProperty("upserts", out var upsertsEl) && upsertsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in upsertsEl.EnumerateArray())
                {
                    var entity = ParseSubAgentRecord(item);
                    if (entity is null) continue;

                    var existing = db.Queryable<SubAgentRunEntity>()
                        .First(e => e.ToolUseId == entity.ToolUseId);

                    if (existing is not null)
                    {
                        existing.AgentName = entity.AgentName;
                        existing.Data = entity.Data;
                        existing.StartedAt = entity.StartedAt;
                        existing.CompletedAt = entity.CompletedAt;
                        existing.Success = entity.Success;
                        db.Updateable(existing).ExecuteCommand();
                    }
                    else
                    {
                        db.Insertable(entity).ExecuteCommand();
                    }
                }
            }

            // Process removeIds
            if (parameters.TryGetProperty("removeIds", out var removeIdsEl) && removeIdsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var id in removeIdsEl.EnumerateArray())
                {
                    var idStr = id.GetString();
                    if (!string.IsNullOrEmpty(idStr))
                    {
                        db.Deleteable<SubAgentRunEntity>()
                            .Where(e => e.ToolUseId == idStr)
                            .ExecuteCommand();
                    }
                }
            }

            // Process removeSessionIds
            if (parameters.TryGetProperty("removeSessionIds", out var removeSidsEl) && removeSidsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var sid in removeSidsEl.EnumerateArray())
                {
                    var sidStr = sid.GetString();
                    if (!string.IsNullOrEmpty(sidStr))
                    {
                        db.Deleteable<SubAgentRunEntity>()
                            .Where(e => e.SessionId == sidStr)
                            .ExecuteCommand();
                    }
                }
            }

            return WorkerResponse.Json(new { ok = true });
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbSubAgentTools.Apply failed: {ex.GetType().Name}: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ── Replace: full replacement (used during migration) ──

    public static WorkerResponse Replace(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            // Clear all existing records
            db.DbMaintenance.TruncateTable<SubAgentRunEntity>();

            // Parse snapshot: { subAgentHistory: [...], sessionSubAgentSummaries: { sid: [...] } }
            if (parameters.TryGetProperty("snapshot", out var snapshotEl) && snapshotEl.ValueKind == JsonValueKind.Object)
            {
                // sessionSubAgentSummaries takes priority
                if (snapshotEl.TryGetProperty("sessionSubAgentSummaries", out var summariesEl) && summariesEl.ValueKind == JsonValueKind.Object)
                {
                    foreach (var prop in summariesEl.EnumerateObject())
                    {
                        var sid = prop.Name;
                        if (prop.Value.ValueKind == JsonValueKind.Array)
                        {
                            InsertBatch(db, sid, prop.Value);
                        }
                    }
                }

                // subAgentHistory (dedup by toolUseId, summaries already inserted)
                if (snapshotEl.TryGetProperty("subAgentHistory", out var historyEl) && historyEl.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in historyEl.EnumerateArray())
                    {
                        var entity = ParseSubAgentRecord(item);
                        if (entity is null) continue;

                        // Skip if already inserted from summaries
                        var exists = db.Queryable<SubAgentRunEntity>()
                            .Any(e => e.ToolUseId == entity.ToolUseId);
                        if (!exists)
                        {
                            db.Insertable(entity).ExecuteCommand();
                        }
                    }
                }
            }

            return WorkerResponse.Json(new { ok = true });
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbSubAgentTools.Replace failed: {ex.GetType().Name}: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ── Helpers ──

    private static SubAgentRunEntity? ParseSubAgentRecord(JsonElement item)
    {
        if (item.ValueKind != JsonValueKind.Object) return null;

        var toolUseId = GetString(item, "toolUseId");
        if (string.IsNullOrEmpty(toolUseId)) return null;

        var sessionId = GetString(item, "sessionId") ?? "_unknown";
        var agentName = GetString(item, "name") ?? GetString(item, "displayName") ?? "unknown";
        var startedAt = GetLong(item, "startedAt");
        var completedAt = GetLongOrNull(item, "completedAt");
        var success = GetBoolOrNull(item, "success");

        return new SubAgentRunEntity
        {
            ToolUseId = toolUseId,
            SessionId = sessionId,
            AgentName = agentName,
            Data = item.GetRawText(),
            StartedAt = startedAt,
            CompletedAt = completedAt,
            Success = success
        };
    }

    private static void InsertBatch(SqlSugarScope db, string sessionId, JsonElement array)
    {
        foreach (var item in array.EnumerateArray())
        {
            var entity = ParseSubAgentRecord(item);
            if (entity is null) continue;
            db.Insertable(entity).ExecuteCommand();
        }
    }

    private static string RequireString(JsonElement parameters, string key)
    {
        if (parameters.TryGetProperty(key, out var el) && el.ValueKind == JsonValueKind.String)
            return el.GetString()!;
        throw new ArgumentException($"Missing required parameter: {key}");
    }

    private static string? GetString(JsonElement obj, string key)
    {
        if (obj.TryGetProperty(key, out var el) && el.ValueKind == JsonValueKind.String)
            return el.GetString();
        return null;
    }

    private static long GetLong(JsonElement obj, string key)
    {
        if (obj.TryGetProperty(key, out var el) && el.ValueKind == JsonValueKind.Number)
            return el.GetInt64();
        return 0;
    }

    private static long? GetLongOrNull(JsonElement obj, string key)
    {
        if (obj.TryGetProperty(key, out var el) && el.ValueKind == JsonValueKind.Number)
            return el.GetInt64();
        return null;
    }

    private static int? GetBoolOrNull(JsonElement obj, string key)
    {
        if (obj.TryGetProperty(key, out var el))
        {
            if (el.ValueKind == JsonValueKind.True) return 1;
            if (el.ValueKind == JsonValueKind.False) return 0;
        }
        return null;
    }
}
