using System.Buffers;
using System.Text;
using System.Text.Json;
using SqlSugar;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Infrastructure.Db;

namespace WishfulClaw.Infrastructure.Db;

/// <summary>
/// Message compaction and usage statistics tools.
/// Extracted from DbMessageTools to keep file sizes manageable.
/// </summary>
public static class DbMessageCompactTools
{
    public static WorkerResponse CompactSession(JsonElement parameters)
    {
        try
        {
            var sessionId = RequireString(parameters, "sessionId");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var messages = db.Queryable<MessageEntity>()
                .Where(m => m.SessionId == sessionId)
                .OrderBy(m => m.CreatedAt)
                .ToList();

            if (messages.Count < 6)
            {
                return WorkerResponse.Json(new MessageCompactResult(true, messages.Count, 0, null));
            }

            var cutoff = messages.Count - 6;
            var compacted = 0;
            for (var index = 0; index < cutoff; index++)
            {
                var row = messages[index];
                var compactedContent = TryCompactMessageContent(row.Content);
                if (compactedContent is null) continue;

                row.Content = compactedContent;
                db.Updateable(row).UpdateColumns(m => m.Content).ExecuteCommand();
                compacted++;
            }

            return WorkerResponse.Json(new MessageCompactResult(true, messages.Count, compacted, null));
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(new MessageCompactResult(false, 0, 0, ex.Message));
        }
    }

    public static WorkerResponse UsageStats(JsonElement parameters)
    {
        try
        {
            var sessionId = RequireString(parameters, "sessionId");
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var messages = db.Queryable<MessageEntity>()
                .Where(m => m.SessionId == sessionId && m.Role == "assistant" && m.Usage != null)
                .OrderBy(m => m.CreatedAt)
                .ToList();

            var stats = new UsageStatsAccumulator();
            foreach (var msg in messages)
            {
                if (string.IsNullOrWhiteSpace(msg.Usage)) continue;
                if (TryAddUsage(stats, msg.Usage))
                {
                    stats.AssistantReplies++;
                    stats.FirstCreatedAt ??= msg.CreatedAt;
                    stats.LastCreatedAt = msg.CreatedAt;
                }
            }

            return WorkerResponse.Json(new MessageUsageStatsResult(
                true,
                stats.AssistantReplies > 0,
                stats.TotalInput,
                stats.TotalOutput,
                stats.TotalCacheCreation,
                stats.TotalCacheRead,
                stats.TotalReasoning,
                stats.TotalDurationMs,
                stats.RequestCount,
                stats.AssistantReplies,
                stats.FirstCreatedAt,
                stats.LastCreatedAt,
                null));
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(new MessageUsageStatsResult(false, false, 0, 0, 0, 0, 0, 0, 0, 0, null, null, ex.Message));
        }
    }

    // ─── Compaction helpers ───

    private static string? TryCompactMessageContent(string content)
    {
        try
        {
            using var document = JsonDocument.Parse(content);
            if (document.RootElement.ValueKind != JsonValueKind.Array) return null;

            var changed = false;
            var buffer = new ArrayBufferWriter<byte>();
            using (var writer = new Utf8JsonWriter(buffer))
            {
                writer.WriteStartArray();
                foreach (var block in document.RootElement.EnumerateArray())
                {
                    WriteCompactedBlock(writer, block, ref changed);
                }
                writer.WriteEndArray();
            }

            return changed ? Encoding.UTF8.GetString(buffer.WrittenSpan) : null;
        }
        catch
        {
            return null;
        }
    }

    private static void WriteCompactedBlock(Utf8JsonWriter writer, JsonElement block, ref bool changed)
    {
        if (block.ValueKind != JsonValueKind.Object)
        {
            block.WriteTo(writer);
            return;
        }

        var type = block.TryGetProperty("type", out var typeEl) && typeEl.ValueKind == JsonValueKind.String
            ? typeEl.GetString()
            : null;
        var replaceToolResult = type == "tool_result" &&
            block.TryGetProperty("content", out var contentEl) &&
            GetJsonTextLength(contentEl) > 200;
        var replaceThinking = type == "thinking";

        if (replaceToolResult || replaceThinking) changed = true;

        writer.WriteStartObject();
        foreach (var prop in block.EnumerateObject())
        {
            if (replaceToolResult && prop.NameEquals("content")) continue;
            if (replaceThinking && prop.NameEquals("thinking")) continue;
            prop.WriteTo(writer);
        }

        if (replaceToolResult)
            writer.WriteString("content", "[Context compressed \u2014 stale tool result cleared]");
        if (replaceThinking)
            writer.WriteString("thinking", "[Thinking cleared during compression]");
        writer.WriteEndObject();
    }

    private static int GetJsonTextLength(JsonElement element)
    {
        return element.ValueKind == JsonValueKind.String
            ? element.GetString()?.Length ?? 0
            : element.GetRawText().Length;
    }

    // ─── Usage parsing helpers ───

    private static bool TryAddUsage(UsageStatsAccumulator stats, string usageJson)
    {
        try
        {
            using var document = JsonDocument.Parse(usageJson);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object) return false;

            var inputTokens = GetDouble(root, "inputTokens");
            var cacheReadTokens = GetDouble(root, "cacheReadTokens");
            var cacheCreationTokens = GetDouble(root, "cacheCreationTokens");
            var billableInputTokens = GetDoubleNullable(root, "billableInputTokens");

            stats.TotalInput += billableInputTokens ??
                Math.Max(0, inputTokens - Math.Max(0, cacheReadTokens) - Math.Max(0, cacheCreationTokens));
            stats.TotalOutput += GetDouble(root, "outputTokens");
            stats.TotalCacheCreation += cacheCreationTokens;
            stats.TotalCacheRead += cacheReadTokens;
            stats.TotalReasoning += GetDouble(root, "reasoningTokens");
            stats.TotalDurationMs += GetDouble(root, "totalDurationMs");
            stats.RequestCount += GetRequestTimingCount(root);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static int GetRequestTimingCount(JsonElement root)
    {
        if (root.TryGetProperty("requestTimings", out var timings) && timings.ValueKind == JsonValueKind.Array)
            return timings.GetArrayLength();
        return 1;
    }

    private static double GetDouble(JsonElement element, string propertyName)
        => GetDoubleNullable(element, propertyName) ?? 0;

    private static double? GetDoubleNullable(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var prop)) return null;
        if (prop.ValueKind == JsonValueKind.Number && prop.TryGetDouble(out var value)) return value;
        if (prop.ValueKind == JsonValueKind.String && double.TryParse(prop.GetString(), out value)) return value;
        return null;
    }

    private static string RequireString(JsonElement parameters, string name)
    {
        return JsonHelpers.GetString(parameters, name) is { Length: > 0 } value
            ? value
            : throw new InvalidOperationException($"Missing required field: {name}");
    }

    private sealed class UsageStatsAccumulator
    {
        public double TotalInput { get; set; }
        public double TotalOutput { get; set; }
        public double TotalCacheCreation { get; set; }
        public double TotalCacheRead { get; set; }
        public double TotalReasoning { get; set; }
        public double TotalDurationMs { get; set; }
        public int RequestCount { get; set; }
        public int AssistantReplies { get; set; }
        public long? FirstCreatedAt { get; set; }
        public long? LastCreatedAt { get; set; }
    }
}
