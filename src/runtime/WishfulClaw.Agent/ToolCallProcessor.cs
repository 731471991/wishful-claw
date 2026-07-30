using System.Buffers;
using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Tools;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Agent;

/// <summary>
/// Handles tool call execution within an agent loop iteration.
/// Supports concurrency control via SemaphoreSlim and per-turn call capping.
/// Sub-agent (Task) tool calls have a separate concurrency limit.
/// </summary>
public static class ToolCallProcessor
{
    /// <summary>
    /// Executes a batch of tool calls with concurrency control and per-turn capping.
    /// Returns the collected tool results in completion order.
    /// When tool calls exceed maxToolCallsPerTurn, excess calls are NOT silently
    /// dropped — they return an error result so the LLM knows to retry next turn.
    /// </summary>
    public static async Task<List<AgentRuntimeToolResult>> ExecuteAsync(
        List<AgentRuntimeNativeToolCall> toolCalls,
        JsonElement parameters,
        AgentRuntimeRunState state,
        IWorkerRequestContext context)
    {
        var workingFolder = JsonHelpers.GetString(parameters, "workingFolder");
        var maxParallelTools = Math.Max(1, JsonHelpers.GetInt(parameters, "maxParallelTools", 1));
        var maxToolCallsPerTurn = JsonHelpers.GetInt(parameters, "maxToolCallsPerTurn", 0); // 0 = unlimited
        var maxConcurrentSubAgents = Math.Max(1, JsonHelpers.GetInt(parameters, "maxConcurrentSubAgents", 2));
        var registry = ToolModuleState.Registry;

        // Split tool calls into executable vs skipped (over per-turn limit)
        var toolCallsToExecute = toolCalls;
        var skippedToolCalls = new List<AgentRuntimeNativeToolCall>();

        if (maxToolCallsPerTurn > 0 && toolCalls.Count > maxToolCallsPerTurn)
        {
            WorkerLog.Warn(
                $"agent tool calls capped runId={state.RunId} " +
                $"requested={toolCalls.Count} max={maxToolCallsPerTurn} " +
                $"skipped={toolCalls.Count - maxToolCallsPerTurn}");

            toolCallsToExecute = toolCalls.Take(maxToolCallsPerTurn).ToList();
            skippedToolCalls = toolCalls.Skip(maxToolCallsPerTurn).ToList();
        }

        // Two semaphores: one for regular tools, one for sub-agent (Task) calls.
        // This prevents a burst of Task calls from consuming all parallel slots
        // and blocking regular tools (or vice versa).
        var toolSemaphore = new SemaphoreSlim(maxParallelTools, maxParallelTools);
        var subAgentSemaphore = new SemaphoreSlim(maxConcurrentSubAgents, maxConcurrentSubAgents);
        var toolTasks = new List<Task<AgentRuntimeToolResult>>();

        foreach (var toolCall in toolCallsToExecute)
        {
            if (state.IsCancellationRequested)
            {
                break;
            }

            // Pick the right semaphore based on whether this is a Task (sub-agent) call
            var isTaskTool = SubAgentExecutor.IsTaskTool(toolCall.Name);
            var semaphore = isTaskTool ? subAgentSemaphore : toolSemaphore;

            await semaphore.WaitAsync(state.CancellationToken);
            toolTasks.Add(ExecuteSingleAsync(
                toolCall, workingFolder, state, context, semaphore, registry));
        }

        // Wait for all started tool tasks to complete
        var results = new List<AgentRuntimeToolResult>();
        if (toolTasks.Count > 0)
        {
            var completedResults = await Task.WhenAll(toolTasks);
            results.AddRange(completedResults);
        }

        // Generate error results for skipped tool calls so the LLM knows they
        // were not executed and can retry in the next turn.
        if (skippedToolCalls.Count > 0)
        {
            var skipMessage = maxToolCallsPerTurn > 0
                ? $"Skipped: {maxToolCallsPerTurn} tool calls per turn max. Retry this call next turn."
                : "Tool call skipped: per-turn limit exceeded. Please retry in the next turn.";

            foreach (var skipped in skippedToolCalls)
            {
                // Emit tool_call_start + tool_call_result so the UI shows the skipped call
                await AgentRuntimeTools.EmitAsync(
                    state, context,
                    new AgentRuntimeStreamEvent(
                        "tool_call_start",
                        ToolCall: new AgentRuntimeToolCallState(
                            skipped.Id,
                            skipped.Name,
                            skipped.Input,
                            "running",
                            null,
                            null,
                            false,
                            AgentLoop.NowMs(),
                            null)));

                await AgentRuntimeTools.EmitAsync(
                    state, context,
                    new AgentRuntimeStreamEvent(
                        "tool_call_result",
                        ToolCallId: skipped.Id,
                        ToolName: skipped.Name,
                        ToolCall: new AgentRuntimeToolCallState(
                            skipped.Id,
                            skipped.Name,
                            skipped.Input,
                            "error",
                            AgentRuntimeProviderSupport.CreateStringElement(skipMessage),
                            skipMessage,
                            false,
                            AgentLoop.NowMs(),
                            AgentLoop.NowMs())));

                results.Add(new AgentRuntimeToolResult(
                    skipped.Id,
                    AgentRuntimeProviderSupport.CreateStringElement(skipMessage),
                    true));
            }
        }

        return results;
    }

    /// <summary>
    /// Executes a single tool call with event emission.
    /// The semaphore is released in a finally block to guarantee release on all paths.
    /// </summary>
    private static async Task<AgentRuntimeToolResult> ExecuteSingleAsync(
        AgentRuntimeNativeToolCall toolCall,
        string? workingFolder,
        AgentRuntimeRunState state,
        IWorkerRequestContext context,
        SemaphoreSlim semaphore,
        ToolRegistry? registry)
    {
        try
        {
            var startedAt = AgentLoop.NowMs();

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

            // Sub-agent approval check: when running inside a sub-agent
            // (SuppressTransportEvents = true), certain tools require user
            // approval before execution. The approval request is sent via
            // reverse-request to the renderer.
            if (state.SuppressTransportEvents && RequiresSubAgentApproval(toolCall.Name))
            {
                // Update status to pending_approval
                await AgentRuntimeTools.EmitAsync(
                    state, context,
                    new AgentRuntimeStreamEvent(
                        "tool_call_start",
                        ToolCall: new AgentRuntimeToolCallState(
                            toolCall.Id,
                            toolCall.Name,
                            toolCall.Input,
                            "pending_approval",
                            null,
                            null,
                            true, // RequiresApproval
                            startedAt,
                            null)));

                WorkerLog.Info(
                    $"sub-agent tool approval requested runId={state.RunId} " +
                    $"tool={toolCall.Name} id={toolCall.Id}");

                // Send reverse-request to renderer and wait for response
                var approvalParams = new ArrayBufferWriter<byte>();
                using (var aw = new Utf8JsonWriter(approvalParams, WriteOptions))
                {
                    aw.WriteStartObject();
                    aw.WriteString("toolCallId", toolCall.Id);
                    aw.WriteString("toolName", toolCall.Name);
                    aw.WritePropertyName("input");
                    toolCall.Input.WriteTo(aw);
                    aw.WriteEndObject();
                }
                using var approvalDoc = JsonDocument.Parse(approvalParams.WrittenMemory);
                var approvalResult = await AgentRuntimeReverseRequests.RequestAsync(
                    context, "sub-agent:approve-tool", approvalDoc.RootElement.Clone(),
                    state.CancellationToken);

                var approved = false;
                if (approvalResult.ValueKind == JsonValueKind.Object &&
                    approvalResult.TryGetProperty("approved", out var approvedVal) &&
                    approvedVal.ValueKind == JsonValueKind.True)
                {
                    approved = true;
                }

                if (!approved)
                {
                    var rejectMsg = $"Tool call rejected by user: {toolCall.Name}";
                    var rejectAt = AgentLoop.NowMs();
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
                                "rejected",
                                AgentRuntimeProviderSupport.CreateStringElement(rejectMsg),
                                rejectMsg,
                                false,
                                startedAt,
                                rejectAt)));

                    return new AgentRuntimeToolResult(
                        toolCall.Id,
                        AgentRuntimeProviderSupport.CreateStringElement(rejectMsg),
                        true);
                }

                // Approved — update status back to running
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
            }

            // Dispatch to the appropriate executor
            var (toolOutput, isToolError) = await ToolDispatchRouter.DispatchAsync(
                toolCall, state, context, registry, workingFolder);

            var completedAt = AgentLoop.NowMs();

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

            WorkerLog.Debug(
                $"agent tool executed runId={state.RunId} tool={toolCall.Name} " +
                $"id={toolCall.Id} error={isToolError} outputLen={toolOutput.Length}");

            return new AgentRuntimeToolResult(
                toolCall.Id,
                AgentRuntimeProviderSupport.CreateStringElement(toolOutput),
                isToolError ? true : null);
        }
        finally
        {
            semaphore.Release();
        }
    }

    /// <summary>
    /// Tools that require user approval when executed inside a sub-agent.
    /// Sub-agents run autonomously — routine file operations and commands
    /// should NOT require approval. Only interactive tools (like AskUserQuestion)
    /// pause for user input, and those are handled by their own executor, not here.
    /// </summary>
    private static readonly HashSet<string> SubAgentApprovalTools = new(StringComparer.Ordinal)
    {
        // Empty — sub-agents execute tools freely without per-call approval.
        // If specific tools need approval in the future, add them here.
    };

    private static bool RequiresSubAgentApproval(string toolName)
    {
        return SubAgentApprovalTools.Contains(toolName);
    }

    private static readonly JsonWriterOptions WriteOptions = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };
}

