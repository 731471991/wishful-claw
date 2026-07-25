using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Worker.Persona;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Agent main loop. Each iteration = one provider turn.
/// Design fused from:
/// - KodaClaw: Step abstraction (iteration = model call + optional tool execution)
/// - OpenCowork: SSE parsing, provider dispatch
/// - OpenClaw.net: TryInjectRecallAsync (iteration 7)
/// </summary>
internal static partial class AgentLoop
{
    private const double DefaultContextCompressionThreshold = 0.8;
    private const int DefaultContextCompressionReservedOutputTokens = 20_000;
    private const int ContextCompressionAutoBufferTokens = 13_000;

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

        // ── Persona-aware system prompt ──
        var personaId = JsonHelpers.GetString(parameters, "personaId");
        if (!string.IsNullOrWhiteSpace(personaId))
        {
            var workingFolder = JsonHelpers.GetString(parameters, "workingFolder");
            var language = JsonHelpers.GetString(parameters, "language");
            var userRules = JsonHelpers.GetString(parameters, "userRules");
            var builtPrompt = PromptBuilder.Build(
                PromptProfile.Main, provider, parameters, personaId, workingFolder, language, userRules);
            provider = InjectSystemPrompt(provider, builtPrompt);
            WorkerLog.Info($"persona system prompt built id={personaId} length={builtPrompt.Length}");
        }

        var requestedMaxIterations = JsonHelpers.GetInt(parameters, "maxIterations", 0); // 0 = unlimited
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

            // ── Memory recall injection (iteration 7) ──
            if (iteration == 1)
            {
                await TryInjectMemoryRecallAsync(parameters, conversation, state, context);
            }

            // ── Execute provider turn (with retry policy for 429/5xx) ──
            var turn = await ProviderRetryPolicy.ExecuteAsync(
                () => ExecuteTurnAsync(parameters, provider, conversation, state, context),
                state,
                context);
            conversation.Add(turn.AssistantMessage);
            var assistantWireMessage = CreateAssistantWireMessage(turn.AssistantMessage, turn.Usage);
            wireConversation.Add(assistantWireMessage);

            if (turn.Usage?.ContextTokens is > 0)
            {
                lastInputTokens = turn.Usage.ContextTokens.Value;
            }

            // ── Emit text_phase if this turn has both text and tool calls ──
            // The text was streamed before tool execution — mark it as 'pre_tool'
            // so the UI can visually distinguish planning text from final conclusions.
            if (turn.ToolCalls.Count > 0 && !string.IsNullOrWhiteSpace(turn.AssistantMessage.Text))
            {
                await AgentRuntimeTools.EmitAsync(
                    state, context,
                    new AgentRuntimeStreamEvent("text_phase", Reason: "pre_tool"));
            }

            // ── Check for tool calls ──
            if (turn.ToolCalls.Count == 0)
            {
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

            // Tool calls present — providerTurnOnly skips execution
            if (providerTurnOnly)
            {
                await AgentRuntimeTools.EmitAsync(
                    state, context,
                    new AgentRuntimeStreamEvent("iteration_end", StopReason: turn.StopReason));
                completed = true;
                break;
            }

            // ── Tool execution ──
            var toolResults = await ToolCallProcessor.ExecuteAsync(
                turn.ToolCalls, parameters, state, context);

            if (state.IsCancellationRequested)
            {
                await EmitLoopEndAsync(state, context, "aborted");
                return;
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
}
