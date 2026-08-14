using System.Buffers;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent;

/// <summary>
/// Request body builder for the OpenAI Responses API provider.
/// Ported from OpenCowork AgentRuntimeOpenAIResponsesInputWriter.cs (simplified —
/// no prompt cache, sanitize replay, previous_response_id, content_blocks,
/// computer use, image generation, or web search).
/// </summary>
internal static partial class OpenAIResponsesProvider
{
    private static readonly JsonWriterOptions WriterOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private static string BuildRequestBody(
        JsonElement parameters,
        JsonElement provider,
        IReadOnlyList<AgentRuntimeChatMessage> conversation)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer, WriterOptions))
        {
            var omitted = ProviderRequestOverrides.GetOmittedBodyKeys(provider);
            writer.WriteStartObject();
            if (!omitted.Contains("model"))
            {
                writer.WriteString("model", JsonHelpers.GetString(provider, "model") ?? string.Empty);
            }
            if (!omitted.Contains("input"))
            {
                writer.WritePropertyName("input");
                WriteResponsesInput(writer, provider, conversation);
            }
            if (!omitted.Contains("stream"))
            {
                writer.WriteBoolean("stream", true);
            }
            if (!omitted.Contains("tools"))
            {
                WriteResponsesTools(writer, parameters);
            }

            if (!omitted.Contains("temperature") &&
                JsonHelpers.GetDoubleNullable(provider, "temperature") is { } temperature)
            {
                writer.WriteNumber("temperature", temperature);
            }
            if (!omitted.Contains("max_output_tokens") &&
                JsonHelpers.GetIntNullable(provider, "maxTokens") is { } maxTokens && maxTokens > 0)
            {
                writer.WriteNumber("max_output_tokens", maxTokens);
            }
            if (!omitted.Contains("service_tier") &&
                JsonHelpers.GetString(provider, "serviceTier") is { Length: > 0 } serviceTier)
            {
                writer.WriteString("service_tier", serviceTier);
            }

            WriteResponsesThinkingConfig(writer, provider, omitted);
            ProviderRequestOverrides.WriteBodyOverrides(writer, provider, omitted);
            writer.WriteEndObject();
        }
        return Encoding.UTF8.GetString(buffer.WrittenSpan);
    }

    private static void WriteResponsesInput(
        Utf8JsonWriter writer,
        JsonElement provider,
        IReadOnlyList<AgentRuntimeChatMessage> conversation)
    {
        writer.WriteStartArray();
        if (JsonHelpers.GetString(provider, "systemPrompt") is { Length: > 0 } systemPrompt)
        {
            writer.WriteStartObject();
            writer.WriteString("type", "message");
            writer.WriteString("role", "developer");
            writer.WriteString("content", systemPrompt);
            writer.WriteEndObject();
        }

        for (var index = 0; index < conversation.Count; index++)
        {
            var message = conversation[index];
            if (message.Role == "system")
            {
                continue;
            }

            foreach (var toolResult in message.ToolResults)
            {
                WriteResponsesToolResult(writer, toolResult);
            }

            if (!string.IsNullOrWhiteSpace(message.Text))
            {
                var role = message.Role == "assistant" ? "assistant" : "user";
                WriteResponsesTextMessage(writer, role, message.Text);
            }

            foreach (var toolUse in message.ToolUses)
            {
                WriteResponsesToolUse(writer, toolUse);
            }
        }
        writer.WriteEndArray();
    }

    private static void WriteResponsesTextMessage(
        Utf8JsonWriter writer,
        string role,
        string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return;
        }
        writer.WriteStartObject();
        writer.WriteString("type", "message");
        writer.WriteString("role", role);
        writer.WriteString("content", text);
        writer.WriteEndObject();
    }

    private static void WriteResponsesToolResult(Utf8JsonWriter writer, AgentRuntimeToolResult toolResult)
    {
        writer.WriteStartObject();
        writer.WriteString("type", "function_call_output");
        writer.WriteString("call_id", toolResult.ToolUseId);
        writer.WriteString("output", ToolResultToString(toolResult.Content));
        writer.WriteEndObject();
    }

    private static void WriteResponsesToolUse(Utf8JsonWriter writer, AgentRuntimeChatToolUse toolUse)
    {
        writer.WriteStartObject();
        writer.WriteString("type", "function_call");
        writer.WriteString("call_id", toolUse.Id);
        writer.WriteString("name", toolUse.Name);
        writer.WriteString("arguments", toolUse.Input.GetRawText());
        writer.WriteString("status", "completed");
        writer.WriteEndObject();
    }

    private static void WriteResponsesThinkingConfig(
        Utf8JsonWriter writer,
        JsonElement provider,
        HashSet<string> omitted)
    {
        if (!provider.TryGetProperty("thinkingConfig", out var thinkingConfig) ||
            thinkingConfig.ValueKind != JsonValueKind.Object)
        {
            if (!omitted.Contains("reasoning") &&
                JsonHelpers.GetString(provider, "responseSummary") is { Length: > 0 } summaryValue)
            {
                writer.WritePropertyName("reasoning");
                writer.WriteStartObject();
                writer.WriteString("summary", summaryValue);
                writer.WriteEndObject();
            }
            return;
        }

        var thinkingEnabled = JsonHelpers.GetBool(provider, "thinkingEnabled", false);
        var propertyName = thinkingEnabled ? "bodyParams" : "disabledBodyParams";
        if (thinkingConfig.TryGetProperty(propertyName, out var bodyParams) &&
            bodyParams.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in bodyParams.EnumerateObject())
            {
                if (!omitted.Contains(property.Name) &&
                    property.Name is not ("reasoning" or "include"))
                {
                    property.WriteTo(writer);
                }
            }
        }

        if (!thinkingEnabled || omitted.Contains("reasoning"))
        {
            return;
        }

        var hasReasoning = false;
        if (thinkingConfig.TryGetProperty("bodyParams", out var enabledBodyParams) &&
            enabledBodyParams.ValueKind == JsonValueKind.Object &&
            enabledBodyParams.TryGetProperty("reasoning", out var existingReasoning) &&
            existingReasoning.ValueKind == JsonValueKind.Object)
        {
            hasReasoning = true;
            writer.WritePropertyName("reasoning");
            writer.WriteStartObject();
            foreach (var property in existingReasoning.EnumerateObject())
            {
                property.WriteTo(writer);
            }
        }
        else if (JsonHelpers.GetString(provider, "responseSummary") is { Length: > 0 } ||
                 JsonHelpers.GetString(provider, "reasoningEffort") is { Length: > 0 })
        {
            hasReasoning = true;
            writer.WritePropertyName("reasoning");
            writer.WriteStartObject();
        }

        if (!hasReasoning)
        {
            return;
        }

        if (JsonHelpers.GetString(provider, "reasoningEffort") is { Length: > 0 } reasoningEffort &&
            JsonHelpers.ResolveEffectiveReasoningEffort(reasoningEffort, thinkingConfig)
                is { Length: > 0 } effectiveEffort)
        {
            writer.WriteString("effort", effectiveEffort);
        }
        if (JsonHelpers.GetString(provider, "responseSummary") is { Length: > 0 } summary)
        {
            writer.WriteString("summary", summary);
        }
        writer.WriteEndObject();
    }

    private static void WriteResponsesTools(Utf8JsonWriter writer, JsonElement parameters)
    {
        if (!TryGetTools(parameters, out var tools))
        {
            return;
        }
        writer.WritePropertyName("tools");
        writer.WriteStartArray();
        foreach (var tool in tools.EnumerateArray())
        {
            var name = JsonHelpers.GetString(tool, "name");
            if (string.IsNullOrWhiteSpace(name))
            {
                continue;
            }

            writer.WriteStartObject();
            writer.WriteString("type", "function");
            writer.WriteString("name", name);
            writer.WriteString("description", JsonHelpers.GetString(tool, "description") ?? string.Empty);
            writer.WritePropertyName("parameters");
            WriteToolSchema(writer, tool);
            writer.WriteBoolean("strict", false);
            writer.WriteEndObject();
        }
        writer.WriteEndArray();
    }

    private static bool TryGetTools(JsonElement parameters, out JsonElement tools)
    {
        if (parameters.ValueKind == JsonValueKind.Object &&
            parameters.TryGetProperty("tools", out tools) &&
            tools.ValueKind == JsonValueKind.Array &&
            tools.GetArrayLength() > 0)
        {
            return true;
        }
        tools = default;
        return false;
    }

    private static void WriteToolSchema(Utf8JsonWriter writer, JsonElement tool)
    {
        if (tool.TryGetProperty("inputSchema", out var schema))
        {
            schema.WriteTo(writer);
            return;
        }
        writer.WriteStartObject();
        writer.WriteString("type", "object");
        writer.WriteStartObject("properties");
        writer.WriteEndObject();
        writer.WriteEndObject();
    }
}
