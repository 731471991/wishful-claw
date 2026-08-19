using System.Text.Json.Serialization.Metadata;
using System.Text.Json;
using Microsoft.Data.Sqlite;
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

    /// <summary>
    /// Lightweight locator index — returns all messages with only id/role/content/createdAt/sortOrder
    /// (no meta/usage). Used by the right-side AssistantReplyRail to render conversation turn markers.
    /// </summary>
    public static WorkerResponse ListLocator(JsonElement parameters)
    {
        try
        {
            var sessionId = RequireString(parameters, "sessionId");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var entities = db.Query(
                "SELECT id, session_id, role, content, created_at, sort_order FROM messages WHERE session_id = @sid ORDER BY sort_order ASC",
                EntityMappers.MapMessage,
                new SqliteParameter("@sid", sessionId));

            var rows = entities.Select(MessageRow.FromEntity).ToList();
            return WorkerResponse.Json(rows, InfrastructureJsonContext.Default.ListMessageRow);
        }
        catch
        {
            return WorkerResponse.Json(new List<MessageRow>(), InfrastructureJsonContext.Default.ListMessageRow);
        }
    }

    /// <summary>
    /// Turn-based pagination: load N conversation turns before a given created_at timestamp.
    /// A "turn" = one user message + all subsequent non-user messages until the next user message.
    /// Returns messages + rangeStart (earliest created_at in the batch) + hasMore.
    /// </summary>
    public static WorkerResponse ListByTurns(JsonElement parameters)
    {
        try
        {
            var sessionId = RequireString(parameters, "sessionId");
            var turns = Math.Clamp(JsonHelpers.GetInt(parameters, "turns", 5), 1, 50);
            long? beforeCreatedAt = parameters.TryGetProperty("beforeCreatedAt", out var bca) && bca.ValueKind == JsonValueKind.Number
                ? bca.GetInt64()
                : null;

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            // Step 1: Find the created_at of the N most recent user messages before beforeCreatedAt
            List<long> userTimestamps;
            if (beforeCreatedAt.HasValue)
            {
                userTimestamps = db.Query(
                    "SELECT created_at FROM messages WHERE session_id = @sid AND role = 'user' AND created_at < @before ORDER BY created_at DESC LIMIT @turns",
                    (r) => r.GetInt64(0),
                    new SqliteParameter("@sid", sessionId),
                    new SqliteParameter("@before", beforeCreatedAt.Value),
                    new SqliteParameter("@turns", turns));
            }
            else
            {
                userTimestamps = db.Query(
                    "SELECT created_at FROM messages WHERE session_id = @sid AND role = 'user' ORDER BY created_at DESC LIMIT @turns",
                    (r) => r.GetInt64(0),
                    new SqliteParameter("@sid", sessionId),
                    new SqliteParameter("@turns", turns));
            }

            if (userTimestamps.Count == 0)
            {
                return WorkerResponse.Json(
                    new MessageListByTurnsResult(true, new List<MessageRow>(), 0, false, null),
                    InfrastructureJsonContext.Default.MessageListByTurnsResult);
            }

            // Step 2: rangeStart = earliest user created_at in this batch
            var rangeStart = userTimestamps.Min();

            // Step 3: Load all messages from rangeStart up to (but not including) beforeCreatedAt
            var messages = beforeCreatedAt.HasValue
                ? db.Query(
                    "SELECT * FROM messages WHERE session_id = @sid AND created_at >= @rangeStart AND created_at < @before ORDER BY created_at ASC",
                    EntityMappers.MapMessage,
                    new SqliteParameter("@sid", sessionId),
                    new SqliteParameter("@rangeStart", rangeStart),
                    new SqliteParameter("@before", beforeCreatedAt.Value))
                : db.Query(
                    "SELECT * FROM messages WHERE session_id = @sid AND created_at >= @rangeStart ORDER BY created_at ASC",
                    EntityMappers.MapMessage,
                    new SqliteParameter("@sid", sessionId),
                    new SqliteParameter("@rangeStart", rangeStart));

            // Step 4: Check if there are more user messages before rangeStart
            var hasMore = db.QueryScalar<int>(
                "SELECT COUNT(*) FROM messages WHERE session_id = @sid AND role = 'user' AND created_at < @rangeStart",
                new SqliteParameter("@sid", sessionId),
                new SqliteParameter("@rangeStart", rangeStart)) > 0;

            var rows = messages.Select(MessageRow.FromEntity).ToList();
            return WorkerResponse.Json(
                new MessageListByTurnsResult(true, rows, rangeStart, hasMore, null),
                InfrastructureJsonContext.Default.MessageListByTurnsResult);
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(
                new MessageListByTurnsResult(false, new List<MessageRow>(), 0, false, ex.Message),
                InfrastructureJsonContext.Default.MessageListByTurnsResult);
        }
    }

    // ─── Search ───

    /// <summary>
    /// Search message content across all sessions by keyword.
    /// Returns matching messages with a snippet around the keyword and the session title.
    /// </summary>
    public static WorkerResponse SearchContent(JsonElement parameters)
    {
        try
        {
            var query = RequireString(parameters, "query");
            var limit = Math.Clamp(JsonHelpers.GetInt(parameters, "limit", 50), 1, 200);

            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            // LIKE search on messages.content, join sessions for title
            var sql = """
                SELECT m.id, m.session_id, m.content, m.created_at,
                       s.title AS session_title
                FROM messages m
                JOIN sessions s ON s.id = m.session_id
                WHERE m.content LIKE @pattern
                ORDER BY m.created_at DESC
                LIMIT @limit
                """;

            var pattern = $"%{query}%";
            var rows = db.Query(
                sql,
                (r) =>
                {
                    var content = r.GetString("content");
                    var snippet = BuildSnippet(content, query);
                    return new MessageSearchResultRow
                    {
                        MessageId = r.GetString("id"),
                        SessionId = r.GetString("session_id"),
                        SessionTitle = r.GetString("session_title"),
                        Snippet = snippet,
                        CreatedAt = r.GetInt64("created_at")
                    };
                },
                new SqliteParameter("@pattern", pattern),
                new SqliteParameter("@limit", limit));

            return WorkerResponse.Json(
                new MessageSearchResult(true, rows, null),
                InfrastructureJsonContext.Default.MessageSearchResult);
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(
                new MessageSearchResult(false, new List<MessageSearchResultRow>(), ex.Message),
                InfrastructureJsonContext.Default.MessageSearchResult);
        }
    }

    /// <summary>
    /// Build a short snippet around the first occurrence of <paramref name="query"/>
    /// (already lowercased) within <paramref name="text"/>.
    /// 20 chars before, 30 after — mirrors OpenCowork's buildSnippet.
    /// </summary>
    private static string BuildSnippet(string text, string query)
    {
        var lower = text.ToLowerInvariant();
        var idx = lower.IndexOf(query, StringComparison.OrdinalIgnoreCase);
        if (idx == -1) return string.Empty;
        var start = Math.Max(0, idx - 20);
        var end = idx + query.Length + 30;
        var snippet = (start > 0 ? "..." : "") +
                      text.AsSpan(start, Math.Min(end, text.Length) - start).ToString().Replace("\n", " ") +
                      (end < text.Length ? "..." : "");
        return snippet;
    }

    // ─── Mutations ───

    public static WorkerResponse Add(JsonElement parameters)
    {
        try
        {
            var message = ReadMessageInput(parameters);
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            InsertMessage(db, message);
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

            foreach (var msg in messages)
            {
                InsertMessage(db, msg);
            }

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

            var exists = db.QueryScalar<int>(
                "SELECT COUNT(*) FROM messages WHERE id = @id",
                new SqliteParameter("@id", message.Id)) > 0;

            if (exists)
            {
                db.Execute(
                    "UPDATE messages SET session_id = @sid, role = @role, content = @content, " +
                    "meta = @meta, created_at = @ca, usage = @usage, sort_order = @so WHERE id = @id",
                    new SqliteParameter("@sid", message.SessionId),
                    new SqliteParameter("@role", message.Role),
                    new SqliteParameter("@content", message.Content),
                    new SqliteParameter("@meta", (object?)message.Meta ?? DBNull.Value),
                    new SqliteParameter("@ca", message.CreatedAt),
                    new SqliteParameter("@usage", (object?)message.Usage ?? DBNull.Value),
                    new SqliteParameter("@so", message.SortOrder),
                    new SqliteParameter("@id", message.Id));
            }
            else
            {
                InsertMessage(db, message);
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

            var current = db.QueryFirstOrDefault(
                "SELECT * FROM messages WHERE id = @id",
                EntityMappers.MapMessage,
                new SqliteParameter("@id", id));
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

            var changed = db.Execute(
                "UPDATE messages SET content = @content, meta = @meta, usage = @usage WHERE id = @id",
                new SqliteParameter("@content", current.Content),
                new SqliteParameter("@meta", (object?)current.Meta ?? DBNull.Value),
                new SqliteParameter("@usage", (object?)current.Usage ?? DBNull.Value),
                new SqliteParameter("@id", id));
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

            db.Execute("DELETE FROM messages WHERE session_id = @sid", new SqliteParameter("@sid", sessionId));
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

            var deleted = db.Execute(
                "DELETE FROM messages WHERE session_id = @sid AND id = @mid",
                new SqliteParameter("@sid", sessionId),
                new SqliteParameter("@mid", messageId));

            if (deleted > 0)
            {
                IncrementMessageCount(db, sessionId, -1);
            }

            return WorkerResponse.Json(new MessageDeleteResult(true, deleted > 0, null), InfrastructureJsonContext.Default.MessageDeleteResult);
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(new MessageDeleteResult(false, false, ex.Message), InfrastructureJsonContext.Default.MessageDeleteResult);
        }
    }

    public static WorkerResponse Count(JsonElement parameters)
    {
        try
        {
            var sessionId = RequireString(parameters, "sessionId");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var count = db.QueryScalar<int>(
                "SELECT COUNT(*) FROM messages WHERE session_id = @sid",
                new SqliteParameter("@sid", sessionId));
            return WorkerResponse.Json(new MessageCountResult(true, count, null), InfrastructureJsonContext.Default.MessageCountResult);
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(new MessageCountResult(false, 0, ex.Message), InfrastructureJsonContext.Default.MessageCountResult);
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

            string sql = role is not null
                ? "SELECT * FROM messages WHERE session_id = @sid AND role = @role ORDER BY sort_order DESC LIMIT 1"
                : "SELECT * FROM messages WHERE session_id = @sid ORDER BY sort_order DESC LIMIT 1";

            var lastParams = new List<SqliteParameter> { new("@sid", sessionId) };
            if (role is not null)
                lastParams.Add(new SqliteParameter("@role", role));
            var last = db.QueryFirstOrDefault(sql, EntityMappers.MapMessage, [.. lastParams]);

            if (last is null)
            {
                return WorkerResponse.Json(new MessageDeleteLastResult(true, null, null), InfrastructureJsonContext.Default.MessageDeleteLastResult);
            }

            db.Execute("DELETE FROM messages WHERE id = @id", new SqliteParameter("@id", last.Id));
            IncrementMessageCount(db, sessionId, -1);

            return WorkerResponse.Json(new MessageDeleteLastResult(true, MessageRow.FromEntity(last), null), InfrastructureJsonContext.Default.MessageDeleteLastResult);
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(new MessageDeleteLastResult(false, null, ex.Message), InfrastructureJsonContext.Default.MessageDeleteLastResult);
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

            var deleted = db.Execute(
                "DELETE FROM messages WHERE session_id = @sid AND sort_order >= @so",
                new SqliteParameter("@sid", sessionId),
                new SqliteParameter("@so", fromSortOrder));

            var newCount = db.QueryScalar<int>(
                "SELECT COUNT(*) FROM messages WHERE session_id = @sid",
                new SqliteParameter("@sid", sessionId));
            SetMessageCount(db, sessionId, newCount);

            return Mutation(deleted);
        }
        catch (Exception ex)
        {
            return MutationError(ex.Message);
        }
    }

    // NOTE: CompactSession and UsageStats are in DbMessageCompactTools.cs

    internal static void InsertMessage(DbService db, MessageEntity message)
    {
        db.Execute(
            "INSERT INTO messages (id, session_id, role, content, meta, created_at, usage, sort_order) " +
            "VALUES (@id, @sid, @role, @content, @meta, @ca, @usage, @so)",
            new SqliteParameter("@id", message.Id),
            new SqliteParameter("@sid", message.SessionId),
            new SqliteParameter("@role", message.Role),
            new SqliteParameter("@content", message.Content),
            new SqliteParameter("@meta", (object?)message.Meta ?? DBNull.Value),
            new SqliteParameter("@ca", message.CreatedAt),
            new SqliteParameter("@usage", (object?)message.Usage ?? DBNull.Value),
            new SqliteParameter("@so", message.SortOrder));
    }

    private static WorkerResponse ReadRows(JsonElement parameters, string? role, bool paged)
    {
        try
        {
            var sessionId = RequireString(parameters, "sessionId");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            List<SqliteParameter> paramList = [new("@sid", sessionId)];
            string sql;

            if (role is not null)
            {
                paramList.Add(new SqliteParameter("@role", role));
                sql = "SELECT * FROM messages WHERE session_id = @sid AND role = @role ORDER BY created_at ASC, sort_order ASC";
            }
            else
            {
                sql = "SELECT * FROM messages WHERE session_id = @sid ORDER BY created_at ASC, sort_order ASC";
            }

            if (paged)
            {
                var limit = Math.Clamp(JsonHelpers.GetInt(parameters, "limit", 100), 1, 5000);
                var offset = Math.Max(0, JsonHelpers.GetInt(parameters, "offset", 0));
                paramList.Add(new SqliteParameter("@limit", limit));
                paramList.Add(new SqliteParameter("@offset", offset));
                sql += " LIMIT @limit OFFSET @offset";
            }

            var entities = db.Query(sql, EntityMappers.MapMessage, [.. paramList]);
            var rows = entities.Select(MessageRow.FromEntity).ToList();

            return WorkerResponse.Json(rows, InfrastructureJsonContext.Default.ListMessageRow);
        }
        catch (Exception)
        {
            return WorkerResponse.Json(new List<MessageRow>(), InfrastructureJsonContext.Default.ListMessageRow);
        }
    }

    internal static MessageEntity ReadMessageInput(JsonElement element, string? sessionIdOverride = null)
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

    internal static void IncrementMessageCount(DbService db, string sessionId, int delta)
    {
        var session = db.QueryFirstOrDefault(
            "SELECT * FROM sessions WHERE id = @id",
            EntityMappers.MapSession,
            new SqliteParameter("@id", sessionId));
        if (session is null) return;
        session.MessageCount = Math.Max(0, session.MessageCount + delta);
        session.UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        db.Execute(
            "UPDATE sessions SET message_count = @mc, updated_at = @ua WHERE id = @id",
            new SqliteParameter("@mc", session.MessageCount),
            new SqliteParameter("@ua", session.UpdatedAt),
            new SqliteParameter("@id", sessionId));
    }

    internal static void SetMessageCount(DbService db, string sessionId, int count)
    {
        db.Execute(
            "UPDATE sessions SET message_count = @mc WHERE id = @id",
            new SqliteParameter("@mc", count),
            new SqliteParameter("@id", sessionId));
    }

    private static string RequireString(JsonElement parameters, string name)
    {
        return JsonHelpers.GetString(parameters, name) is { Length: > 0 } value
            ? value
            : throw new InvalidOperationException($"Missing required field: {name}");
    }

    private static WorkerResponse Mutation(int changed)
    {
        return WorkerResponse.Json(new MessageMutationResult(true, changed, null), InfrastructureJsonContext.Default.MessageMutationResult);
    }

    private static WorkerResponse MutationError(string error)
    {
        return WorkerResponse.Json(new MessageMutationResult(false, 0, error), InfrastructureJsonContext.Default.MessageMutationResult);
    }
}
