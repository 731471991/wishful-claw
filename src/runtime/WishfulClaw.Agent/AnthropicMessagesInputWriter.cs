using System.Buffers;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent;

/// <summary>
/// Anthropic Messages request body builder.
/// System prompt and tools carry cache_control breakpoints for prefix caching.
    /// No sanitizer, no validation stats.
/// </summary>
internal static partial class AnthropicMessagesProvider
{
    private static string BuildRequestBody(
        JsonElement parameters,
        JsonElement provider,
        IReadOnlyList<AgentRuntimeChatMessage> conversation)
    {
        var buffer = new ArrayBufferWriter<byte>();
        var omitted = ProviderRequestOverrides.GetOmittedBodyKeys(provider);

        using (var writer = new Utf8JsonWriter(buffer, WriterOptions))
        {
            writer.WriteStartObject();

            writer.WriteString("model", JsonHelpers.GetString(provider, "model") ?? string.Empty);

            if (!omitted.Contains("max_tokens"))
            {
                writer.WriteNumber("max_tokens", ResolveMaxTokens(provider));
            }

            // System prompt (with cache_control breakpoint for prefix caching)
            if (JsonHelpers.GetString(provider, "systemPrompt") is { Length: > 0 } systemPrompt)
            {
                writer.WritePropertyName("system");
                writer.WriteStartArray();
                writer.WriteStartObject();
                writer.WriteString("type", "text");
                writer.WriteString("text", systemPrompt);
                // cache_control: ephemeral — marks this as a cache breakpoint
                writer.WritePropertyName("cache_control");
                writer.WriteStartObject();
                writer.WriteString("type", "ephemeral");
                writer.WriteEndObject();
                writer.WriteEndObject();
                writer.WriteEndArray();
            }

            // Messages
            writer.WritePropertyName("messages");
            WriteMessages(writer, conversation);

            // Tools
            WriteTools(writer, parameters);

            writer.WriteBoolean("stream", true);

            // Thinking config
            var wroteThinking = WriteThinkingConfig(writer, provider, omitted);
            if (!wroteThinking &&
                !omitted.Contains("temperature") &&
                JsonHelpers.GetDoubleNullable(provider, "temperature") is { } temperature)
            {
                writer.WriteNumber("temperature", temperature);
            }

            ProviderRequestOverrides.WriteBodyOverrides(writer, provider, omitted);

            writer.WriteEndObject();
        }

        return Encoding.UTF8.GetString(buffer.WrittenSpan);
    }

    private static void WriteMessages(Utf8JsonWriter writer, IReadOnlyList<AgentRuntimeChatMessage> conversation)
    {
        // Pre-compute which messages will be written (filter consecutive same-role).
        var messagesToWrite = new List<AgentRuntimeChatMessage>();
        string? lastRole = null;

        foreach (var message in conversation)
        {
            if (message.Role == "system") continue;
            var role = message.Role == "assistant" ? "assistant" : "user";
            if (role == lastRole) continue;
            messagesToWrite.Add(message);
            lastRole = role;
        }

        var needsContinueMessage = lastRole == "assistant";
        var count = messagesToWrite.Count;

        writer.WriteStartArray();

        // Breakpoint strategy (max 4, we use 3):
        // 1. System prompt (added in BuildRequestBody)
        // 2. Second-to-last real message (stable conversation prefix)
        // 3. Last real message (current turn, cached for next turn)
        // When needsContinueMessage, BP goes on the last REAL message,
        // not on the synthetic "Continue." message.
        for (var i = 0; i < count; i++)
        {
            var isLastReal = i == count - 1;
            var isSecondToLast = i == count - 2;
            // BP on last real message (always)
            // BP on second-to-last message (when there are 3+ messages)
            var addBP = isLastReal || (isSecondToLast && count >= 3);
            WriteSingleMessage(writer, messagesToWrite[i], addBP);
        }

        if (needsContinueMessage)
        {
            // Write "Continue." WITHOUT cache_control breakpoint.
            // The BP is on the last real message (the assistant message),
            // which is the stable prefix that next turn will hit.
            writer.WriteStartObject();
            writer.WriteString("role", "user");
            writer.WritePropertyName("content");
            writer.WriteStartArray();
            writer.WriteStartObject();
            writer.WriteString("type", "text");
            writer.WriteString("text", "Continue.");
            writer.WriteEndObject();
            writer.WriteEndArray();
            writer.WriteEndObject();
        }

        writer.WriteEndArray();
    }

    /// <summary>
    /// Writes a single message. When <paramref name="addCacheControl"/> is true,
    /// cache_control: ephemeral is added to the last content block — this is the
    /// Reasonix-aligned breakpoint that ensures the entire conversation prefix
    /// is cached for subsequent turns.
    /// </summary>
    private static void WriteSingleMessage(Utf8JsonWriter writer, AgentRuntimeChatMessage message, bool addCacheControl)
    {
        var role = message.Role == "assistant" ? "assistant" : "user";

        writer.WriteStartObject();
        writer.WriteString("role", role);

        if (message.ToolResults.Count > 0)
        {
            writer.WritePropertyName("content");
            writer.WriteStartArray();
            for (var j = 0; j < message.ToolResults.Count; j++)
            {
                var toolResult = message.ToolResults[j];
                var isLastBlock = addCacheControl && j == message.ToolResults.Count - 1 && string.IsNullOrEmpty(message.Text);
                writer.WriteStartObject();
                writer.WriteString("type", "tool_result");
                writer.WriteString("tool_use_id", toolResult.ToolUseId);
                writer.WritePropertyName("content");
                if (toolResult.Content.ValueKind == JsonValueKind.String)
                {
                    writer.WriteStringValue(toolResult.Content.GetString() ?? string.Empty);
                }
                else
                {
                    writer.WriteStringValue(ProviderContentHelpers.ToolResultToString(toolResult.Content));
                }
                if (toolResult.IsError.HasValue)
                {
                    writer.WriteBoolean("is_error", toolResult.IsError.Value);
                }
                if (isLastBlock) WriteCacheControl(writer);
                writer.WriteEndObject();
            }
            // Also include any text
            if (!string.IsNullOrEmpty(message.Text))
            {
                writer.WriteStartObject();
                writer.WriteString("type", "text");
                writer.WriteString("text", message.Text);
                if (addCacheControl) WriteCacheControl(writer);
                writer.WriteEndObject();
            }
            writer.WriteEndArray();
        }
        else if (message.ToolUses.Count > 0)
        {
            // Assistant with tool_use blocks
            writer.WritePropertyName("content");
            writer.WriteStartArray();
            if (!string.IsNullOrEmpty(message.Text))
            {
                writer.WriteStartObject();
                writer.WriteString("type", "text");
                writer.WriteString("text", message.Text);
                writer.WriteEndObject();
            }
            for (var j = 0; j < message.ToolUses.Count; j++)
            {
                var toolUse = message.ToolUses[j];
                var isLastBlock = addCacheControl && j == message.ToolUses.Count - 1;
                writer.WriteStartObject();
                writer.WriteString("type", "tool_use");
                writer.WriteString("id", toolUse.Id);
                writer.WriteString("name", toolUse.Name);
                writer.WritePropertyName("input");
                toolUse.Input.WriteTo(writer);
                if (isLastBlock) WriteCacheControl(writer);
                writer.WriteEndObject();
            }
            writer.WriteEndArray();
        }
        else
        {
            // Simple text message
            if (addCacheControl)
            {
                // Convert to array format to attach cache_control
                writer.WritePropertyName("content");
                writer.WriteStartArray();
                writer.WriteStartObject();
                writer.WriteString("type", "text");
                writer.WriteString("text", message.Text);
                WriteCacheControl(writer);
                writer.WriteEndObject();
                writer.WriteEndArray();
            }
            else
            {
                writer.WriteString("content", message.Text);
            }
        }

        writer.WriteEndObject();
    }

    /// <summary>
    /// Writes the cache_control: ephemeral breakpoint marker.
    /// </summary>
    private static void WriteCacheControl(Utf8JsonWriter writer)
    {
        writer.WritePropertyName("cache_control");
        writer.WriteStartObject();
        writer.WriteString("type", "ephemeral");
        writer.WriteEndObject();
    }

    private static void WriteTools(Utf8JsonWriter writer, JsonElement parameters)
    {
        if (!parameters.TryGetProperty("tools", out var tools) ||
            tools.ValueKind != JsonValueKind.Array ||
            tools.GetArrayLength() == 0)
        {
            return;
        }

        // Collect and sort tools by name for stable byte ordering (prefix cache stability)
        var toolList = new List<(string name, JsonElement tool)>();
        foreach (var tool in tools.EnumerateArray())
        {
            if (tool.ValueKind != JsonValueKind.Object) continue;
            var name = tool.TryGetProperty("name", out var nameProp)
                ? nameProp.GetString() ?? ""
                : "";
            toolList.Add((name, tool));
        }
        toolList.Sort((a, b) => string.Compare(a.name, b.name, StringComparison.Ordinal));

        writer.WritePropertyName("tools");
        writer.WriteStartArray();

        // cache_control breakpoint is on the last message (not tools),
        // aligned with Reasonix pattern: system[last] + messages[last].
        foreach (var (name, tool) in toolList)
        {
            // Anthropic format: { name, description, input_schema }
            // Transform inputSchema -> input_schema if needed
            if (tool.TryGetProperty("input_schema", out _))
            {
                tool.WriteTo(writer);
                continue;
            }

            writer.WriteStartObject();
            if (tool.TryGetProperty("name", out var nameVal))
            {
                writer.WritePropertyName("name");
                nameVal.WriteTo(writer);
            }
            if (tool.TryGetProperty("description", out var desc))
            {
                writer.WritePropertyName("description");
                desc.WriteTo(writer);
            }
            if (tool.TryGetProperty("inputSchema", out var inputSchema))
            {
                writer.WritePropertyName("input_schema");
                inputSchema.WriteTo(writer);
            }
            writer.WriteEndObject();
        }
        writer.WriteEndArray();
    }

    private static bool WriteThinkingConfig(Utf8JsonWriter writer, JsonElement provider, HashSet<string> omitted)
    {
        if (!provider.TryGetProperty("thinkingConfig", out var thinkingConfig) ||
            thinkingConfig.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        var enabled = JsonHelpers.GetBool(thinkingConfig, "enabled", false);
        if (!enabled || omitted.Contains("thinking")) return false;

        var budget = JsonHelpers.GetIntNullable(thinkingConfig, "budgetTokens") ?? 10000;
        budget = Math.Max(1024, budget);

        writer.WritePropertyName("thinking");
        writer.WriteStartObject();
        writer.WriteString("type", "enabled");
        writer.WriteNumber("budget_tokens", budget);
        writer.WriteEndObject();

        // When thinking is enabled, temperature must be 1
        if (!omitted.Contains("temperature"))
        {
            writer.WriteNumber("temperature", 1);
        }

        return true;
    }

    private static int ResolveMaxTokens(JsonElement provider)
    {
        var maxTokens = JsonHelpers.GetIntNullable(provider, "maxTokens") ?? 4096;
        return maxTokens > 0 ? maxTokens : 4096;
    }
}
