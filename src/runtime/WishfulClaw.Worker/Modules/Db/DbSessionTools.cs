using System.Text.Json;
using SqlSugar;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.Modules.Db;

internal static class DbSessionTools
{
    public static WorkerResponse List(JsonElement parameters)
    {
        try
        {
            var limit = Math.Clamp(JsonHelpers.GetInt(parameters, "limit", 2000), 1, 10_000);
            var offset = Math.Max(0, JsonHelpers.GetInt(parameters, "offset", 0));
            var hasProjectFilter = parameters.TryGetProperty("projectId", out var projectIdValue);
            var projectId = hasProjectFilter && projectIdValue.ValueKind != JsonValueKind.Null
                ? JsonHelpers.GetString(parameters, "projectId")
                : null;

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var query = db.Queryable<SessionEntity>().OrderBy("updated_at DESC");

            if (hasProjectFilter)
            {
                if (projectId is null)
                    query = query.Where(s => s.ProjectId == null);
                else
                    query = query.Where(s => s.ProjectId == projectId);
            }

            var entities = query
                .Take(limit)
                .Skip(offset)
                .ToList();

            var rows = entities.Select(SessionRow.FromEntity).ToList();
            return WorkerResponse.Json(rows);
        }
        catch (Exception ex)
        {
            return WorkerResponse.Error(ex.Message);
        }
    }

    public static WorkerResponse Get(JsonElement parameters)
    {
        try
        {
            var id = RequireString(parameters, "id");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var entity = db.Queryable<SessionEntity>().First(s => s.Id == id);
            return WorkerResponse.Json(new SessionFindResult(true, entity is null ? null : SessionRow.FromEntity(entity), null));
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(new SessionFindResult(false, null, ex.Message));
        }
    }

    public static WorkerResponse Create(JsonElement parameters)
    {
        try
        {
            var input = ReadSessionInput(parameters);
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            ApplyProjectDefaults(db, input);

            db.Insertable(input).ExecuteCommand();
            return Mutation(1);
        }
        catch (Exception ex)
        {
            return MutationError(ex.Message);
        }
    }

    public static WorkerResponse Update(JsonElement parameters)
    {
        try
        {
            var id = RequireString(parameters, "id");
            if (!parameters.TryGetProperty("patch", out var patch) || patch.ValueKind != JsonValueKind.Object)
            {
                return Mutation(0);
            }

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var current = db.Queryable<SessionEntity>().First(s => s.Id == id);
            if (current is null)
            {
                return Mutation(0);
            }

            ApplySessionPatch(patch, current);
            var changed = db.Updateable(current).ExecuteCommand();
            return Mutation(changed);
        }
        catch (Exception ex)
        {
            return MutationError(ex.Message);
        }
    }

    public static WorkerResponse Delete(JsonElement parameters)
    {
        try
        {
            var id = RequireString(parameters, "id");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            db.Deleteable<MessageEntity>().Where(m => m.SessionId == id).ExecuteCommand();
            var changed = db.Deleteable<SessionEntity>().Where(s => s.Id == id).ExecuteCommand();
            return Mutation(changed);
        }
        catch (Exception ex)
        {
            return MutationError(ex.Message);
        }
    }

    public static WorkerResponse ClearAll(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var sessionIds = db.Queryable<SessionEntity>()
                .Where(s => s.PluginId == null)
                .Select(s => s.Id)
                .ToList();

            if (sessionIds.Count > 0)
            {
                db.Deleteable<MessageEntity>()
                    .Where(m => sessionIds.Contains(m.SessionId))
                    .ExecuteCommand();
            }

            var deletedSessions = db.Deleteable<SessionEntity>()
                .Where(s => s.PluginId == null)
                .ExecuteCommand();

            return WorkerResponse.Json(
                new SessionClearAllResult(true, sessionIds, sessionIds.Count, deletedSessions, null));
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(
                new SessionClearAllResult(false, new List<string>(), 0, 0, ex.Message));
        }
    }

    // ─── Private helpers ───

    private static SessionEntity ReadSessionInput(JsonElement parameters)
    {
        var providerId = DbProjectTools.NormalizeOptional(JsonHelpers.GetString(parameters, "providerId"));
        var modelId = DbProjectTools.NormalizeOptional(JsonHelpers.GetString(parameters, "modelId"));
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        return new SessionEntity
        {
            Id = RequireString(parameters, "id"),
            Title = RequireString(parameters, "title"),
            Icon = DbProjectTools.NormalizeOptional(JsonHelpers.GetString(parameters, "icon")),
            Mode = DbProjectTools.NormalizeOptional(JsonHelpers.GetString(parameters, "mode")) ?? "chat",
            CreatedAt = JsonHelpers.GetLong(parameters, "createdAt", now),
            UpdatedAt = JsonHelpers.GetLong(parameters, "updatedAt", now),
            MessageCount = 0,
            ProjectId = DbProjectTools.NormalizeOptional(JsonHelpers.GetString(parameters, "projectId")),
            WorkingFolder = DbProjectTools.NormalizeOptional(JsonHelpers.GetString(parameters, "workingFolder")),
            SshConnectionId = DbProjectTools.NormalizeOptional(JsonHelpers.GetString(parameters, "sshConnectionId")),
            PlanId = DbProjectTools.NormalizeOptional(JsonHelpers.GetString(parameters, "planId")),
            Pinned = JsonHelpers.GetBool(parameters, "pinned", false) ? 1 : 0,
            PluginId = DbProjectTools.NormalizeOptional(JsonHelpers.GetString(parameters, "pluginId")),
            ProviderId = providerId,
            ModelId = modelId,
            ModelSelectionMode = DbProjectTools.NormalizeOptional(JsonHelpers.GetString(parameters, "modelSelectionMode")) ??
                (providerId is not null && modelId is not null ? "manual" : "inherit")
        };
    }

    private static void ApplyProjectDefaults(ISqlSugarClient db, SessionEntity input)
    {
        if (input.ProjectId is null ||
            (input.WorkingFolder is not null && input.SshConnectionId is not null))
        {
            return;
        }

        var project = db.Queryable<ProjectEntity>().First(p => p.Id == input.ProjectId);
        if (project is null) return;

        input.WorkingFolder ??= project.WorkingFolder;
        input.SshConnectionId ??= project.SshConnectionId;
    }

    private static void ApplySessionPatch(JsonElement patch, SessionEntity row)
    {
        TryPatchString(patch, "title", v => row.Title = v);
        TryPatchString(patch, "icon", v => row.Icon = v);
        TryPatchString(patch, "mode", v => row.Mode = v);

        if (JsonHelpers.GetLongNullable(patch, "updatedAt") is { } updatedAt)
        {
            row.UpdatedAt = updatedAt;
        }
        else
        {
            row.UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }

        TryPatchNullableString(patch, "projectId", v => row.ProjectId = v);
        TryPatchNullableString(patch, "workingFolder", v => row.WorkingFolder = v);
        TryPatchNullableString(patch, "sshConnectionId", v => row.SshConnectionId = v);
        TryPatchNullableString(patch, "planId", v => row.PlanId = v);
        TryPatchNullableString(patch, "pluginId", v => row.PluginId = v);
        TryPatchNullableString(patch, "providerId", v => row.ProviderId = v);
        TryPatchNullableString(patch, "modelId", v => row.ModelId = v);
        TryPatchNullableString(patch, "modelSelectionMode", v => row.ModelSelectionMode = v ?? "inherit");

        if (patch.TryGetProperty("pinned", out var pinnedEl))
        {
            row.Pinned = pinnedEl.ValueKind switch
            {
                JsonValueKind.True => 1,
                JsonValueKind.False => 0,
                JsonValueKind.Number when pinnedEl.TryGetInt32(out var v) => v == 0 ? 0 : 1,
                _ => row.Pinned
            };
        }
    }

    private static void TryPatchString(JsonElement patch, string name, Action<string> setter)
    {
        if (patch.TryGetProperty(name, out var el) && el.ValueKind == JsonValueKind.String)
        {
            var v = el.GetString();
            if (!string.IsNullOrEmpty(v)) setter(v);
        }
    }

    private static void TryPatchNullableString(JsonElement patch, string name, Action<string?> setter)
    {
        if (patch.TryGetProperty(name, out var el))
        {
            setter(el.ValueKind == JsonValueKind.String
                ? DbProjectTools.NormalizeOptional(el.GetString())
                : null);
        }
    }

    private static string RequireString(JsonElement parameters, string name)
    {
        return JsonHelpers.GetString(parameters, name) is { Length: > 0 } value
            ? value
            : throw new InvalidOperationException($"Missing required field: {name}");
    }

    private static WorkerResponse Mutation(int changed)
    {
        return WorkerResponse.Json(new SessionMutationResult(true, changed, null));
    }

    private static WorkerResponse MutationError(string error)
    {
        return WorkerResponse.Json(new SessionMutationResult(false, 0, error));
    }
}
