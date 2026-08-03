using System.Text.Json;
using SqlSugar;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Infrastructure.Db;

namespace WishfulClaw.Infrastructure.Db;

/// <summary>
/// Plugin session routing logic and internal helpers for auto-reply pipeline.
/// Extracted from DbPluginSessionTools to keep file sizes manageable.
/// Shared helpers are accessed via DbPluginSessionTools.* (internal static).
/// </summary>
public static class DbPluginSessionRouting
{
    public static WorkerResponse RoutePluginSession(JsonElement parameters)
    {
        try
        {
            var pluginId = DbPluginSessionTools.RequireString(parameters, "pluginId");
            var chatId = DbPluginSessionTools.RequireString(parameters, "chatId");
            var chatName = DbPluginSessionTools.NormalizeOptional(JsonHelpers.GetString(parameters, "chatName"));
            var senderName = DbPluginSessionTools.NormalizeOptional(JsonHelpers.GetString(parameters, "senderName"));
            var requestedProjectId = DbPluginSessionTools.NormalizeOptional(JsonHelpers.GetString(parameters, "projectId"));
            var providerId = DbPluginSessionTools.NormalizeOptional(JsonHelpers.GetString(parameters, "providerId"));
            var modelId = DbPluginSessionTools.NormalizeOptional(JsonHelpers.GetString(parameters, "modelId"));
            var compositeKey = DbPluginSessionTools.BuildPluginMessageSessionKey(pluginId, chatId);
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
                sessionId = DbPluginSessionTools.CreateSessionId();
                sessionTitle = DbPluginSessionTools.FirstNonEmpty(chatName, senderName, chatId) ?? chatId;
                sessionProjectId = project?.Id;

                var entity = new SessionEntity
                {
                    Id = sessionId,
                    Title = sessionTitle,
                    Mode = "cowork",
                    CreatedAt = now,
                    UpdatedAt = now,
                    ProjectId = project?.Id,
                    WorkingFolder = DbPluginSessionTools.EmptyToNull(project?.WorkingFolder),
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
                            WorkingFolder = DbPluginSessionTools.EmptyToNull(project.WorkingFolder),
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
                var betterTitle = DbPluginSessionTools.FirstNonEmpty(chatName, senderName);
                if (DbPluginSessionTools.ShouldReplaceSessionTitle(sessionTitle, betterTitle))
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
                DbPluginSessionTools.EmptyToNull(project?.WorkingFolder),
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

    public static PluginSessionFindResult FindPluginSessionRecordByChat(string externalChatId)
    {
        try
        {
            DbClient.EnsureInitialized();
            var db = DbClient.GetClient();

            var entity = db.Queryable<SessionEntity>()
                .Where(s => s.ExternalChatId == externalChatId)
                .First();

            var row = entity is null ? null : DbPluginSessionTools.SessionToPluginRow(entity);
            return new PluginSessionFindResult(true, row, null);
        }
        catch (Exception ex)
        {
            return new PluginSessionFindResult(false, null, ex.Message);
        }
    }

    public static List<PluginSessionMessageRow> ListPluginSessionMessageRecords(
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
}
