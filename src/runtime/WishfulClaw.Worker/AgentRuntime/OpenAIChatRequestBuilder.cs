using System.Buffers;
using System.Net.Http;
using System.Text.Json;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// OpenAI-compatible chat provider — request body building.
/// </summary>
internal static partial class OpenAIChatProvider
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

            if (!omitted.Contains("model"))
            {
                writer.WriteString("model", JsonHelpers.GetString(provider, "model") ?? string.Empty);
            }

            if (!omitted.Contains("messages"))
            {
                writer.WritePropertyName("messages");
                WriteMessages(writer, conversation, provider);
            }

            if (!omitted.Contains("stream"))
            {
                writer.WriteBoolean("stream", true);
            }

            if (!omitted.Contains("stream_options"))
            {
                writer.WritePropertyName("stream_options");
                writer.WriteStartObject();
                writer.WriteBoolean("include_usage", true);
                writer.WriteEndObject();
            }

            if (!omitted.Contains("tools"))
            {
                WriteTools(writer, parameters);
            }

            if (!omitted.Contains("temperature") &&
                JsonHelpers.GetDoubleNullable(provider, "temperature") is { } temperature)
            {
                writer.WriteNumber("temperature", temperature);
            }

            if (JsonHelpers.GetIntNullable(provider, "maxTokens") is { } maxTokens && maxTokens > 0)
            {
                var modelStr = JsonHelpers.GetString(provider, "model") ?? string.Empty;
                var maxTokensKey = AgentLoop.IsReasoningModel(modelStr) ? "max_completion_tokens" : "max_tokens";
                if (!omitted.Contains(maxTokensKey))
                {
                    writer.WriteNumber(maxTokensKey, maxTokens);
                }
            }

            WriteThinkingConfig(writer, provider, omitted);
            ProviderRequestOverrides.WriteBodyOverrides(writer, provider, omitted);

            writer.WriteEndObject();
        }

        return System.Text.Encoding.UTF8.GetString(buffer.WrittenSpan);
    }

    private static void WriteMessages(
        Utf8JsonWriter writer,
        IReadOnlyList<AgentRuntimeChatMessage> messages,
        JsonElement provider)
    {
        writer.WriteStartArray();

        if (JsonHelpers.GetString(provider, "systemPrompt") is { Length: > 0 } systemPrompt)
        {
            writer.WriteStartObject();
            writer.WriteString("role", "system");
            writer.WriteString("content", systemPrompt);
            writer.WriteEndObject();
        }

        foreach (var message in messages)
        {
            if (message.Role == "system") continue;

            // Tool results → role: tool messages
            foreach (var toolResult in message.ToolResults)
            {
                writer.WriteStartObject();
                writer.WriteString("role", "tool");
                writer.WriteString("tool_call_id", toolResult.ToolUseId);
                writer.WritePropertyName("content");
                if (toolResult.Content.ValueKind == JsonValueKind.String)
                {
                    writer.WriteStringValue(toolResult.Content.GetString() ?? string.Empty);
                }
                else
                {
                    writer.WriteStringValue(toolResult.Content.GetRawText());
                }
                writer.WriteEndObject();
            }

            if (message.Role == "user")
            {
                if (message.ToolResults.Count > 0 && string.IsNullOrEmpty(message.Text) && message.ToolUses.Count == 0)
                {
                    continue; // Already written as tool messages
                }

                writer.WriteStartObject();
                writer.WriteString("role", "user");
                writer.WriteString("content", message.Text);
                writer.WriteEndObject();
                continue;
            }

            if (message.Role == "assistant")
            {
                writer.WriteStartObject();
                writer.WriteString("role", "assistant");
                if (message.ToolUses.Count > 0)
                {
                    if (!string.IsNullOrEmpty(message.Text))
                    {
                        writer.WriteString("content", message.Text);
                    }
                    writer.WritePropertyName("tool_calls");
                    writer.WriteStartArray();
                    foreach (var toolUse in message.ToolUses)
                    {
                        writer.WriteStartObject();
                        writer.WriteString("id", toolUse.Id);
                        writer.WriteString("type", "function");
                        writer.WritePropertyName("function");
                        writer.WriteStartObject();
                        writer.WriteString("name", toolUse.Name);
                        writer.WriteString("arguments", toolUse.Input.GetRawText());
                        writer.WriteEndObject();
                        writer.WriteEndObject();
                    }
                    writer.WriteEndArray();
                }
                else
                {
                    writer.WriteString("content", message.Text);
                }
                writer.WriteEndObject();
                continue;
            }
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

        // Sort tools by name for stable byte ordering (prefix cache stability)
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
        foreach (var (toolName, tool) in toolList)
        {
            // Transform from { name, description, inputSchema } to OpenAI format:
            // { type: "function", function: { name, description, parameters: inputSchema } }
            // If the tool already has "type" field, it's already in the correct format.
            if (tool.TryGetProperty("type", out _) && tool.TryGetProperty("function", out _))
            {
                tool.WriteTo(writer);
                continue;
            }

            writer.WriteStartObject();
            writer.WriteString("type", "function");
            writer.WritePropertyName("function");
            writer.WriteStartObject();

            if (tool.TryGetProperty("name", out var name))
            {
                writer.WritePropertyName("name");
                name.WriteTo(writer);
            }
            if (tool.TryGetProperty("description", out var desc))
            {
                writer.WritePropertyName("description");
                desc.WriteTo(writer);
            }
            if (tool.TryGetProperty("inputSchema", out var inputSchema))
            {
                writer.WritePropertyName("parameters");
                inputSchema.WriteTo(writer);
            }

            writer.WriteEndObject(); // function
            writer.WriteEndObject(); // tool
        }
        writer.WriteEndArray();
    }

    private static void WriteThinkingConfig(Utf8JsonWriter writer, JsonElement provider, HashSet<string> omitted)
    {
        if (!provider.TryGetProperty("thinkingConfig", out var thinkingConfig) ||
            thinkingConfig.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        var reasoningEffort = JsonHelpers.GetString(thinkingConfig, "defaultReasoningEffort");
        if (string.IsNullOrEmpty(reasoningEffort)) return;

        var effectiveEffort = JsonHelpers.ResolveEffectiveReasoningEffort(reasoningEffort, thinkingConfig);
        if (string.IsNullOrEmpty(effectiveEffort)) return;

        if (!omitted.Contains("reasoning_effort"))
        {
            writer.WriteString("reasoning_effort", effectiveEffort);
        }
    }
}
