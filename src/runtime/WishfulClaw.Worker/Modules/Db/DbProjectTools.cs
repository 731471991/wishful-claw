using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.Modules.Db;

internal static class DbProjectTools
{
    public static WorkerResponse List(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var entities = db.Queryable<ProjectEntity>()
                .OrderBy("pinned DESC")
                .OrderBy("updated_at DESC")
                .ToList();

            var rows = entities.Select(e =>
            {
                var count = db.Queryable<SessionEntity>()
                    .Where(s => s.ProjectId == e.Id)
                    .Count();
                return ProjectRow.FromEntity(e, count);
            }).ToList();

            return WorkerResponse.Json(rows);
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbProjectTools.List failed: {ex.GetType().Name}: {ex.Message} | StackTrace: {ex.StackTrace}");
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

            var entity = db.Queryable<ProjectEntity>().First(p => p.Id == id);
            return WorkerResponse.Json(new ProjectFindResult(true, entity is null ? null : ProjectRow.FromEntity(entity), null));
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(new ProjectFindResult(false, null, ex.Message));
        }
    }

    public static WorkerResponse Create(JsonElement parameters)
    {
        try
        {
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var id = NormalizeOptional(JsonHelpers.GetString(parameters, "id")) ?? CreateId();
            var name = SanitizeProjectName(RequireString(parameters, "name"));
            var sshConnectionId = NormalizeOptional(JsonHelpers.GetString(parameters, "sshConnectionId"));
            var workingFolder = NormalizeOptional(JsonHelpers.GetString(parameters, "workingFolder"));
            var pluginId = NormalizeOptional(JsonHelpers.GetString(parameters, "pluginId"));
            var pinned = JsonHelpers.GetBool(parameters, "pinned", false) ? 1 : 0;
            var createdAt = JsonHelpers.GetLong(parameters, "createdAt", now);
            var updatedAt = JsonHelpers.GetLong(parameters, "updatedAt", now);

            if (workingFolder is not null && sshConnectionId is null)
            {
                Directory.CreateDirectory(workingFolder);
            }

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var entity = new ProjectEntity
            {
                Id = id,
                Name = name,
                WorkingFolder = workingFolder,
                SshConnectionId = sshConnectionId,
                PluginId = pluginId,
                Pinned = pinned,
                CreatedAt = createdAt,
                UpdatedAt = updatedAt
            };

            db.Insertable(entity).ExecuteCommand();

            return WorkerResponse.Json(ProjectRow.FromEntity(entity));
        }
        catch (Exception ex)
        {
            return WorkerResponse.Error(ex.Message);
        }
    }

    public static WorkerResponse Update(JsonElement parameters)
    {
        try
        {
            var id = RequireString(parameters, "id");
            if (!parameters.TryGetProperty("patch", out var patch) || patch.ValueKind != JsonValueKind.Object)
            {
                return WorkerResponse.Json(new ProjectFindResult(true, null, null));
            }

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var current = db.Queryable<ProjectEntity>().First(p => p.Id == id);
            if (current is null)
            {
                return WorkerResponse.Json(new ProjectFindResult(true, null, null));
            }

            ApplyProjectPatch(patch, current);
            db.Updateable(current).ExecuteCommand();

            return WorkerResponse.Json(new ProjectFindResult(true, ProjectRow.FromEntity(current), null));
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(new ProjectFindResult(false, null, ex.Message));
        }
    }

    public static WorkerResponse Delete(JsonElement parameters)
    {
        try
        {
            var id = RequireString(parameters, "id");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var project = db.Queryable<ProjectEntity>().First(p => p.Id == id);
            if (project is null)
            {
                return WorkerResponse.Json(new ProjectDeleteResult(true, false, null, new List<string>(), null));
            }

            var sessionIds = db.Queryable<SessionEntity>()
                .Where(s => s.ProjectId == id)
                .Select(s => s.Id)
                .ToList();

            // Delete messages for all sessions in this project
            if (sessionIds.Count > 0)
            {
                db.Deleteable<MessageEntity>()
                    .Where(m => sessionIds.Contains(m.SessionId))
                    .ExecuteCommand();
            }

            db.Deleteable<SessionEntity>().Where(s => s.ProjectId == id).ExecuteCommand();
            db.Deleteable<ProjectEntity>().Where(p => p.Id == id).ExecuteCommand();

            return WorkerResponse.Json(new ProjectDeleteResult(true, true, id, sessionIds, null));
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(new ProjectDeleteResult(false, false, null, new List<string>(), ex.Message));
        }
    }

    public static WorkerResponse EnsureDefault(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var existing = db.Queryable<ProjectEntity>()
                .Where(p => p.PluginId == null)
                .OrderBy("pinned DESC")
                .OrderBy("updated_at DESC")
                .First();

            if (existing is not null)
            {
                return WorkerResponse.Json(ProjectRow.FromEntity(existing));
            }

            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var entity = new ProjectEntity
            {
                Id = CreateId(),
                Name = "Default Project",
                CreatedAt = now,
                UpdatedAt = now
            };
            db.Insertable(entity).ExecuteCommand();

            return WorkerResponse.Json(ProjectRow.FromEntity(entity));
        }
        catch (Exception ex)
        {
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Private helpers ───

    private static void ApplyProjectPatch(JsonElement patch, ProjectEntity row)
    {
        if (patch.TryGetProperty("name", out var nameEl) && nameEl.ValueKind == JsonValueKind.String)
        {
            row.Name = SanitizeProjectName(nameEl.GetString() ?? string.Empty);
        }

        if (patch.TryGetProperty("sshConnectionId", out var sshEl))
        {
            row.SshConnectionId = sshEl.ValueKind == JsonValueKind.String
                ? NormalizeOptional(sshEl.GetString())
                : null;
        }

        if (patch.TryGetProperty("workingFolder", out var folderEl))
        {
            row.WorkingFolder = folderEl.ValueKind == JsonValueKind.String
                ? NormalizeOptional(folderEl.GetString())
                : null;
            if (row.WorkingFolder is not null && row.SshConnectionId is null)
            {
                Directory.CreateDirectory(row.WorkingFolder);
            }
        }

        if (patch.TryGetProperty("pluginId", out var pluginEl))
        {
            row.PluginId = pluginEl.ValueKind == JsonValueKind.String
                ? NormalizeOptional(pluginEl.GetString())
                : null;
        }

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

        if (JsonHelpers.GetLongNullable(patch, "updatedAt") is { } updatedAt)
        {
            row.UpdatedAt = updatedAt;
        }
        else
        {
            row.UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }
    }

    private static string SanitizeProjectName(string rawName)
    {
        var replaced = new string(rawName
            .Select(c => c is '<' or '>' or ':' or '"' or '/' or '\\' or '|' or '?' or '*'
                ? ' '
                : c)
            .ToArray());
        var cleaned = string.Join(' ', replaced.Split(
            ' ',
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
        return cleaned.Length == 0 ? "New Project" : cleaned;
    }

    private static string CreateId()
    {
        return $"wc_{Guid.NewGuid():N}";
    }

    internal static string RequireString(JsonElement parameters, string name)
    {
        return JsonHelpers.GetString(parameters, name) is { Length: > 0 } value
            ? value
            : throw new InvalidOperationException($"Missing required field: {name}");
    }

    internal static string? NormalizeOptional(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
}
