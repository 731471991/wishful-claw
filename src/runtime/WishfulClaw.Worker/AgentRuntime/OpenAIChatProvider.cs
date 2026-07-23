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
/// </summary>
internal static partial class OpenAIChatProvider
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
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
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
}
