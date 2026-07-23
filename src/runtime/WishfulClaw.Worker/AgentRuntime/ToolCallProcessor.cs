using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Tools;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Worker.Tools;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Handles tool call execution within an agent loop iteration.
/// Supports concurrency control via SemaphoreSlim and per-turn call capping.
/// </summary>
internal static class ToolCallProcessor
{
    /// <summary>
    /// Executes a batch of tool calls with concurrency control and per-turn capping.
    /// Returns the collected tool results in completion order.
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
        var registry = ToolModuleState.Registry;

        // Cap total tool calls per turn to prevent runaway LLM behavior
        var toolCallsToExecute = toolCalls;
        if (maxToolCallsPerTurn > 0 && toolCallsToExecute.Count > maxToolCallsPerTurn)
        {
            WorkerLog.Warn(
                $"agent tool calls capped runId={state.RunId} " +
                $"requested={toolCallsToExecute.Count} max={maxToolCallsPerTurn}");
            toolCallsToExecute = toolCallsToExecute.Take(maxToolCallsPerTurn).ToList();
        }

        // Execute tools with concurrency control via SemaphoreSlim
        var semaphore = new SemaphoreSlim(maxParallelTools, maxParallelTools);
        var toolTasks = new List<Task<AgentRuntimeToolResult>>();

        foreach (var toolCall in toolCallsToExecute)
        {
            if (state.IsCancellationRequested)
            {
                break;
            }

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

            string toolOutput;
            bool isToolError = false;

            if (registry is not null && registry.TryGetExecutor(toolCall.Name, out var executor))
            {
                try
                {
                    var toolContext = new ToolExecutionContext(
                        workingFolder, state.SessionId, state.RunId, null, state.CancellationToken);
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
}
