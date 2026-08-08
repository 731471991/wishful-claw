using System.Buffers;
using System.Text;
using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using Microsoft.Data.Sqlite;
using WishfulClaw.Infrastructure.Db;

namespace WishfulClaw.Agent;

/// <summary>
/// Session restore: load messages from DB and rebuild SessionConversation.
/// Called when the user switches to an existing session whose backend state
/// is empty (e.g. after process restart). Mirrors Reasonix's
/// LoadSession(path) + SetSession(loaded) pattern.
/// </summary>
internal static class SessionRestoreTools
{
    /// <summary>
    /// Restore a session from the DB. Reads all messages for the given
    /// sessionId, converts them to wire-format JsonElements, and calls
    /// SessionConversation.Initialize().
    /// </summary>
    public static WorkerResponse RestoreSession(JsonElement parameters)
    {
        var sessionId = JsonHelpers.GetString(parameters, "sessionId")?.Trim();
        if (string.IsNullOrEmpty(sessionId))
        {
            return WorkerResponse.Error("sessionId is required.");
        }

        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            // Load all messages ordered by sort_order
            var entities = db.Query(
                "SELECT * FROM messages WHERE session_id = @sid ORDER BY created_at ASC, sort_order ASC",
                EntityMappers.MapMessage, new SqliteParameter("@sid", sessionId));

            if (entities.Count == 0)
            {
                // No messages in DB — nothing to restore, leave session empty
                WorkerLog.Info($"agent restore-session: no messages for session={FormatLogValue(sessionId)}");
                return WorkerResponse.Json(new { restored = true, sessionId, messageCount = 0 });
            }

            // Convert DB rows to wire-format JsonElements
            var wireMessages = new List<JsonElement>();
            foreach (var entity in entities)
            {
                var wire = ConvertToWireMessage(entity);
                wireMessages.Add(wire);
            }

            // Parse to AgentRuntimeChatMessage list
            var conversation = ParseWireMessages(wireMessages);

            // Initialize the SessionConversation - but only if it's empty.
            // If the session already has messages (e.g. agent loop is running
            // or a previous turn already populated it), skip to avoid
            // clobbering the live conversation state.
            var sessionConv = SessionConversationManager.GetOrCreate(sessionId);
            if (sessionConv.MessageCount > 0)
            {
                WorkerLog.Info(
                    $"agent restore-session: skipped (session already has {sessionConv.MessageCount} messages) " +
                    $"session={FormatLogValue(sessionId)}");
                return WorkerResponse.Json(new { restored = true, sessionId, messageCount = sessionConv.MessageCount, skipped = true });
            }

            sessionConv.Initialize(wireMessages, conversation);

            WorkerLog.Info(
                $"agent restore-session: loaded {wireMessages.Count} messages " +
                $"for session={FormatLogValue(sessionId)}");

            return WorkerResponse.Json(new
            {
                restored = true,
                sessionId,
                messageCount = wireMessages.Count
            });
        }
        catch (Exception ex)
        {
            WorkerLog.Error(
                $"agent restore-session failed session={FormatLogValue(sessionId)} " +
                $"error={ex.GetType().Name}: {ex.Message}");
            return WorkerResponse.Error($"Restore failed: {ex.Message}");
        }
    }

    /// <summary>
    /// Convert a DB MessageEntity to a wire-format JsonElement that matches
    /// what the frontend sends in the "messages" array:
    ///   - Plain text: { role: "user", content: "text" }
    ///   - With tool calls: { role: "assistant", content: [{type:"text",...},{type:"tool_use",...}] }
    ///   - With tool results: { role: "user", content: [{type:"tool_result",...}] }
    /// </summary>
    private static JsonElement ConvertToWireMessage(MessageEntity entity)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer, new JsonWriterOptions
        {
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        }))
        {
            writer.WriteStartObject();
            writer.WriteString("id", entity.Id);
            writer.WriteString("role", entity.Role);

            // Parse meta to check for tool calls
            JsonElement? meta = null;
            if (!string.IsNullOrEmpty(entity.Meta))
            {
                try
                {
                    meta = JsonDocument.Parse(entity.Meta).RootElement.Clone();
                }
                catch { /* ignore parse errors */ }
            }

            // Check if this message has tool calls in meta
            var hasToolCalls = false;
            if (meta is { } m && m.TryGetProperty("toolCalls", out var toolCallsEl) && toolCallsEl.ValueKind == JsonValueKind.Array)
            {
                hasToolCalls = toolCallsEl.GetArrayLength() > 0;
            }

            if (entity.Role == "assistant" && hasToolCalls && meta is { } metaVal)
            {
                // Assistant message with tool calls → content as array
                writer.WritePropertyName("content");
                writer.WriteStartArray();

                // Text block (if any)
                if (!string.IsNullOrEmpty(entity.Content))
                {
                    writer.WriteStartObject();
                    writer.WriteString("type", "text");
                    writer.WriteString("text", entity.Content);
                    writer.WriteEndObject();
                }

                // Tool use blocks
                if (metaVal.TryGetProperty("toolCalls", out var tcEl))
                {
                    foreach (var tc in tcEl.EnumerateArray())
                    {
                        var tcId = JsonHelpers.GetString(tc, "id");
                        var tcName = JsonHelpers.GetString(tc, "name");
                        if (string.IsNullOrEmpty(tcId) || string.IsNullOrEmpty(tcName)) continue;

                        writer.WriteStartObject();
                        writer.WriteString("type", "tool_use");
                        writer.WriteString("id", tcId);
                        writer.WriteString("name", tcName);
                        writer.WritePropertyName("input");
                        if (tc.TryGetProperty("input", out var inputEl))
                        {
                            inputEl.WriteTo(writer);
                        }
                        else
                        {
                            writer.WriteStartObject();
                            writer.WriteEndObject();
                        }
                        writer.WriteEndObject();
                    }
                }

                writer.WriteEndArray();
            }
            else if (entity.Role == "user" && hasToolCalls && meta is { } metaVal2)
            {
                // User message that is actually tool_results (paired with previous assistant tool_use)
                writer.WritePropertyName("content");
                writer.WriteStartArray();

                if (metaVal2.TryGetProperty("toolCalls", out var tcEl))
                {
                    foreach (var tc in tcEl.EnumerateArray())
                    {
                        var tcId = JsonHelpers.GetString(tc, "id");
                        if (string.IsNullOrEmpty(tcId)) continue;

                        var tcStatus = JsonHelpers.GetString(tc, "status");
                        var isError = tcStatus == "error";
                        var output = JsonHelpers.GetString(tc, "output") ?? JsonHelpers.GetString(tc, "error") ?? "";

                        writer.WriteStartObject();
                        writer.WriteString("type", "tool_result");
                        writer.WriteString("toolUseId", tcId);
                        writer.WriteString("content", output);
                        if (isError)
                        {
                            writer.WriteBoolean("isError", true);
                        }
                        writer.WriteEndObject();
                    }
                }

                writer.WriteEndArray();
            }
            else
            {
                // Plain text message
                writer.WriteString("content", entity.Content);
            }

            writer.WriteNumber("createdAt", entity.CreatedAt);
            writer.WriteEndObject();
        }

        using var doc = JsonDocument.Parse(buffer.WrittenMemory);
        return doc.RootElement.Clone();
    }

    /// <summary>
    /// Parse wire-format messages to AgentRuntimeChatMessage list.
    /// Reuses the same parsing logic as ConversationCodec.ReadConversation.
    /// </summary>
    private static List<AgentRuntimeChatMessage> ParseWireMessages(IReadOnlyList<JsonElement> messages)
    {
        var result = new List<AgentRuntimeChatMessage>();

        foreach (var message in messages)
        {
            var role = JsonHelpers.GetString(message, "role");
            if (string.IsNullOrEmpty(role)) continue;

            if (!message.TryGetProperty("content", out var content)) continue;

            if (content.ValueKind == JsonValueKind.String)
            {
                result.Add(new AgentRuntimeChatMessage(
                    role,
                    content.GetString() ?? string.Empty,
                    [], [],
                    JsonHelpers.GetString(message, "providerResponseId")));
                continue;
            }

            if (content.ValueKind != JsonValueKind.Array) continue;

            var text = new StringBuilder();
            var toolUses = new List<AgentRuntimeChatToolUse>();
            var toolResults = new List<AgentRuntimeToolResult>();
            var contentBlocks = new List<JsonElement>();

            foreach (var block in content.EnumerateArray())
            {
                if (block.ValueKind == JsonValueKind.Object)
                {
                    contentBlocks.Add(block.Clone());
                }

                switch (JsonHelpers.GetString(block, "type"))
                {
                    case "text":
                        if (JsonHelpers.GetString(block, "text") is { Length: > 0 } blockText)
                        {
                            text.Append(blockText);
                        }
                        break;
                    case "tool_use":
                        if (JsonHelpers.GetString(block, "id") is { Length: > 0 } id &&
                            JsonHelpers.GetString(block, "name") is { Length: > 0 } name)
                        {
                            var input = block.TryGetProperty("input", out var inputElement)
                                ? inputElement.Clone()
                                : AgentRuntimeProviderSupport.CreateEmptyObjectElement();
                            var extraContent = block.TryGetProperty("extraContent", out var extra) &&
                                extra.ValueKind == JsonValueKind.Object
                                    ? extra.Clone()
                                    : (JsonElement?)null;
                            toolUses.Add(new AgentRuntimeChatToolUse(id, name, input, extraContent));
                        }
                        break;
                    case "tool_result":
                        if (JsonHelpers.GetString(block, "toolUseId") is { Length: > 0 } toolUseId)
                        {
                            var resultContent = block.TryGetProperty("content", out var contentElement)
                                ? contentElement.Clone()
                                : AgentRuntimeProviderSupport.CreateStringElement(string.Empty);
                            var isError = JsonHelpers.GetBool(block, "isError", false);
                            toolResults.Add(new AgentRuntimeToolResult(
                                toolUseId, resultContent, isError ? true : null));
                        }
                        break;
                }
            }

            result.Add(new AgentRuntimeChatMessage(
                role, text.ToString(), toolUses, toolResults,
                JsonHelpers.GetString(message, "providerResponseId"),
                contentBlocks));
        }

        return result;
    }

    private static string FormatLogValue(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "<empty>";
        return value.Length <= 12 ? value : value[..12] + "...";
    }
}
