using System.Text.Json;
using SqlSugar;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Infrastructure.Db;

namespace WishfulClaw.Infrastructure.Db;

public static class DbMessageTools
{
    // ─── Query ───

    public static WorkerResponse List(JsonElement parameters)
    {
        return ReadRows(parameters, role: null, paged: false);
    }

    public static WorkerResponse ListPage(JsonElement parameters)
    {
        return ReadRows(parameters, role: null, paged: true);
    }

    // ─── Mutations ───

    public static WorkerResponse Add(JsonElement parameters)
    {
        try
        {
            var message = ReadMessageInput(parameters);
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            db.Insertable(message).ExecuteCommand();
            IncrementMessageCount(db, message.SessionId, 1);
            return Mutation(1);
        }
        catch (Exception ex)
        {
            return MutationError(ex.Message);
        }
    }

    public static WorkerResponse AddBatch(JsonElement parameters)
    {
        try
        {
            if (!parameters.TryGetProperty("messages", out var messagesEl) || messagesEl.ValueKind != JsonValueKind.Array)
            {
                return Mutation(0);
            }

            var messages = new List<MessageEntity>();
            foreach (var item in messagesEl.EnumerateArray())
            {
                messages.Add(ReadMessageInput(item));
            }

            if (messages.Count == 0) return Mutation(0);

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            db.Insertable(messages).ExecuteCommand();

            // Increment message_count per session
            var bySession = messages.GroupBy(m => m.SessionId);
            foreach (var grp in bySession)
            {
                IncrementMessageCount(db, grp.Key, grp.Count());
            }

            return Mutation(messages.Count);
        }
        catch (Exception ex)
        {
            return MutationError(ex.Message);
        }
    }

    public static WorkerResponse Upsert(JsonElement parameters)
    {
        try
        {
            var message = ReadMessageInput(parameters);
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var exists = db.Queryable<MessageEntity>().Any(m => m.Id == message.Id);
            db.Storageable(message).ExecuteCommand();

            if (!exists)
            {
                IncrementMessageCount(db, message.SessionId, 1);
            }

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

            var current = db.Queryable<MessageEntity>().First(m => m.Id == id);
            if (current is null) return Mutation(0);

            if (patch.TryGetProperty("content", out var contentEl) && contentEl.ValueKind == JsonValueKind.String)
            {
                current.Content = contentEl.GetString() ?? string.Empty;
            }
            if (patch.TryGetProperty("meta", out var metaEl))
            {
                current.Meta = metaEl.ValueKind == JsonValueKind.String
                    ? DbProjectTools.NormalizeOptional(metaEl.GetString())
                    : null;
            }
            if (patch.TryGetProperty("usage", out var usageEl))
            {
                current.Usage = usageEl.ValueKind == JsonValueKind.String
                    ? DbProjectTools.NormalizeOptional(usageEl.GetString())
                    : null;
            }

            var changed = db.Updateable(current).ExecuteCommand();
            return Mutation(changed);
        }
        catch (Exception ex)
        {
            return MutationError(ex.Message);
        }
    }

    public static WorkerResponse Clear(JsonElement parameters)
    {
        try
        {
            var sessionId = RequireString(parameters, "sessionId");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            db.Deleteable<MessageEntity>().Where(m => m.SessionId == sessionId).ExecuteCommand();
            SetMessageCount(db, sessionId, 0);
            return Mutation(1);
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
            var sessionId = RequireString(parameters, "sessionId");
            var messageId = RequireString(parameters, "messageId");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var deleted = db.Deleteable<MessageEntity>()
                .Where(m => m.SessionId == sessionId && m.Id == messageId)
                .ExecuteCommand();

            if (deleted > 0)
            {
                IncrementMessageCount(db, sessionId, -1);
            }

            return WorkerResponse.Json(new MessageDeleteResult(true, deleted > 0, null));
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(new MessageDeleteResult(false, false, ex.Message));
        }
    }

    public static WorkerResponse Count(JsonElement parameters)
    {
        try
        {
            var sessionId = RequireString(parameters, "sessionId");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var count = db.Queryable<MessageEntity>().Where(m => m.SessionId == sessionId).Count();
            return WorkerResponse.Json(new MessageCountResult(true, count, null));
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(new MessageCountResult(false, 0, ex.Message));
        }
    }

    public static WorkerResponse DeleteLast(JsonElement parameters)
    {
        try
        {
            var sessionId = RequireString(parameters, "sessionId");
            var role = DbProjectTools.NormalizeOptional(JsonHelpers.GetString(parameters, "role"));
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var query = db.Queryable<MessageEntity>()
                .Where(m => m.SessionId == sessionId);

            if (role is not null)
            {
                query = query.Where(m => m.Role == role);
            }

            var last = query.OrderBy("sort_order DESC").First();
            if (last is null)
            {
                return WorkerResponse.Json(new MessageDeleteLastResult(true, null, null));
            }

            db.Deleteable<MessageEntity>().Where(m => m.Id == last.Id).ExecuteCommand();
            IncrementMessageCount(db, sessionId, -1);

            return WorkerResponse.Json(new MessageDeleteLastResult(true, MessageRow.FromEntity(last), null));
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(new MessageDeleteLastResult(false, null, ex.Message));
        }
    }

    public static WorkerResponse TruncateFrom(JsonElement parameters)
    {
        try
        {
            var sessionId = RequireString(parameters, "sessionId");
            var fromSortOrder = JsonHelpers.GetInt(parameters, "fromSortOrder", 0);
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var deleted = db.Deleteable<MessageEntity>()
                .Where(m => m.SessionId == sessionId && m.SortOrder >= fromSortOrder)
                .ExecuteCommand();

            // Recount and update session message_count
            var newCount = db.Queryable<MessageEntity>().Where(m => m.SessionId == sessionId).Count();
            SetMessageCount(db, sessionId, newCount);

            return Mutation(deleted);
        }
        catch (Exception ex)
        {
            return MutationError(ex.Message);
        }
    }


    // NOTE: CompactSession and UsageStats are in DbMessageCompactTools.cs

    private static WorkerResponse ReadRows(JsonElement parameters, string? role, bool paged)
    {
        try
        {
            var sessionId = RequireString(parameters, "sessionId");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var query = db.Queryable<MessageEntity>()
                .Where(m => m.SessionId == sessionId);

            if (role is not null)
            {
                query = query.Where(m => m.Role == role);
            }

            query = query.OrderBy("created_at ASC, sort_order ASC");

            if (paged)
            {
                var limit = Math.Clamp(JsonHelpers.GetInt(parameters, "limit", 100), 1, 5000);
                var offset = Math.Max(0, JsonHelpers.GetInt(parameters, "offset", 0));
                query = query.Skip(offset).Take(limit);
            }

            var entities = query.ToList();
            var rows = entities.Select(MessageRow.FromEntity).ToList();

            return WorkerResponse.Json(rows);
        }
        catch (Exception)
        {
            return WorkerResponse.Json(new List<MessageRow>());
        }
    }

    private static MessageEntity ReadMessageInput(JsonElement element, string? sessionIdOverride = null)
    {
        return new MessageEntity
        {
            Id = RequireString(element, "id"),
            SessionId = sessionIdOverride ?? RequireString(element, "sessionId"),
            Role = RequireString(element, "role"),
            Content = JsonHelpers.GetString(element, "content") ?? string.Empty,
            Meta = DbProjectTools.NormalizeOptional(JsonHelpers.GetString(element, "meta")),
            CreatedAt = JsonHelpers.GetLong(element, "createdAt", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()),
            Usage = DbProjectTools.NormalizeOptional(JsonHelpers.GetString(element, "usage")),
            SortOrder = JsonHelpers.GetInt(element, "sortOrder", 0)
        };
    }

    private static void IncrementMessageCount(ISqlSugarClient db, string sessionId, int delta)
    {
        var session = db.Queryable<SessionEntity>().First(s => s.Id == sessionId);
        if (session is null) return;
        session.MessageCount = Math.Max(0, session.MessageCount + delta);
        db.Updateable(session).UpdateColumns(s => new { s.MessageCount }).ExecuteCommand();
    }

    private static void SetMessageCount(ISqlSugarClient db, string sessionId, int count)
    {
        var session = db.Queryable<SessionEntity>().First(s => s.Id == sessionId);
        if (session is null) return;
        session.MessageCount = count;
        db.Updateable(session).UpdateColumns(s => new { s.MessageCount }).ExecuteCommand();
    }

    private static string RequireString(JsonElement parameters, string name)
    {
        return JsonHelpers.GetString(parameters, name) is { Length: > 0 } value
            ? value
            : throw new InvalidOperationException($"Missing required field: {name}");
    }

    private static WorkerResponse Mutation(int changed)
    {
        return WorkerResponse.Json(new MessageMutationResult(true, changed, null));
    }

    private static WorkerResponse MutationError(string error)
    {
        return WorkerResponse.Json(new MessageMutationResult(false, 0, error));
    }
}
