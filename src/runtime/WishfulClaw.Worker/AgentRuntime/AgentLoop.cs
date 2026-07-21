using System.Buffers;
using System.Diagnostics;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Core.Tools;
using WishfulClaw.Worker.Tools;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Agent main loop. Each iteration = one provider turn.
/// Design fused from:
/// - KodaClaw: Step abstraction (iteration = model call + optional tool execution)
/// - OpenCowork: SSE parsing, provider dispatch
/// - OpenClaw.net: TryInjectRecallAsync placeholder (iteration 6)
/// </summary>
internal static class AgentLoop
{
    private const double DefaultContextCompressionThreshold = 0.8;
    private const int DefaultContextCompressionReservedOutputTokens = 20_000;
    private const int ContextCompressionAutoBufferTokens = 13_000;

    private static readonly JsonWriterOptions WriterOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    /// <summary>
    /// Main execution loop. Called by AgentRuntimeTools.ExecuteRunAsync.
    /// </summary>
    public static async Task ExecuteLoopAsync(
        JsonElement parameters,
        AgentRuntimeRunState state,
        IWorkerRequestContext context)
    {
        var provider = GetObject(parameters, "provider");
        var providerType = JsonHelpers.GetString(provider, "type") ?? string.Empty;

        if (providerType is not ("openai-chat" or "anthropic"))
        {
            throw new InvalidOperationException(
                $"Provider type not supported yet: {providerType}. Supported: openai-chat, anthropic.");
        }

        ValidateProvider(provider);

        var wireConversation = ReadWireConversation(parameters);
        var conversation = ReadConversation(wireConversation);
        var runtimeParameters = CreateRuntimeParametersWithoutMessages(parameters);
        state.ReplaceParameters(runtimeParameters);
        parameters = runtimeParameters;
        provider = GetObject(parameters, "provider");

        var requestedMaxIterations = JsonHelpers.GetInt(parameters, "maxIterations", 1);
        var hasIterationLimit = requestedMaxIterations > 0;
        var providerTurnOnly = JsonHelpers.GetBool(parameters, "providerTurnOnly", false);
        var lastInputTokens = 0;
        var completed = false;

        WorkerLog.Debug(
            $"agent loop start provider={providerType} " +
            $"maxIterations={(hasIterationLimit ? requestedMaxIterations.ToString() : "unlimited")} " +
            $"providerTurnOnly={providerTurnOnly}");

        for (var iteration = 1; !hasIterationLimit || iteration <= requestedMaxIterations; iteration++)
        {
            // ── Cancellation check ──
            if (state.IsCancellationRequested)
            {
                await EmitLoopEndAsync(state, context, "aborted");
                return;
            }

            if (state.IsStopRequested)
            {
                completed = true;
                break;
            }

            // ── Context compression (simplified: token-based truncation) ──
            if (lastInputTokens > 0 && ShouldCompress(lastInputTokens, provider))
            {
                await AgentRuntimeTools.EmitAsync(
                    state, context,
                    new AgentRuntimeStreamEvent("context_compression_start"));

                if (state.IsCancellationRequested)
                {
                    await EmitLoopEndAsync(state, context, "aborted");
                    return;
                }

                try
                {
                    var originalCount = wireConversation.Count;
                    var (newConversation, newWireConversation) = ContextCompression.TruncateMessages(
                        conversation, wireConversation, provider);
                    if (newWireConversation.Count < originalCount)
                    {
                        conversation = newConversation;
                        wireConversation = newWireConversation;
                        await AgentRuntimeTools.EmitAsync(
                            state, context,
                            new AgentRuntimeStreamEvent(
                                "context_compressed",
                                OriginalCount: originalCount,
                                NewCount: newWireConversation.Count));
                        WorkerLog.Info(
                            $"agent context compression runId={state.RunId} " +
                            $"original={originalCount} compressed={newWireConversation.Count}");
                    }
                    lastInputTokens = 0;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    WorkerLog.Warn(
                        $"agent context compression failed runId={state.RunId} " +
                        $"error={ex.GetType().Name}: {ex.Message}");
                }
            }

            // ── Drain queued messages ──
            var injectedMessages = state.DrainQueuedMessages();
            if (injectedMessages.Count > 0)
            {
                wireConversation.AddRange(injectedMessages);
                conversation.AddRange(ReadConversation(injectedMessages));
                WorkerLog.Debug(
                    $"agent loop injected queued messages runId={state.RunId} count={injectedMessages.Count}");
            }

            // ── Iteration start ──
            await AgentRuntimeTools.EmitAsync(
                state, context,
                new AgentRuntimeStreamEvent("iteration_start", Iteration: iteration));

            if (state.IsCancellationRequested)
            {
                await EmitLoopEndAsync(state, context, "aborted");
                return;
            }

            // ── Placeholder: TryInjectRecallAsync (iteration 6 — memory recall) ──
            // await TryInjectRecallAsync(parameters, state, context, conversation);

            // ── Execute provider turn ──
            var turn = await ExecuteTurnAsync(parameters, provider, conversation, state, context);
            conversation.Add(turn.AssistantMessage);
            var assistantWireMessage = CreateAssistantWireMessage(turn.AssistantMessage, turn.Usage);
            wireConversation.Add(assistantWireMessage);

            if (turn.Usage?.ContextTokens is > 0)
            {
                lastInputTokens = turn.Usage.ContextTokens.Value;
            }

            // ── Check for tool calls ──
            if (turn.ToolCalls.Count == 0)
            {
                // No tool calls — turn is complete
                await AgentRuntimeTools.EmitAsync(
                    state, context,
                    new AgentRuntimeStreamEvent("iteration_end", StopReason: turn.StopReason));

                if (!state.TryCloseMessageQueueIfEmpty())
                {
                    continue;
                }
                completed = true;
                break;
            }

            // Tool calls present — iteration 3 does not execute tools
            if (providerTurnOnly)
            {
                await AgentRuntimeTools.EmitAsync(
                    state, context,
                    new AgentRuntimeStreamEvent("iteration_end", StopReason: turn.StopReason));
                completed = true;
                break;
            }

            // ── Tool execution (iteration 4) ──
            var workingFolder = JsonHelpers.GetString(parameters, "workingFolder");
            var toolResults = new List<AgentRuntimeToolResult>();
            var registry = ToolModuleState.Registry;

            foreach (var toolCall in turn.ToolCalls)
            {
                if (state.IsCancellationRequested)
                {
                    await EmitLoopEndAsync(state, context, "aborted");
                    return;
                }

                var startedAt = NowMs();

                await AgentRuntimeTools.EmitAsync(
                    state, context,
                    new AgentRuntimeStreamEvent(
                        "tool_call_start",
                        ToolCall: new AgentRuntimeToolCallState(
                            toolCall.Id,
                            toolCall.Name,
                            toolCall.Input,
                            "running",
                            null,
                            null,
                            false,
                            startedAt,
                            null)));
                string toolOutput;
                bool isToolError = false;

                if (registry is not null && registry.TryGetExecutor(toolCall.Name, out var executor))
                {
                    try
                    {
                        var toolContext = new ToolExecutionContext(workingFolder, state.SessionId, state.RunId, state.CancellationToken);
                        var result = await executor.ExecuteAsync(toolCall.Input, toolContext);
                        toolOutput = result.Content;
                        isToolError = result.IsError;
                    }
                    catch (OperationCanceledException)
                    {
                        throw;
                    }
                    catch (Exception ex)
                    {
                        toolOutput = $"Tool execution failed: {ex.Message}";
                        isToolError = true;
                    }
                }
                else
                {
                    toolOutput = $"Unknown tool: {toolCall.Name}";
                    isToolError = true;
                }

                var completedAt = NowMs();

                await AgentRuntimeTools.EmitAsync(
                    state, context,
                    new AgentRuntimeStreamEvent(
                        "tool_call_result",
                        ToolCallId: toolCall.Id,
                        ToolName: toolCall.Name,
                        ToolCall: new AgentRuntimeToolCallState(
                            toolCall.Id,
                            toolCall.Name,
                            toolCall.Input,
                            isToolError ? "error" : "completed",
                            AgentRuntimeProviderSupport.CreateStringElement(toolOutput),
                            isToolError ? toolOutput : null,
                            false,
                            startedAt,
                            completedAt)));

                toolResults.Add(new AgentRuntimeToolResult(
                    toolCall.Id,
                    AgentRuntimeProviderSupport.CreateStringElement(toolOutput),
                    isToolError ? true : null));

                WorkerLog.Debug(
                    $"agent tool executed runId={state.RunId} tool={toolCall.Name} " +
                    $"id={toolCall.Id} error={isToolError} outputLen={toolOutput.Length}");
            }

            // Add tool results as a user message to the conversation
            var toolResultsMessage = AgentRuntimeChatMessage.UserToolResults(toolResults);
            conversation.Add(toolResultsMessage);
            wireConversation.Add(CreateToolResultsWireMessage(toolResults));

            await AgentRuntimeTools.EmitAsync(
                state, context,
                new AgentRuntimeStreamEvent(
                    "iteration_end",
                    StopReason: "tool_use",
                    ToolResults: toolResults.ToArray()));
        }

        await EmitLoopEndAsync(
            state, context,
            state.StopReason ?? (completed ? "completed" : "max_iterations"));
    }

    /// <summary>
    /// Emits the loop_end event.
    /// </summary>
    internal static async Task EmitLoopEndAsync(
        AgentRuntimeRunState state,
        IWorkerRequestContext context,
        string reason)
    {
        await AgentRuntimeTools.EmitAsync(
            state, context,
            new AgentRuntimeStreamEvent("loop_end", Reason: reason));
    }

    // ── Provider dispatch ──

    private static async Task<AgentRuntimeProviderTurnResult> ExecuteTurnAsync(
        JsonElement parameters,
        JsonElement provider,
        List<AgentRuntimeChatMessage> conversation,
        AgentRuntimeRunState state,
        IWorkerRequestContext context)
    {
        var providerType = JsonHelpers.GetString(provider, "type") ?? string.Empty;

        if (providerType == "anthropic")
        {
            return await AnthropicMessagesProvider.ExecuteTurnAsync(
                parameters, provider, conversation, state, context);
        }

        // Default: openai-chat
        return await OpenAIChatProvider.ExecuteTurnAsync(
            parameters, provider, conversation, state, context);
    }

    // ── Provider validation ──

    private static void ValidateProvider(JsonElement provider)
    {
        var apiKey = JsonHelpers.GetString(provider, "apiKey") ?? string.Empty;
        var model = JsonHelpers.GetString(provider, "model") ?? string.Empty;
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("Provider requires apiKey.");
        }
        if (string.IsNullOrWhiteSpace(model))
        {
            throw new InvalidOperationException("Provider requires model.");
        }
    }

    // ── Context compression check ──

    private static bool ShouldCompress(int inputTokens, JsonElement provider)
    {
        var contextLength = JsonHelpers.GetIntNullable(provider, "contextLength") ?? 0;
        if (contextLength <= 0)
        {
            return false;
        }
        var threshold = (int)(contextLength * DefaultContextCompressionThreshold);
        var reserved = contextLength - DefaultContextCompressionReservedOutputTokens - ContextCompressionAutoBufferTokens;
        var trigger = Math.Min(threshold, reserved);
        return inputTokens >= trigger;
    }

    // ── Wire conversation reading ──

    private static List<JsonElement> ReadWireConversation(JsonElement parameters)
    {
        var result = new List<JsonElement>();
        if (parameters.ValueKind != JsonValueKind.Object ||
            !parameters.TryGetProperty("messages", out var messages) ||
            messages.ValueKind != JsonValueKind.Array)
        {
            return result;
        }

        foreach (var message in messages.EnumerateArray())
        {
            if (message.ValueKind == JsonValueKind.Object)
            {
                result.Add(message.Clone());
            }
        }
        return result;
    }

    private static List<AgentRuntimeChatMessage> ReadConversation(IReadOnlyList<JsonElement> messages)
    {
        var result = new List<AgentRuntimeChatMessage>();

        foreach (var message in messages)
        {
            var role = JsonHelpers.GetString(message, "role");
            if (string.IsNullOrEmpty(role))
            {
                continue;
            }

            if (!message.TryGetProperty("content", out var content))
            {
                continue;
            }

            if (content.ValueKind == JsonValueKind.String)
            {
                result.Add(new AgentRuntimeChatMessage(
                    role,
                    content.GetString() ?? string.Empty,
                    [],
                    [],
                    JsonHelpers.GetString(message, "providerResponseId")));
                continue;
            }

            if (content.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

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
                role,
                text.ToString(),
                toolUses,
                toolResults,
                JsonHelpers.GetString(message, "providerResponseId"),
                contentBlocks));
        }

        return result;
    }

    // ── Wire message creation ──

    internal static JsonElement CreateAssistantWireMessage(
        AgentRuntimeChatMessage message,
        AgentRuntimeTokenUsage? usage)
    {
        return AgentRuntimeProviderSupport.CreateObjectElement(writer =>
        {
            writer.WriteString("id", NewMessageId());
            writer.WriteString("role", "assistant");
            writer.WritePropertyName("content");
            WriteAssistantWireContent(writer, message);
            writer.WriteNumber("createdAt", NowMs());
            if (!string.IsNullOrWhiteSpace(message.ProviderResponseId))
            {
                writer.WriteString("providerResponseId", message.ProviderResponseId);
            }
            if (usage is not null)
            {
                writer.WritePropertyName("usage");
                WriteUsage(writer, usage);
            }
        });
    }

    private static void WriteAssistantWireContent(Utf8JsonWriter writer, AgentRuntimeChatMessage message)
    {
        if (message.ContentBlocks is { Count: > 0 } contentBlocks)
        {
            writer.WriteStartArray();
            foreach (var block in contentBlocks)
            {
                block.WriteTo(writer);
            }
            writer.WriteEndArray();
            return;
        }

        if (message.ToolUses.Count == 0)
        {
            writer.WriteStringValue(message.Text);
            return;
        }

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

    private static void WriteUsage(Utf8JsonWriter writer, AgentRuntimeTokenUsage usage)
    {
        writer.WriteStartObject();
        writer.WriteNumber("inputTokens", usage.InputTokens);
        writer.WriteNumber("outputTokens", usage.OutputTokens);
        WriteOptionalNumber(writer, "billableInputTokens", usage.BillableInputTokens);
        WriteOptionalNumber(writer, "cacheReadTokens", usage.CacheReadTokens);
        WriteOptionalNumber(writer, "reasoningTokens", usage.ReasoningTokens);
        WriteOptionalNumber(writer, "contextTokens", usage.ContextTokens);
        WriteOptionalNumber(writer, "cacheCreationTokens", usage.CacheCreationTokens);
        WriteOptionalNumber(writer, "cacheCreation5mTokens", usage.CacheCreation5mTokens);
        WriteOptionalNumber(writer, "cacheCreation1hTokens", usage.CacheCreation1hTokens);
        if (usage.CacheReadRatio.HasValue)
        {
            writer.WriteNumber("cacheReadRatio", usage.CacheReadRatio.Value);
        }
        writer.WriteEndObject();
    }

    private static void WriteOptionalNumber(Utf8JsonWriter writer, string propertyName, int? value)
    {
        if (!value.HasValue) return;
        writer.WriteNumber(propertyName, value.Value);
    }

    // ── Runtime parameters ──

    private static JsonElement CreateRuntimeParametersWithoutMessages(JsonElement parameters)
    {
        if (parameters.ValueKind != JsonValueKind.Object)
        {
            return parameters;
        }

        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer, WriterOptions))
        {
            writer.WriteStartObject();
            foreach (var property in parameters.EnumerateObject())
            {
                if (property.NameEquals("messages"))
                {
                    continue;
                }
                property.WriteTo(writer);
            }
            writer.WriteEndObject();
        }
        using var document = JsonDocument.Parse(buffer.WrittenMemory);
        return document.RootElement.Clone();
    }

    // ── JSON helper methods ──

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

    /// <summary>
    /// Creates a wire-format user message containing tool results.
    /// </summary>
    internal static JsonElement CreateToolResultsWireMessage(List<AgentRuntimeToolResult> toolResults)
    {
        return AgentRuntimeProviderSupport.CreateObjectElement(writer =>
        {
            writer.WriteString("id", NewMessageId());
            writer.WriteString("role", "user");
            writer.WritePropertyName("content");
            writer.WriteStartArray();
            foreach (var result in toolResults)
            {
                writer.WriteStartObject();
                writer.WriteString("type", "tool_result");
                writer.WriteString("toolUseId", result.ToolUseId);
                if (result.Content.ValueKind == JsonValueKind.String)
                {
                    writer.WriteString("content", result.Content.GetString());
                }
                else
                {
                    writer.WritePropertyName("content");
                    result.Content.WriteTo(writer);
                }
                if (result.IsError is true)
                {
                    writer.WriteBoolean("isError", true);
                }
                writer.WriteEndObject();
            }
            writer.WriteEndArray();
            writer.WriteNumber("createdAt", NowMs());
        });
    }

}
