using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Infrastructure.Db;

public static class DbGoalTools
{
    // ─── List ───

    public static WorkerResponse List(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var entities = db.Queryable<GoalEntity>()
                .OrderBy("updated_at DESC")
                .ToList();

            var rows = entities.Select(GoalRow.FromEntity).ToList();
            return WorkerResponse.Json(rows);
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbGoalTools.List failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Get (by sessionId) ───

    public static WorkerResponse Get(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var sessionId = parameters.TryGetProperty("sessionId", out var sidEl) ? sidEl.GetString() : null;
            if (string.IsNullOrEmpty(sessionId))
                return WorkerResponse.Json(new GoalFindResult(false, null, "sessionId is required"));

            var entity = db.Queryable<GoalEntity>()
                .Where(e => e.SessionId == sessionId)
                .OrderBy("updated_at DESC")
                .First();

            var row = entity != null ? GoalRow.FromEntity(entity) : null;
            return WorkerResponse.Json(row ?? (object)new GoalFindResult(false, null, null));
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbGoalTools.Get failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Create ───

    public static WorkerResponse Create(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var goalId = GetString(parameters, "goalId") ?? Guid.NewGuid().ToString("N");
            var sessionId = GetString(parameters, "sessionId") ?? throw new InvalidOperationException("sessionId is required");
            var objective = GetString(parameters, "objective") ?? throw new InvalidOperationException("objective is required");

            var entity = new GoalEntity
            {
                GoalId = goalId,
                SessionId = sessionId,
                Objective = objective,
                Status = GetString(parameters, "status") ?? "active",
                TokenBudget = GetLongOrNull(parameters, "tokenBudget"),
                TokensUsed = 0,
                TimeUsedSeconds = 0,
                PlansJson = GetString(parameters, "plansJson"),
                PlanCount = GetInt(parameters, "planCount", 0),
                CompletedPlanCount = GetInt(parameters, "completedPlanCount", 0),
                CurrentPlanIndex = GetInt(parameters, "currentPlanIndex", -1),
                WorkingFolder = GetString(parameters, "workingFolder"),
                CreatedAt = now,
                UpdatedAt = now
            };

            db.Insertable(entity).ExecuteCommand();

            // Record event
            InsertEvent(db, sessionId, goalId, "created", "Goal created", null, now);

            var row = GoalRow.FromEntity(entity);
            return WorkerResponse.Json(row);
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbGoalTools.Create failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Set (upsert: replace existing or create) ───

    public static WorkerResponse Set(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var sessionId = GetString(parameters, "sessionId") ?? throw new InvalidOperationException("sessionId is required");
            var objective = GetString(parameters, "objective") ?? throw new InvalidOperationException("objective is required");
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            // Delete existing goal for this session
            db.Deleteable<GoalEntity>().Where(e => e.SessionId == sessionId).ExecuteCommand();

            var goalId = GetString(parameters, "goalId") ?? Guid.NewGuid().ToString("N");
            var entity = new GoalEntity
            {
                GoalId = goalId,
                SessionId = sessionId,
                Objective = objective,
                Status = GetString(parameters, "status") ?? "active",
                TokenBudget = GetLongOrNull(parameters, "tokenBudget"),
                TokensUsed = 0,
                TimeUsedSeconds = 0,
                WorkingFolder = GetString(parameters, "workingFolder"),
                CreatedAt = now,
                UpdatedAt = now
            };

            db.Insertable(entity).ExecuteCommand();
            InsertEvent(db, sessionId, goalId, "replaced", "Goal replaced", null, now);

            var row = GoalRow.FromEntity(entity);
            return WorkerResponse.Json(row);
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbGoalTools.Set failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Update (patch fields) ───

    public static WorkerResponse Update(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var sessionId = GetString(parameters, "sessionId") ?? throw new InvalidOperationException("sessionId is required");
            var entity = db.Queryable<GoalEntity>()
                .Where(e => e.SessionId == sessionId)
                .OrderBy("updated_at DESC")
                .First();

            if (entity == null)
                return WorkerResponse.Json(new GoalMutationResult(false, 0, "Goal not found"));

            if (parameters.TryGetProperty("patch", out var patch) && patch.ValueKind == JsonValueKind.Object)
            {
                if (patch.TryGetProperty("objective", out var obj) && obj.ValueKind != JsonValueKind.Null)
                    entity.Objective = obj.GetString()!;
                if (patch.TryGetProperty("status", out var st) && st.ValueKind != JsonValueKind.Null)
                {
                    var newStatus = st.GetString()!;
                    if (entity.Status != newStatus)
                    {
                        InsertEvent(db, sessionId, entity.GoalId, "status_changed",
                            $"Status changed: {entity.Status} → {newStatus}", null, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
                    }
                    entity.Status = newStatus;
                }
                if (patch.TryGetProperty("tokenBudget", out var tb))
                    entity.TokenBudget = tb.ValueKind == JsonValueKind.Null ? null : tb.GetInt64();
                if (patch.TryGetProperty("plansJson", out var pj))
                    entity.PlansJson = pj.ValueKind == JsonValueKind.Null ? null : pj.GetRawText();
                if (patch.TryGetProperty("planCount", out var pc) && pc.ValueKind == JsonValueKind.Number)
                    entity.PlanCount = pc.GetInt32();
                if (patch.TryGetProperty("completedPlanCount", out var cpc) && cpc.ValueKind == JsonValueKind.Number)
                    entity.CompletedPlanCount = cpc.GetInt32();
                if (patch.TryGetProperty("currentPlanIndex", out var cpi) && cpi.ValueKind == JsonValueKind.Number)
                    entity.CurrentPlanIndex = cpi.GetInt32();
                if (patch.TryGetProperty("workingFolder", out var wf))
                    entity.WorkingFolder = wf.ValueKind == JsonValueKind.Null ? null : wf.GetString();
            }

            entity.UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            db.Updateable(entity).ExecuteCommand();

            var row = GoalRow.FromEntity(entity);
            return WorkerResponse.Json(row);
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbGoalTools.Update failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Clear (delete goal + events for session) ───

    public static WorkerResponse Clear(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var sessionId = GetString(parameters, "sessionId") ?? throw new InvalidOperationException("sessionId is required");
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            var entity = db.Queryable<GoalEntity>()
                .Where(e => e.SessionId == sessionId)
                .First();

            if (entity != null)
            {
                InsertEvent(db, sessionId, entity.GoalId, "cleared", "Goal cleared", null, now);
            }

            var changed = db.Deleteable<GoalEntity>().Where(e => e.SessionId == sessionId).ExecuteCommand();

            return WorkerResponse.Json(new { success = true, cleared = changed > 0 });
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbGoalTools.Clear failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Account Usage (tokens + time) ───

    public static WorkerResponse AccountUsage(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var sessionId = GetString(parameters, "sessionId") ?? throw new InvalidOperationException("sessionId is required");
            var tokenDelta = GetLong(parameters, "tokenDelta", 0);
            var timeDeltaSeconds = GetLong(parameters, "timeDeltaSeconds", 0);

            var entity = db.Queryable<GoalEntity>()
                .Where(e => e.SessionId == sessionId)
                .OrderBy("updated_at DESC")
                .First();

            if (entity == null)
                return WorkerResponse.Json(new GoalMutationResult(false, 0, "Goal not found"));

            entity.TokensUsed += tokenDelta;
            entity.TimeUsedSeconds += timeDeltaSeconds;
            entity.UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            db.Updateable(entity).ExecuteCommand();

            InsertEvent(db, sessionId, entity.GoalId, "usage_accounted",
                $"Usage: +{tokenDelta} tokens, +{timeDeltaSeconds}s", null, entity.UpdatedAt);

            var row = GoalRow.FromEntity(entity);
            return WorkerResponse.Json(row);
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbGoalTools.AccountUsage failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── List Active ───

    public static WorkerResponse ListActive(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var entities = db.Queryable<GoalEntity>()
                .Where(e => e.Status == "active" || e.Status == "paused")
                .OrderBy("updated_at DESC")
                .ToList();

            var rows = entities.Select(GoalRow.FromEntity).ToList();
            return WorkerResponse.Json(rows);
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbGoalTools.ListActive failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Goal Events: List ───

    public static WorkerResponse ListEvents(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var sessionId = GetString(parameters, "sessionId") ?? throw new InvalidOperationException("sessionId is required");
            var limit = GetInt(parameters, "limit", 40);

            var query = db.Queryable<GoalEventEntity>()
                .Where(e => e.SessionId == sessionId);

            var goalId = GetString(parameters, "goalId");
            if (!string.IsNullOrEmpty(goalId))
                query = query.Where(e => e.GoalId == goalId);

            var entities = query.OrderBy("created_at DESC")
                .Take(limit)
                .ToList();

            var rows = entities.Select(GoalEventRow.FromEntity).ToList();
            return WorkerResponse.Json(rows);
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbGoalTools.ListEvents failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Goal Events: Add ───

    public static WorkerResponse AddEvent(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var sessionId = GetString(parameters, "sessionId") ?? throw new InvalidOperationException("sessionId is required");
            var eventType = GetString(parameters, "eventType") ?? "created";
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            var entity = new GoalEventEntity
            {
                SessionId = sessionId,
                GoalId = GetString(parameters, "goalId"),
                EventType = eventType,
                Message = GetString(parameters, "message"),
                MetadataJson = GetString(parameters, "metadataJson"),
                CreatedAt = now
            };

            db.Insertable(entity).ExecuteCommand();

            var row = GoalEventRow.FromEntity(entity);
            return WorkerResponse.Json(row);
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbGoalTools.AddEvent failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Helpers ───

    private static void InsertEvent(SqlSugar.ISqlSugarClient db, string sessionId, string goalId, string eventType, string? message, string? metadataJson, long createdAt)
    {
        db.Insertable(new GoalEventEntity
        {
            SessionId = sessionId,
            GoalId = goalId,
            EventType = eventType,
            Message = message,
            MetadataJson = metadataJson,
            CreatedAt = createdAt
        }).ExecuteCommand();
    }

    private static string? GetString(JsonElement element, string name)
    {
        return element.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.String
            ? el.GetString()
            : null;
    }

    private static long GetLong(JsonElement element, string name, long defaultValue)
    {
        return element.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.Number
            ? el.GetInt64()
            : defaultValue;
    }

    private static long? GetLongOrNull(JsonElement element, string name)
    {
        return element.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.Number
            ? el.GetInt64()
            : null;
    }

    private static int GetInt(JsonElement element, string name, int defaultValue)
    {
        return element.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.Number
            ? el.GetInt32()
            : defaultValue;
    }
}
