using System.Buffers;
using System.Diagnostics;
using System.Text.Json;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent;

/// <summary>
/// JSON parsing helpers and timing utilities for AgentLoop.
/// </summary>
internal static partial class AgentLoop
{
    // ── JSON helper methods ──

    /// <summary>
    /// Replaces or adds the systemPrompt field in the provider JSON element.
    /// </summary>
    internal static JsonElement InjectSystemPrompt(JsonElement provider, string systemPrompt)
    {
        if (string.IsNullOrWhiteSpace(systemPrompt)) return provider;

        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
        {
            writer.WriteStartObject();
            var hasSystemPrompt = false;
            foreach (var prop in provider.EnumerateObject())
            {
                if (prop.NameEquals("systemPrompt"))
                {
                    writer.WriteString("systemPrompt", systemPrompt);
                    hasSystemPrompt = true;
                }
                else
                {
                    prop.WriteTo(writer);
                }
            }
            if (!hasSystemPrompt)
            {
                writer.WriteString("systemPrompt", systemPrompt);
            }
            writer.WriteEndObject();
        }
        using var doc = JsonDocument.Parse(buffer.WrittenMemory);
        return doc.RootElement.Clone();
    }

    internal static JsonElement GetObject(JsonElement element, string propertyName)
    {
        if (element.ValueKind == JsonValueKind.Object &&
            element.TryGetProperty(propertyName, out var property) &&
            property.ValueKind == JsonValueKind.Object)
        {
            return property;
        }
        return default;
    }

    internal static string? ReadString(JsonElement element, string propertyName)
    {
        if (element.ValueKind == JsonValueKind.Object &&
            element.TryGetProperty(propertyName, out var property) &&
            property.ValueKind == JsonValueKind.String)
        {
            return property.GetString();
        }
        return null;
    }

    internal static int ReadInt(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object ||
            !element.TryGetProperty(propertyName, out var property))
        {
            return 0;
        }
        if (property.ValueKind == JsonValueKind.Number &&
            property.TryGetInt64(out var longValue))
        {
            return longValue > int.MaxValue ? int.MaxValue : (int)Math.Max(0, longValue);
        }
        if (property.ValueKind == JsonValueKind.String &&
            long.TryParse(property.GetString(), out longValue))
        {
            return longValue > int.MaxValue ? int.MaxValue : (int)Math.Max(0, longValue);
        }
        return 0;
    }

    internal static bool TryParseJsonObject(string value, out JsonElement element)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            element = AgentRuntimeProviderSupport.CreateEmptyObjectElement();
            return false;
        }

        try
        {
            using var document = JsonDocument.Parse(value);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                element = AgentRuntimeProviderSupport.CreateEmptyObjectElement();
                return false;
            }
            element = document.RootElement.Clone();
            return true;
        }
        catch (JsonException)
        {
            element = AgentRuntimeProviderSupport.CreateEmptyObjectElement();
            return false;
        }
    }

    // ── Timing helpers ──

    internal static long ElapsedMs(long startedAt)
    {
        return (long)Math.Round(Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds);
    }

    internal static long NowMs()
    {
        return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    internal static string NewMessageId()
    {
        return $"wc_{Guid.NewGuid():N}";
    }

    internal static int EstimateTokenCount(string text)
    {
        return string.IsNullOrWhiteSpace(text) ? 0 : Math.Max(1, text.Length / 4);
    }

    internal static double? ComputeTps(int outputTokens, long? firstTokenMs, long completedMs)
    {
        if (!firstTokenMs.HasValue || outputTokens <= 0)
        {
            return null;
        }
        var durationMs = completedMs - firstTokenMs.Value;
        return durationMs <= 0 ? null : outputTokens / (durationMs / 1000.0);
    }

    internal static bool IsReasoningModel(string model)
    {
        return model.StartsWith("o1", StringComparison.OrdinalIgnoreCase) ||
            model.StartsWith("o2", StringComparison.OrdinalIgnoreCase) ||
            model.StartsWith("o3", StringComparison.OrdinalIgnoreCase) ||
            model.StartsWith("o4", StringComparison.OrdinalIgnoreCase);
    }

    // ── Session helpers ──

    /// <summary>
    /// Formats a sessionId for logging, masking empty values.
    /// </summary>
    internal static string FormatSessionId(string? sessionId)
    {
        return string.IsNullOrEmpty(sessionId) ? "<empty>" : sessionId;
    }

    // ── Transient injection helpers ──

    /// <summary>
    /// Injects current timestamp as a transient prefix to the last user message.
    /// This stays OUT of the system prompt to preserve prefix cache stability.
    /// The agent gets fresh time context every turn without churning the cached prefix.
    /// Design follows Reasonix's transient turn-injection pattern.
    /// </summary>
    internal static void InjectTimestampPrefix(List<AgentRuntimeChatMessage> conversation)
    {
        // Find the last user message (the current turn's input)
        for (var i = conversation.Count - 1; i >= 0; i--)
        {
            if (conversation[i].Role == "user" && conversation[i].ToolResults.Count == 0)
            {
                var now = DateTimeOffset.Now;
                var timestampBlock = $"\n\n<current_time>\n{now:yyyy-MM-dd HH:mm zzz} ({now:dddd})\n</current_time>";
                conversation[i] = conversation[i] with { Text = conversation[i].Text + timestampBlock };
                break;
            }
        }
    }

    /// <summary>
    /// Drains pending memory-update notes and injects them as a transient
    /// prefix to the last user message. Like InjectTimestampPrefix, this stays
    /// OUT of the system prompt to preserve prefix cache stability.
    /// Design follows Reasonix's turn-tail note pattern (memory.Queue).
    /// </summary>
    internal static void InjectMemoryUpdatePrefix(List<AgentRuntimeChatMessage> conversation, string sessionId)
    {
        var notes = MemoryUpdateQueue.Drain(sessionId);
        if (notes.Count == 0) return;

        var sb = new System.Text.StringBuilder();
        sb.AppendLine("<memory-update>");
        sb.AppendLine("The following memory changes were just made and apply from now on:");
        foreach (var note in notes)
        {
            sb.Append("- ").AppendLine(note);
        }
        sb.AppendLine("\n</memory-update>");

        var block = sb.ToString();

        // Find the last user message (the current turn's input)
        for (var i = conversation.Count - 1; i >= 0; i--)
        {
            if (conversation[i].Role == "user" && conversation[i].ToolResults.Count == 0)
            {
                conversation[i] = conversation[i] with { Text = conversation[i].Text + block };
                break;
            }
        }
    }
}
