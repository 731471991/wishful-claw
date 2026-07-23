using System.Buffers;
using System.Diagnostics;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// OpenAI-compatible chat provider (openai-chat protocol).
/// SSE streaming, reasoning_content support, tool call parsing.
/// Full implementation in step 5.
/// </summary>
internal static class OpenAIChatProvider
{
    private static readonly HttpClient Http = new(new HttpClientHandler
    {
        ServerCertificateCustomValidationCallback = (_, _, _, _) => true
    })
    {
        Timeout = TimeSpan.FromMinutes(5)
    };

    private static readonly JsonWriterOptions WriterOptions = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public static async Task<AgentRuntimeProviderTurnResult> ExecuteTurnAsync(
        JsonElement parameters,
        JsonElement provider,
        List<AgentRuntimeChatMessage> conversation,
        AgentRuntimeRunState state,
        IWorkerRequestContext context)
    {
        var model = JsonHelpers.GetString(provider, "model") ?? string.Empty;
        var baseUrl = (JsonHelpers.GetString(provider, "baseUrl") ?? "https://api.openai.com/v1")
            .Trim()
            .TrimEnd('/');
        var url = $"{baseUrl}/chat/completions";
        var body = BuildRequestBody(parameters, provider, conversation);
        var debugHeaders = BuildDebugHeaders(provider);

        // Emit request_debug event
        await AgentRuntimeTools.EmitAsync(
            state, context,
            new AgentRuntimeStreamEvent(
                "request_debug",
                DebugInfo: new AgentRuntimeRequestDebugInfo(
                    url, "POST", debugHeaders, body,
                    DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                    JsonHelpers.GetString(provider, "providerId"),
                    JsonHelpers.GetString(provider, "providerBuiltinId"),
                    model)));

        using var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");
        ApplyHeaders(request, provider, JsonHelpers.GetString(provider, "apiKey") ?? string.Empty);

        var startedAt = Stopwatch.GetTimestamp();
        long? firstTokenMs = null;
        var estimatedOutputTokens = 0;
        AgentRuntimeTokenUsage? finalUsage = null;
        var finalStopReason = "stop";
        var assistantText = new StringBuilder();
        var toolBuffers = new Dictionary<int, ToolCallBuffer>();
        var toolCalls = new List<AgentRuntimeNativeToolCall>();

        using var response = await Http.SendAsync(
            request, HttpCompletionOption.ResponseHeadersRead, state.CancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync(state.CancellationToken);
            throw new InvalidOperationException(
                $"OpenAI-compatible chat request failed HTTP {(int)response.StatusCode}: {errorBody}");
        }

        await using var responseStream = await response.Content.ReadAsStreamAsync(state.CancellationToken);
        using var reader = new StreamReader(responseStream, System.Text.Encoding.UTF8);
        var dataBuilder = new StringBuilder();
        var rawResponseBuilder = new StringBuilder();
        var sawSsePayload = false;
        string? line;

        while ((line = await reader.ReadLineAsync(state.CancellationToken)) is not null)
        {
            if (state.CancellationToken.IsCancellationRequested)
            {
                break;
            }

            if (line.Length == 0)
            {
                if (dataBuilder.Length > 0)
                {
                    var shouldStop = await ProcessSseDataAsync(
                        dataBuilder.ToString(),
                        toolBuffers, toolCalls, assistantText,
                        state, context, startedAt,
                        value => firstTokenMs ??= value,
                        value => estimatedOutputTokens += value,
                        value => finalUsage = value,
                        value => finalStopReason = value);
                    dataBuilder.Clear();
                    sawSsePayload = true;
                    if (shouldStop) break;
                }
                continue;
            }

            if (line.StartsWith("data:", StringComparison.Ordinal))
            {
                if (dataBuilder.Length > 0) dataBuilder.Append('\n');
                dataBuilder.Append(line[5..].TrimStart());
                sawSsePayload = true;
                continue;
            }

            if (!sawSsePayload && !line.StartsWith("event:", StringComparison.Ordinal))
            {
                if (rawResponseBuilder.Length > 0) rawResponseBuilder.Append('\n');
                rawResponseBuilder.Append(line);
            }
        }

        if (dataBuilder.Length > 0)
        {
            await ProcessSseDataAsync(
                dataBuilder.ToString(),
                toolBuffers, toolCalls, assistantText,
                state, context, startedAt,
                value => firstTokenMs ??= value,
                value => estimatedOutputTokens += value,
                value => finalUsage = value,
                value => finalStopReason = value);
        }
        else if (!sawSsePayload && rawResponseBuilder.Length > 0)
        {
            await ProcessJsonResponseAsync(
                rawResponseBuilder.ToString(),
                toolCalls, assistantText,
                state, context, startedAt,
                value => firstTokenMs ??= value,
                value => estimatedOutputTokens += value,
                value => finalUsage = value,
                value => finalStopReason = value);
        }

        await FlushRemainingToolBuffersAsync(toolBuffers, toolCalls, state, context);

        var totalMs = AgentLoop.ElapsedMs(startedAt);
        await AgentRuntimeTools.EmitAsync(
            state, context,
            new AgentRuntimeStreamEvent(
                "message_end",
                StopReason: finalStopReason,
                Usage: finalUsage,
                Timing: new AgentRuntimeRequestTiming(
                    totalMs, firstTokenMs,
                    AgentLoop.ComputeTps(finalUsage?.OutputTokens ?? estimatedOutputTokens, firstTokenMs, totalMs))));

        var assistantToolUses = toolCalls
            .Select(call => new AgentRuntimeChatToolUse(call.Id, call.Name, call.Input, call.ExtraContent))
            .ToList();

        return new AgentRuntimeProviderTurnResult(
            new AgentRuntimeChatMessage("assistant", assistantText.ToString(), assistantToolUses, []),
            toolCalls,
            finalStopReason,
            finalUsage);
    }

    // ── Request body building ──

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

        writer.WritePropertyName("tools");
        writer.WriteStartArray();
        foreach (var tool in tools.EnumerateArray())
        {
            if (tool.ValueKind != JsonValueKind.Object)
                continue;

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

    // ── Headers ──

    private static void ApplyHeaders(HttpRequestMessage request, JsonElement provider, string apiKey)
    {
        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiKey);
        ApiUserAgent.Apply(request, provider);

        if (JsonHelpers.GetString(provider, "organization") is { Length: > 0 } organization)
        {
            request.Headers.TryAddWithoutValidation("OpenAI-Organization", organization);
        }
        if (JsonHelpers.GetString(provider, "project") is { Length: > 0 } project)
        {
            request.Headers.TryAddWithoutValidation("OpenAI-Project", project);
        }

        ProviderRequestOverrides.ApplyHttpHeaderOverrides(request, provider);
        ApiUserAgent.Ensure(request, provider);
    }

    private static IReadOnlyDictionary<string, string> BuildDebugHeaders(JsonElement provider)
    {
        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["Content-Type"] = "application/json",
            ["Authorization"] = "Bearer ***"
        };
        ApiUserAgent.ApplyDebug(headers, provider);
        ProviderRequestOverrides.ApplyDebugHeaderOverrides(headers, provider);
        ApiUserAgent.EnsureDebug(headers, provider);
        return headers;
    }

    // ── SSE processing ──

    private static async Task<bool> ProcessSseDataAsync(
        string data,
        Dictionary<int, ToolCallBuffer> toolBuffers,
        List<AgentRuntimeNativeToolCall> completedToolCalls,
        StringBuilder assistantText,
        AgentRuntimeRunState state,
        IWorkerRequestContext context,
        long startedAt,
        Action<long> markFirstTokenMs,
        Action<int> addEstimatedOutputTokens,
        Action<AgentRuntimeTokenUsage> setUsage,
        Action<string> setStopReason)
    {
        if (data == "[DONE]")
        {
            return true;
        }

        using var document = JsonDocument.Parse(data);
        var root = document.RootElement;

        if (root.TryGetProperty("usage", out var usageElement) &&
            TryReadUsage(usageElement, out var usage))
        {
            setUsage(usage);
        }

        var choice = TryGetFirstChoice(root);
        if (!choice.HasValue) return false;

        var choiceValue = choice.Value;
        if (choiceValue.TryGetProperty("delta", out var delta))
        {
            var reasoning = AgentLoop.ReadString(delta, "reasoning_content") ??
                AgentLoop.ReadString(delta, "reasoning");
            if (!string.IsNullOrEmpty(reasoning))
            {
                markFirstTokenMs(AgentLoop.ElapsedMs(startedAt));
                await AgentRuntimeTools.EmitAsync(
                    state, context,
                    new AgentRuntimeStreamEvent("thinking_delta", Thinking: reasoning));
            }

            var text = AgentLoop.ReadString(delta, "content");
            if (!string.IsNullOrEmpty(text))
            {
                markFirstTokenMs(AgentLoop.ElapsedMs(startedAt));
                addEstimatedOutputTokens(AgentLoop.EstimateTokenCount(text));
                assistantText.Append(text);
                await AgentRuntimeTools.EmitAsync(
                    state, context,
                    new AgentRuntimeStreamEvent("text_delta", Text: text));
            }

            if (delta.TryGetProperty("tool_calls", out var toolCallsElement) &&
                toolCallsElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var fragment in toolCallsElement.EnumerateArray())
                {
                    await ProcessToolCallFragmentAsync(fragment, toolBuffers, state, context);
                }
            }
        }

        var finishReason = AgentLoop.ReadString(choiceValue, "finish_reason");
        if (string.IsNullOrEmpty(finishReason)) return false;

        setStopReason(finishReason);
        if (finishReason is "tool_calls" or "function_call")
        {
            await FlushRemainingToolBuffersAsync(toolBuffers, completedToolCalls, state, context);
            return true;
        }

        if (toolBuffers.Count > 0)
        {
            await FlushRemainingToolBuffersAsync(toolBuffers, completedToolCalls, state, context);
        }

        return finishReason is "stop" or "length" or "content_filter";
    }

    private static async Task ProcessJsonResponseAsync(
        string payload,
        List<AgentRuntimeNativeToolCall> completedToolCalls,
        StringBuilder assistantText,
        AgentRuntimeRunState state,
        IWorkerRequestContext context,
        long startedAt,
        Action<long> markFirstTokenMs,
        Action<int> addEstimatedOutputTokens,
        Action<AgentRuntimeTokenUsage> setUsage,
        Action<string> setStopReason)
    {
        using var document = JsonDocument.Parse(payload);
        var root = document.RootElement;

        if (root.TryGetProperty("usage", out var usageElement) &&
            TryReadUsage(usageElement, out var usage))
        {
            setUsage(usage);
        }

        var choice = TryGetFirstChoice(root);
        if (!choice.HasValue) return;

        var choiceValue = choice.Value;
        if (choiceValue.TryGetProperty("message", out var message) &&
            message.ValueKind == JsonValueKind.Object)
        {
            var reasoning = AgentLoop.ReadString(message, "reasoning_content") ??
                AgentLoop.ReadString(message, "reasoning");
            if (!string.IsNullOrEmpty(reasoning))
            {
                markFirstTokenMs(AgentLoop.ElapsedMs(startedAt));
                await AgentRuntimeTools.EmitAsync(
                    state, context,
                    new AgentRuntimeStreamEvent("thinking_delta", Thinking: reasoning));
            }

            var text = ReadMessageContentText(message);
            if (!string.IsNullOrEmpty(text))
            {
                markFirstTokenMs(AgentLoop.ElapsedMs(startedAt));
                addEstimatedOutputTokens(AgentLoop.EstimateTokenCount(text));
                assistantText.Append(text);
                await AgentRuntimeTools.EmitAsync(
                    state, context,
                    new AgentRuntimeStreamEvent("text_delta", Text: text));
            }

            if (message.TryGetProperty("tool_calls", out var toolCallsElement) &&
                toolCallsElement.ValueKind == JsonValueKind.Array)
            {
                foreach (var toolCallElement in toolCallsElement.EnumerateArray())
                {
                    if (TryCreateCompletedToolCall(toolCallElement, out var toolCall))
                    {
                        completedToolCalls.Add(toolCall);
                        await AgentRuntimeTools.EmitAsync(
                            state, context,
                            new AgentRuntimeStreamEvent(
                                "tool_use_streaming_start",
                                ToolCallId: toolCall.Id,
                                ToolName: toolCall.Name));
                        await AgentRuntimeTools.EmitAsync(
                            state, context,
                            new AgentRuntimeStreamEvent(
                                "tool_use_generated",
                                ToolCallId: toolCall.Id,
                                ToolUseBlock: new AgentRuntimeToolUseBlock(toolCall.Id, toolCall.Name, toolCall.Input)));
                    }
                }
            }
        }

        setStopReason(AgentLoop.ReadString(choiceValue, "finish_reason") ?? "stop");
    }

    private static async Task ProcessToolCallFragmentAsync(
        JsonElement fragment,
        Dictionary<int, ToolCallBuffer> toolBuffers,
        AgentRuntimeRunState state,
        IWorkerRequestContext context)
    {
        var index = JsonHelpers.GetInt(fragment, "index", toolBuffers.Count);
        if (!toolBuffers.TryGetValue(index, out var buffer))
        {
            buffer = new ToolCallBuffer(index);
            toolBuffers[index] = buffer;
        }

        if (JsonHelpers.GetString(fragment, "id") is { Length: > 0 } id && string.IsNullOrEmpty(buffer.Id))
        {
            buffer.Id = id;
        }

        string? argumentsDelta = null;
        if (fragment.TryGetProperty("function", out var function) &&
            function.ValueKind == JsonValueKind.Object)
        {
            if (JsonHelpers.GetString(function, "name") is { Length: > 0 } name)
            {
                buffer.Name = name;
            }
            argumentsDelta = JsonHelpers.GetString(function, "arguments");
            if (argumentsDelta is not null)
            {
                buffer.Arguments.Append(argumentsDelta);
            }
        }

        if (!buffer.Started && !string.IsNullOrEmpty(buffer.Id) && !string.IsNullOrEmpty(buffer.Name))
        {
            buffer.Started = true;
            await AgentRuntimeTools.EmitAsync(
                state, context,
                new AgentRuntimeStreamEvent(
                    "tool_use_streaming_start",
                    ToolCallId: buffer.Id,
                    ToolName: buffer.Name));
        }

        // Emit args delta after streaming_start so frontend has the tool call entry
        if (buffer.Started && argumentsDelta is { Length: > 0 })
        {
            await AgentRuntimeTools.EmitAsync(
                state, context,
                new AgentRuntimeStreamEvent(
                    "tool_use_args_delta",
                    ToolCallId: buffer.Id,
                    PartialInput: JsonSerializer.SerializeToElement(argumentsDelta)));
        }
    }

    private static async Task FlushRemainingToolBuffersAsync(
        Dictionary<int, ToolCallBuffer> toolBuffers,
        List<AgentRuntimeNativeToolCall> completedToolCalls,
        AgentRuntimeRunState state,
        IWorkerRequestContext context)
    {
        foreach (var buffer in toolBuffers.Values.OrderBy(item => item.Index))
        {
            var id = string.IsNullOrEmpty(buffer.Id)
                ? $"call_{buffer.Index}_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}"
                : buffer.Id;
            var name = buffer.Name;
            var input = AgentLoop.TryParseJsonObject(buffer.Arguments.ToString(), out var parsedInput)
                ? parsedInput
                : AgentRuntimeProviderSupport.CreateEmptyObjectElement();
            completedToolCalls.Add(new AgentRuntimeNativeToolCall(id, name, input));
            await AgentRuntimeTools.EmitAsync(
                state, context,
                new AgentRuntimeStreamEvent(
                    "tool_use_generated",
                    ToolCallId: id,
                    ToolUseBlock: new AgentRuntimeToolUseBlock(id, name, input)));
        }
        toolBuffers.Clear();
    }

    // ── Usage parsing ──

    private static JsonElement? TryGetFirstChoice(JsonElement root)
    {
        if (!root.TryGetProperty("choices", out var choices) ||
            choices.ValueKind != JsonValueKind.Array ||
            choices.GetArrayLength() == 0)
        {
            return null;
        }
        return choices[0];
    }

    private static string? ReadMessageContentText(JsonElement message)
    {
        if (!message.TryGetProperty("content", out var content)) return null;
        if (content.ValueKind == JsonValueKind.String) return content.GetString();
        if (content.ValueKind != JsonValueKind.Array) return null;

        var builder = new StringBuilder();
        foreach (var block in content.EnumerateArray())
        {
            if (block.ValueKind != JsonValueKind.Object) continue;
            var text = AgentLoop.ReadString(block, "text");
            if (string.IsNullOrEmpty(text)) continue;
            if (builder.Length > 0) builder.Append('\n');
            builder.Append(text);
        }
        return builder.Length > 0 ? builder.ToString() : null;
    }

    private static bool TryCreateCompletedToolCall(JsonElement toolCallElement, out AgentRuntimeNativeToolCall toolCall)
    {
        toolCall = default!;
        if (toolCallElement.ValueKind != JsonValueKind.Object) return false;

        var id = AgentLoop.ReadString(toolCallElement, "id");
        if (!toolCallElement.TryGetProperty("function", out var function) ||
            function.ValueKind != JsonValueKind.Object) return false;

        var name = AgentLoop.ReadString(function, "name");
        if (string.IsNullOrWhiteSpace(name)) return false;

        var arguments = AgentLoop.ReadString(function, "arguments");
        var input = AgentLoop.TryParseJsonObject(arguments ?? string.Empty, out var parsedInput)
            ? parsedInput
            : AgentRuntimeProviderSupport.CreateEmptyObjectElement();
        toolCall = new AgentRuntimeNativeToolCall(
            string.IsNullOrWhiteSpace(id) ? $"call_{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}" : id,
            name, input);
        return true;
    }

    private static bool TryReadUsage(JsonElement usage, out AgentRuntimeTokenUsage tokenUsage)
    {
        if (usage.ValueKind != JsonValueKind.Object)
        {
            tokenUsage = default!;
            return false;
        }

        var inputTokens = AgentLoop.ReadInt(usage, "prompt_tokens");
        var outputTokens = AgentLoop.ReadInt(usage, "completion_tokens");
        var cachedTokens = ReadFirstPositiveInt(usage, "cached_tokens", "cache_read_tokens", "cache_read_input_tokens", "cached_input_tokens");
        var cacheWriteTokens = ReadFirstPositiveInt(usage, "cache_write_tokens", "cache_write_input_tokens", "cache_creation_tokens", "cache_creation_input_tokens");
        var reasoningTokens = ReadFirstPositiveInt(usage, "reasoning_tokens");

        // Check nested details objects
        foreach (var detailsName in new[] { "prompt_tokens_details", "input_tokens_details" })
        {
            if (usage.TryGetProperty(detailsName, out var details))
            {
                cachedTokens = cachedTokens > 0 ? cachedTokens :
                    ReadFirstPositiveInt(details, "cached_tokens", "cache_read_tokens", "cache_read_input_tokens", "cached_input_tokens");
                cacheWriteTokens = cacheWriteTokens > 0 ? cacheWriteTokens :
                    ReadFirstPositiveInt(details, "cache_write_tokens", "cache_write_input_tokens", "cache_creation_tokens", "cache_creation_input_tokens");
            }
        }

        foreach (var detailsName in new[] { "completion_tokens_details", "output_tokens_details" })
        {
            if (usage.TryGetProperty(detailsName, out var details))
            {
                reasoningTokens = reasoningTokens > 0 ? reasoningTokens :
                    ReadFirstPositiveInt(details, "reasoning_tokens");
            }
        }

        var billableInputTokens = cachedTokens > 0 || cacheWriteTokens > 0
            ? Math.Max(0, inputTokens - cachedTokens - cacheWriteTokens)
            : (int?)null;
        var cacheReadRatio = inputTokens > 0 && cachedTokens > 0
            ? Math.Min(1, cachedTokens / (double)inputTokens)
            : (double?)null;

        tokenUsage = new AgentRuntimeTokenUsage(
            inputTokens, outputTokens,
            billableInputTokens,
            cachedTokens > 0 ? cachedTokens : null,
            reasoningTokens > 0 ? reasoningTokens : null,
            inputTokens,
            CacheCreationTokens: cacheWriteTokens > 0 ? cacheWriteTokens : null,
            CacheReadRatio: cacheReadRatio);
        return inputTokens > 0 || outputTokens > 0;
    }

    private static int ReadFirstPositiveInt(JsonElement element, params string[] propertyNames)
    {
        foreach (var propertyName in propertyNames)
        {
            var value = AgentLoop.ReadInt(element, propertyName);
            if (value > 0) return value;
        }
        return 0;
    }

    // ── Tool call buffer ──

    private sealed class ToolCallBuffer(int index)
    {
        public int Index { get; } = index;
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public StringBuilder Arguments { get; } = new();
        public bool Started { get; set; }
    }
}
