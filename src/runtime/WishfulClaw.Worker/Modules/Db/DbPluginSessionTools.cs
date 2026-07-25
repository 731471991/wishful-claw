using System.Text.Json;
using SqlSugar;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.Modules.Db;

internal static class DbPluginSessionTools
{
    private const string PlaceholderNewConversation = "New Conversation";
    private const string PlaceholderNewChat = "New Chat";

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

    public static WorkerResponse RoutePluginSession(JsonElement parameters)
    {
        try
        {
            var pluginId = RequireString(parameters, "pluginId");
            var chatId = RequireString(parameters, "chatId");
            var chatName = NormalizeOptional(JsonHelpers.GetString(parameters, "chatName"));
            var senderName = NormalizeOptional(JsonHelpers.GetString(parameters, "senderName"));
            var requestedProjectId = NormalizeOptional(JsonHelpers.GetString(parameters, "projectId"));
            var providerId = NormalizeOptional(JsonHelpers.GetString(parameters, "providerId"));
            var modelId = NormalizeOptional(JsonHelpers.GetString(parameters, "modelId"));
            var compositeKey = BuildPluginMessageSessionKey(pluginId, chatId);
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            // Resolve project
            ProjectEntity? project = null;
            if (requestedProjectId is not null)
            {
                project = db.Queryable<ProjectEntity>().First(p => p.Id == requestedProjectId);
            }

            // Find existing session by external chat ID
            var session = db.Queryable<SessionEntity>()
                .Where(s => s.ExternalChatId == compositeKey)
                .First();

            var modelSelectionMode = providerId is not null && modelId is not null
                ? "manual"
                : "inherit";

            string sessionId;
            string sessionTitle;
            string? sessionProjectId;

            if (session is null)
            {
                // Create new session
                sessionId = CreateSessionId();
                sessionTitle = FirstNonEmpty(chatName, senderName, chatId) ?? chatId;
                sessionProjectId = project?.Id;

                var entity = new SessionEntity
                {
                    Id = sessionId,
                    Title = sessionTitle,
                    Mode = "cowork",
                    CreatedAt = now,
                    UpdatedAt = now,
                    ProjectId = project?.Id,
                    WorkingFolder = EmptyToNull(project?.WorkingFolder),
                    SshConnectionId = project?.SshConnectionId,
                    Pinned = 0,
                    PluginId = pluginId,
                    ExternalChatId = compositeKey,
                    ProviderId = providerId,
                    ModelId = modelId,
                    ModelSelectionMode = modelSelectionMode
                };

                db.Insertable(entity).ExecuteCommand();
            }
            else
            {
                sessionId = session.Id;
                sessionTitle = session.Title;
                sessionProjectId = session.ProjectId;

                // Update existing session
                if (project is not null)
                {
                    db.Updateable<SessionEntity>()
                        .SetColumns(s => new SessionEntity
                        {
                            UpdatedAt = now,
                            ProjectId = project.Id,
                            WorkingFolder = EmptyToNull(project.WorkingFolder),
                            SshConnectionId = project.SshConnectionId
                        })
                        .Where(s => s.Id == sessionId)
                        .ExecuteCommand();
                    sessionProjectId = project.Id;
                }
                else
                {
                    db.Updateable<SessionEntity>()
                        .SetColumns(s => new SessionEntity { UpdatedAt = now })
                        .Where(s => s.Id == sessionId)
                        .ExecuteCommand();
                }

                if (providerId is not null || modelId is not null)
                {
                    db.Updateable<SessionEntity>()
                        .SetColumns(s => new SessionEntity
                        {
                            ProviderId = providerId,
                            ModelId = modelId,
                            ModelSelectionMode = modelSelectionMode
                        })
                        .Where(s => s.Id == sessionId)
                        .ExecuteCommand();
                }

                // Replace title if we have a better one
                var betterTitle = FirstNonEmpty(chatName, senderName);
                if (ShouldReplaceSessionTitle(sessionTitle, betterTitle))
                {
                    db.Updateable<SessionEntity>()
                        .SetColumns(s => new SessionEntity { Title = betterTitle! })
                        .Where(s => s.Id == sessionId)
                        .ExecuteCommand();
                    sessionTitle = betterTitle!;
                }
            }

            return WorkerResponse.Json(new PluginRouteSessionResult(
                true,
                sessionId,
                sessionTitle,
                sessionProjectId,
                EmptyToNull(project?.WorkingFolder),
                project?.SshConnectionId,
                null));
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(
                new PluginRouteSessionResult(false, null, null, null, null, null, ex.Message));
        }
    }

    // ── Internal helpers (used by auto-reply pipeline) ──

    internal static PluginSessionFindResult FindPluginSessionRecordByChat(string externalChatId)
    {
        try
        {
            DbClient.EnsureInitialized();
            var db = DbClient.GetClient();

            var entity = db.Queryable<SessionEntity>()
                .Where(s => s.ExternalChatId == externalChatId)
                .First();

            var row = entity is null ? null : SessionToPluginRow(entity);
            return new PluginSessionFindResult(true, row, null);
        }
        catch (Exception ex)
        {
            return new PluginSessionFindResult(false, null, ex.Message);
        }
    }

    internal static List<PluginSessionMessageRow> ListPluginSessionMessageRecords(
        string sessionId,
        int limit,
        int offset = 0)
    {
        DbClient.EnsureInitialized();
        var db = DbClient.GetClient();

        var entities = db.Queryable<MessageEntity>()
            .Where(m => m.SessionId == sessionId)
            .OrderBy("sort_order ASC")
            .Take(Math.Clamp(limit, 1, 500))
            .Skip(Math.Max(0, offset))
            .ToList();

        return entities.Select(m => new PluginSessionMessageRow
        {
            Id = m.Id,
            Role = m.Role,
            Content = m.Content,
            CreatedAt = m.CreatedAt
        }).ToList();
    }

    // ── Private helpers ──

    private static PluginSessionRow SessionToPluginRow(SessionEntity e) => new()
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

    private static WorkerResponse Mutation(int changed, int deleted)
    {
        return WorkerResponse.Json(new PluginSessionMutationResult(true, changed, deleted, null));
    }

    private static WorkerResponse MutationError(string error)
    {
        return WorkerResponse.Json(new PluginSessionMutationResult(false, 0, 0, error));
    }

    private static string RequireString(JsonElement parameters, string name)
    {
        return JsonHelpers.GetString(parameters, name) is { Length: > 0 } value
            ? value
            : throw new InvalidOperationException($"Missing required plugin session field: {name}");
    }

    private static string BuildPluginMessageSessionKey(string pluginId, string chatId)
    {
        return $"plugin:{pluginId}:chat:{EncodeSessionKeyPart(chatId)}";
    }

    private static string CreateSessionId()
    {
        return $"wc_{Guid.NewGuid():N}";
    }

    private static string EncodeSessionKeyPart(string value)
    {
        return Uri.EscapeDataString(value)
            .Replace("%21", "!", StringComparison.OrdinalIgnoreCase)
            .Replace("%27", "'", StringComparison.OrdinalIgnoreCase)
            .Replace("%28", "(", StringComparison.OrdinalIgnoreCase)
            .Replace("%29", ")", StringComparison.OrdinalIgnoreCase)
            .Replace("%2A", "*", StringComparison.OrdinalIgnoreCase);
    }

    private static bool ShouldReplaceSessionTitle(string? currentTitle, string? nextTitle)
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

    private static string? FirstNonEmpty(params string?[] values)
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

    private static string? NormalizeOptional(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    private static string? EmptyToNull(string? value)
    {
        return string.IsNullOrEmpty(value) ? null : value;
    }
}
