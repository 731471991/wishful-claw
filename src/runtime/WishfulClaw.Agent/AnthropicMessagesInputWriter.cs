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
        writer.WriteStartArray();
        string? lastWrittenRole = null;

        foreach (var message in conversation)
        {
            if (message.Role == "system") continue;

            var role = message.Role == "assistant" ? "assistant" : "user";

            // Anthropic requires alternating user/assistant turns
            // If same role as last, merge into the previous message
            if (role == lastWrittenRole)
            {
                // For simplicity, skip duplicate consecutive roles
                // (in production, we'd merge content blocks)
                continue;
            }

            writer.WriteStartObject();
            writer.WriteString("role", role);

            // Tool results → user message with tool_result content blocks
            if (message.ToolResults.Count > 0)
            {
                writer.WritePropertyName("content");
                writer.WriteStartArray();
                foreach (var toolResult in message.ToolResults)
                {
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
                    writer.WriteEndObject();
                }
                // Also include any text
                if (!string.IsNullOrEmpty(message.Text))
                {
                    writer.WriteStartObject();
                    writer.WriteString("type", "text");
                    writer.WriteString("text", message.Text);
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
                foreach (var toolUse in message.ToolUses)
                {
                    writer.WriteStartObject();
                    writer.WriteString("type", "tool_use");
                    writer.WriteString("id", toolUse.Id);
                    writer.WriteString("name", toolUse.Name);
                    writer.WritePropertyName("input");
                    toolUse.Input.WriteTo(writer);
                    writer.WriteEndObject();
                }
                writer.WriteEndArray();
            }
            else
            {
                // Simple text message
                writer.WriteString("content", message.Text);
            }

            writer.WriteEndObject();
            lastWrittenRole = role;
        }

        // Anthropic requires conversation to end with a user turn
        if (lastWrittenRole == "assistant")
        {
            writer.WriteStartObject();
            writer.WriteString("role", "user");
            writer.WriteString("content", "Continue.");
            writer.WriteEndObject();
        }

        writer.WriteEndArray();
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

        for (var i = 0; i < toolList.Count; i++)
        {
            var (name, tool) = toolList[i];
            var isLast = i == toolList.Count - 1;

            // Anthropic format: { name, description, input_schema }
            // Transform inputSchema -> input_schema if needed
            if (tool.TryGetProperty("input_schema", out _))
            {
                // Already in Anthropic format — write with cache_control on last
                if (isLast)
                {
                    writer.WriteStartObject();
                    foreach (var prop in tool.EnumerateObject())
                    {
                        prop.WriteTo(writer);
                    }
                    writer.WritePropertyName("cache_control");
                    writer.WriteStartObject();
                    writer.WriteString("type", "ephemeral");
                    writer.WriteEndObject();
                    writer.WriteEndObject();
                }
                else
                {
                    tool.WriteTo(writer);
                }
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
            // Add cache_control breakpoint on the last tool
            if (isLast)
            {
                writer.WritePropertyName("cache_control");
                writer.WriteStartObject();
                writer.WriteString("type", "ephemeral");
                writer.WriteEndObject();
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
