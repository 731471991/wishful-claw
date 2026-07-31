using System.Text.Json;
using SqlSugar;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Infrastructure.Db;

namespace WishfulClaw.Infrastructure.Db;

public static class DbPluginSessionTools
{
    internal const string PlaceholderNewConversation = "New Conversation";
    internal const string PlaceholderNewChat = "New Chat";

    // ── Public IPC handlers ──

    public static WorkerResponse ListNormalProjects(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var entities = db.Queryable<ProjectEntity>()
                .Where(p => p.PluginId == null || p.PluginId == "")
                .OrderBy("pinned DESC")
                .OrderBy("updated_at DESC")
                .ToList();

            var rows = entities.Select(e => new PluginProjectRow
            {
                Id = e.Id,
                Name = e.Name,
                WorkingFolder = e.WorkingFolder,
                SshConnectionId = e.SshConnectionId,
                PluginId = e.PluginId,
                Pinned = e.Pinned,
                CreatedAt = e.CreatedAt,
                UpdatedAt = e.UpdatedAt
            }).ToList();

            return WorkerResponse.Json(rows);
        }
        catch (Exception ex)
        {
            return WorkerResponse.Error(ex.Message);
        }
    }

    public static WorkerResponse SyncPluginSessionModels(JsonElement parameters)
    {
        try
        {
            var pluginId = RequireString(parameters, "pluginId");
            var providerId = NormalizeOptional(JsonHelpers.GetString(parameters, "providerId"));
            var modelId = providerId is null
                ? null
                : NormalizeOptional(JsonHelpers.GetString(parameters, "modelId"));
            var modelSelectionMode = providerId is not null && modelId is not null
                ? "manual"
                : "inherit";

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var changed = db.Updateable<SessionEntity>()
                .SetColumns(s => new SessionEntity
                {
                    ProviderId = providerId,
                    ModelId = modelId,
                    ModelSelectionMode = modelSelectionMode
                })
                .Where(s => s.PluginId == pluginId)
                .ExecuteCommand();

            return Mutation(changed, 0);
        }
        catch (Exception ex)
        {
            return MutationError(ex.Message);
        }
    }

    public static WorkerResponse SyncPluginSessionProject(JsonElement parameters)
    {
        try
        {
            var pluginId = RequireString(parameters, "pluginId");
            var projectId = NormalizeOptional(JsonHelpers.GetString(parameters, "projectId"));

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            string? workingFolder = null;
            string? sshConnectionId = null;
            if (projectId is not null)
            {
                var project = db.Queryable<ProjectEntity>().First(p => p.Id == projectId);
                if (project is not null)
                {
                    workingFolder = EmptyToNull(project.WorkingFolder);
                    sshConnectionId = project.SshConnectionId;
                }
            }

            var changed = db.Updateable<SessionEntity>()
                .SetColumns(s => new SessionEntity
                {
                    ProjectId = projectId,
                    WorkingFolder = workingFolder,
                    SshConnectionId = sshConnectionId
                })
                .Where(s => s.PluginId == pluginId)
                .ExecuteCommand();

            return Mutation(changed, 0);
        }
        catch (Exception ex)
        {
            return MutationError(ex.Message);
        }
    }

    public static WorkerResponse RemovePluginData(JsonElement parameters)
    {
        try
        {
            var pluginId = RequireString(parameters, "pluginId");

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            // Get session IDs for this plugin
            var sessionIds = db.Queryable<SessionEntity>()
                .Where(s => s.PluginId == pluginId)
                .Select(s => s.Id)
                .ToList();

            var deletedMessages = 0;
            if (sessionIds.Count > 0)
            {
                deletedMessages = db.Deleteable<MessageEntity>()
                    .Where(m => sessionIds.Contains(m.SessionId))
                    .ExecuteCommand();
            }

            var deletedSessions = db.Deleteable<SessionEntity>()
                .Where(s => s.PluginId == pluginId)
                .ExecuteCommand();

            var deletedProjects = db.Deleteable<ProjectEntity>()
                .Where(p => p.PluginId == pluginId)
                .ExecuteCommand();

            return Mutation(deletedSessions + deletedProjects, deletedMessages);
        }
        catch (Exception ex)
        {
            return MutationError(ex.Message);
        }
    }

    public static WorkerResponse ListPluginSessions(JsonElement parameters)
    {
        try
        {
            var pluginId = RequireString(parameters, "pluginId");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var entities = db.Queryable<SessionEntity>()
                .Where(s => s.PluginId == pluginId)
                .OrderBy("updated_at DESC")
                .ToList();

            var rows = entities.Select(SessionToPluginRow).ToList();
            return WorkerResponse.Json(rows);
        }
        catch (Exception ex)
        {
            return WorkerResponse.Error(ex.Message);
        }
    }

    public static WorkerResponse CreatePluginSession(JsonElement parameters)
    {
        try
        {
            var pluginId = RequireString(parameters, "pluginId");
            var sessionId = NormalizeOptional(JsonHelpers.GetString(parameters, "id")) ?? CreateSessionId();
            var title = RequireString(parameters, "title");
            var mode = NormalizeOptional(JsonHelpers.GetString(parameters, "mode")) ?? "cowork";
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var createdAt = JsonHelpers.GetLong(parameters, "createdAt", now);
            var updatedAt = JsonHelpers.GetLong(parameters, "updatedAt", createdAt);
            var externalChatId = NormalizeOptional(JsonHelpers.GetString(parameters, "externalChatId"));
            var projectId = NormalizeOptional(JsonHelpers.GetString(parameters, "projectId"));
            var providerId = NormalizeOptional(JsonHelpers.GetString(parameters, "providerId"));
            var modelId = providerId is null
                ? null
                : NormalizeOptional(JsonHelpers.GetString(parameters, "modelId"));
            var modelSelectionMode = providerId is not null && modelId is not null
                ? "manual"
                : "inherit";

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            // Resolve project defaults
            string? workingFolder = null;
            string? sshConnectionId = null;
            if (projectId is not null)
            {
                var project = db.Queryable<ProjectEntity>().First(p => p.Id == projectId);
                if (project is not null)
                {
                    workingFolder = EmptyToNull(project.WorkingFolder);
                    sshConnectionId = project.SshConnectionId;
                }
            }

            var entity = new SessionEntity
            {
                Id = sessionId,
                Title = title,
                Mode = mode,
                CreatedAt = createdAt,
                UpdatedAt = updatedAt,
                ProjectId = projectId,
                WorkingFolder = workingFolder,
                SshConnectionId = sshConnectionId,
                Pinned = 0,
                PluginId = pluginId,
                ExternalChatId = externalChatId,
                ProviderId = providerId,
                ModelId = modelId,
                ModelSelectionMode = modelSelectionMode
            };

            db.Insertable(entity).ExecuteCommand();
            return Mutation(1, 0);
        }
        catch (Exception ex)
        {
            return MutationError(ex.Message);
        }
    }

    public static WorkerResponse FindPluginSessionByChat(JsonElement parameters)
    {
        try
        {
            var externalChatId = RequireString(parameters, "externalChatId");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var entity = db.Queryable<SessionEntity>()
                .Where(s => s.ExternalChatId == externalChatId)
                .First();

            var row = entity is null ? null : SessionToPluginRow(entity);
            return WorkerResponse.Json(new PluginSessionFindResult(true, row, null));
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(new PluginSessionFindResult(false, null, ex.Message));
        }
    }

    public static WorkerResponse ListAllPluginSessions(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var entities = db.Queryable<SessionEntity>()
                .Where(s => s.PluginId != null && s.PluginId != "")
                .OrderBy("updated_at DESC")
                .ToList();

            var rows = entities.Select(SessionToPluginRow).ToList();
            return WorkerResponse.Json(rows);
        }
        catch (Exception ex)
        {
            return WorkerResponse.Error(ex.Message);
        }
    }

    public static WorkerResponse ListPluginSessionMessages(JsonElement parameters)
    {
        try
        {
            var sessionId = RequireString(parameters, "sessionId");
            var limit = Math.Clamp(JsonHelpers.GetInt(parameters, "limit", 50), 1, 500);
            var offset = Math.Max(0, JsonHelpers.GetInt(parameters, "offset", 0));

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var entities = db.Queryable<MessageEntity>()
                .Where(m => m.SessionId == sessionId)
                .OrderBy("sort_order ASC")
                .Take(limit)
                .Skip(offset)
                .ToList();

            var rows = entities.Select(m => new PluginSessionMessageRow
            {
                Id = m.Id,
                Role = m.Role,
                Content = m.Content,
                CreatedAt = m.CreatedAt
            }).ToList();

            return WorkerResponse.Json(rows);
        }
        catch (Exception ex)
        {
            return WorkerResponse.Error(ex.Message);
        }
    }

    public static WorkerResponse ClearPluginSession(JsonElement parameters)
    {
        try
        {
            var sessionId = RequireString(parameters, "sessionId");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var deleted = db.Deleteable<MessageEntity>()
                .Where(m => m.SessionId == sessionId)
                .ExecuteCommand();

            db.Updateable<SessionEntity>()
                .SetColumns(s => new SessionEntity { MessageCount = 0 })
                .Where(s => s.Id == sessionId)
                .ExecuteCommand();

            return Mutation(0, deleted);
        }
        catch (Exception ex)
        {
            return MutationError(ex.Message);
        }
    }

    public static WorkerResponse DeletePluginSession(JsonElement parameters)
    {
        try
        {
            var sessionId = RequireString(parameters, "sessionId");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var deletedMessages = db.Deleteable<MessageEntity>()
                .Where(m => m.SessionId == sessionId)
                .ExecuteCommand();

            var deletedSessions = db.Deleteable<SessionEntity>()
                .Where(s => s.Id == sessionId)
                .ExecuteCommand();

            return Mutation(deletedSessions, deletedMessages);
        }
        catch (Exception ex)
        {
            return MutationError(ex.Message);
        }
    }

    public static WorkerResponse RenamePluginSession(JsonElement parameters)
    {
        try
        {
            var sessionId = RequireString(parameters, "sessionId");
            var title = RequireString(parameters, "title");
            var updatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var changed = db.Updateable<SessionEntity>()
                .SetColumns(s => new SessionEntity { Title = title, UpdatedAt = updatedAt })
                .Where(s => s.Id == sessionId)
                .ExecuteCommand();

            return Mutation(changed, 0);
        }
        catch (Exception ex)
        {
            return MutationError(ex.Message);
        }
    }


    // NOTE: RoutePluginSession and auto-reply helpers are in DbPluginSessionRouting.cs

    // ── Private helpers ──

    public static PluginSessionRow SessionToPluginRow(SessionEntity e) => new()
    {
        Id = e.Id,
        Title = e.Title,
        Icon = e.Icon,
        Mode = e.Mode,
        CreatedAt = e.CreatedAt,
        UpdatedAt = e.UpdatedAt,
        ProjectId = e.ProjectId,
        WorkingFolder = e.WorkingFolder,
        SshConnectionId = e.SshConnectionId,
        PlanId = e.PlanId,
        Pinned = e.Pinned,
        PluginId = e.PluginId,
        ExternalChatId = e.ExternalChatId,
        ProviderId = e.ProviderId,
        ModelId = e.ModelId,
        ModelSelectionMode = e.ModelSelectionMode,
        MessageCount = e.MessageCount
    };

    public static WorkerResponse Mutation(int changed, int deleted)
    {
        return WorkerResponse.Json(new PluginSessionMutationResult(true, changed, deleted, null));
    }

    public static WorkerResponse MutationError(string error)
    {
        return WorkerResponse.Json(new PluginSessionMutationResult(false, 0, 0, error));
    }

    public static string RequireString(JsonElement parameters, string name)
    {
        return JsonHelpers.GetString(parameters, name) is { Length: > 0 } value
            ? value
            : throw new InvalidOperationException($"Missing required plugin session field: {name}");
    }

    public static string BuildPluginMessageSessionKey(string pluginId, string chatId)
    {
        return $"plugin:{pluginId}:chat:{EncodeSessionKeyPart(chatId)}";
    }

    public static string CreateSessionId()
    {
        return $"wc_{Guid.NewGuid():N}";
    }

    public static string EncodeSessionKeyPart(string value)
    {
        return Uri.EscapeDataString(value)
            .Replace("%21", "!", StringComparison.OrdinalIgnoreCase)
            .Replace("%27", "'", StringComparison.OrdinalIgnoreCase)
            .Replace("%28", "(", StringComparison.OrdinalIgnoreCase)
            .Replace("%29", ")", StringComparison.OrdinalIgnoreCase)
            .Replace("%2A", "*", StringComparison.OrdinalIgnoreCase);
    }

    public static bool ShouldReplaceSessionTitle(string? currentTitle, string? nextTitle)
    {
        var current = NormalizeOptional(currentTitle);
        var next = NormalizeOptional(nextTitle);
        if (next is null || string.Equals(current, next, StringComparison.Ordinal))
        {
            return false;
        }

        return current is null ||
            current == PlaceholderNewConversation ||
            current == PlaceholderNewChat ||
            current.StartsWith("wc_", StringComparison.OrdinalIgnoreCase) ||
            current.StartsWith("oc_", StringComparison.OrdinalIgnoreCase) ||
            current.StartsWith("Plugin ", StringComparison.OrdinalIgnoreCase);
    }

    public static string? FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (NormalizeOptional(value) is { } normalized)
            {
                return normalized;
            }
        }
        return null;
    }

    public static string? NormalizeOptional(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    public static string? EmptyToNull(string? value)
    {
        return string.IsNullOrEmpty(value) ? null : value;
    }
}
