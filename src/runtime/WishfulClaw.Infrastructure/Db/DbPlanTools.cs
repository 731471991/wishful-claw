using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Infrastructure.Db;

public static class DbPlanTools
{
    // ─── List ───

    public static WorkerResponse List(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var entities = db.Queryable<PlanEntity>()
                .OrderBy("updated_at DESC")
                .ToList();

            var rows = entities.Select(PlanRow.FromEntity).ToList();
            return WorkerResponse.Json(rows);
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbPlanTools.List failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Get ───

    public static WorkerResponse Get(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var id = parameters.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            if (string.IsNullOrEmpty(id))
                return WorkerResponse.Json(new PlanFindResult(false, null, "id is required"));

            var entity = db.Queryable<PlanEntity>()
                .Where(e => e.Id == id)
                .First();

            var row = entity != null ? PlanRow.FromEntity(entity) : null;
            return WorkerResponse.Json(new PlanFindResult(true, row, null));
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbPlanTools.Get failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── GetBySession ───

    public static WorkerResponse GetBySession(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var sessionId = parameters.TryGetProperty("sessionId", out var sidEl) ? sidEl.GetString() : null;
            if (string.IsNullOrEmpty(sessionId))
                return WorkerResponse.Json(new PlanFindResult(false, null, "sessionId is required"));

            var entity = db.Queryable<PlanEntity>()
                .Where(e => e.SessionId == sessionId)
                .OrderBy("updated_at DESC")
                .First();

            var row = entity != null ? PlanRow.FromEntity(entity) : null;
            return WorkerResponse.Json(new PlanFindResult(true, row, null));
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbPlanTools.GetBySession failed: {ex.Message}");
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

            var entity = ParseCreateParameters(parameters);
            db.Insertable(entity).ExecuteCommand();

            return WorkerResponse.Json(new PlanMutationResult(true, 1, null));
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbPlanTools.Create failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Update ───

    public static WorkerResponse Update(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var id = parameters.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            if (string.IsNullOrEmpty(id))
                return WorkerResponse.Json(new PlanMutationResult(false, 0, "id is required"));

            if (!parameters.TryGetProperty("patch", out var patch) || patch.ValueKind != JsonValueKind.Object)
                return WorkerResponse.Json(new PlanMutationResult(true, 0, null));

            var entity = db.Queryable<PlanEntity>()
                .Where(e => e.Id == id)
                .First();

            if (entity == null)
                return WorkerResponse.Json(new PlanMutationResult(false, 0, "Plan not found"));

            ApplyPatch(entity, patch);
            entity.UpdatedAt = GetLongFromPatch(patch, "updatedAt", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            db.Updateable(entity).ExecuteCommand();

            return WorkerResponse.Json(new PlanMutationResult(true, 1, null));
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbPlanTools.Update failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Delete ───

    public static WorkerResponse Delete(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var id = parameters.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            if (string.IsNullOrEmpty(id))
                return WorkerResponse.Json(new PlanMutationResult(false, 0, "id is required"));

            var changed = db.Deleteable<PlanEntity>()
                .Where(e => e.Id == id)
                .ExecuteCommand();

            return WorkerResponse.Json(new PlanMutationResult(true, changed, null));
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbPlanTools.Delete failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Helpers ───

    private static PlanEntity ParseCreateParameters(JsonElement parameters)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        return new PlanEntity
        {
            Id = GetString(parameters, "id") ?? throw new InvalidOperationException("id is required"),
            SessionId = GetString(parameters, "sessionId") ?? throw new InvalidOperationException("sessionId is required"),
            Title = GetString(parameters, "title") ?? "Plan",
            Status = GetString(parameters, "status") ?? "drafting",
            FilePath = GetString(parameters, "filePath"),
            Content = GetString(parameters, "content"),
            SpecJson = GetString(parameters, "specJson"),
            CreatedAt = GetLong(parameters, "createdAt", now),
            UpdatedAt = GetLong(parameters, "updatedAt", now)
        };
    }

    private static void ApplyPatch(PlanEntity entity, JsonElement patch)
    {
        if (patch.TryGetProperty("title", out var t) && t.ValueKind != JsonValueKind.Null)
            entity.Title = t.GetString()!;
        if (patch.TryGetProperty("status", out var s) && s.ValueKind != JsonValueKind.Null)
            entity.Status = s.GetString()!;
        if (patch.TryGetProperty("filePath", out var fp))
            entity.FilePath = fp.ValueKind == JsonValueKind.Null ? null : fp.GetString();
        if (patch.TryGetProperty("content", out var c))
            entity.Content = c.ValueKind == JsonValueKind.Null ? null : c.GetString();
        if (patch.TryGetProperty("specJson", out var sj))
            entity.SpecJson = sj.ValueKind == JsonValueKind.Null ? null : sj.GetString();
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

    private static long GetLongFromPatch(JsonElement patch, string name, long defaultValue)
    {
        return patch.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.Number
            ? el.GetInt64()
            : defaultValue;
    }
}
