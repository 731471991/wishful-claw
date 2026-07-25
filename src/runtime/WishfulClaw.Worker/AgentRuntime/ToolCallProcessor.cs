using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Tools;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Worker.Tools;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Handles tool call execution within an agent loop iteration.
/// Supports concurrency control via SemaphoreSlim and per-turn call capping.
/// Sub-agent (Task) tool calls have a separate concurrency limit.
/// </summary>
internal static class ToolCallProcessor
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
                ? $"Tool call skipped: per-turn limit ({maxToolCallsPerTurn}) exceeded. " +
                  $"This call was not executed. Please retry in the next turn."
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

            string toolOutput;
            bool isToolError = false;

            // AskUserQuestion: route to renderer via reverse-request
            if (AgentRuntimeAskUserExecutor.IsAskUserTool(toolCall.Name))
            {
                try
                {
                    var result = await AgentRuntimeAskUserExecutor.ExecuteAsync(
                        toolCall, state.Parameters, context, state.CancellationToken);
                    toolOutput = result.Content.ValueKind == JsonValueKind.String
                        ? result.Content.GetString() ?? string.Empty
                        : result.Content.ToString();
                    isToolError = result.IsError;
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    toolOutput = $"AskUser tool execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // Desktop control: route to main process via reverse-request
            else if (AgentRuntimeDesktopExecutor.IsDesktopTool(toolCall.Name))
            {
                try
                {
                    var result = await AgentRuntimeDesktopExecutor.ExecuteAsync(
                        toolCall, context, state.CancellationToken);
                    toolOutput = result.Content.ValueKind == JsonValueKind.String
                        ? result.Content.GetString() ?? string.Empty
                        : result.Content.ToString();
                    isToolError = result.IsError;
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    toolOutput = $"Desktop tool execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // WebSearch: executed directly in Worker (HTTP request)
            else if (AgentRuntimeWebSearchExecutor.IsWebSearchTool(toolCall.Name))
            {
                try
                {
                    toolOutput = await AgentRuntimeWebSearchExecutor.ExecuteAsync(
                        toolCall, state.Parameters, state.CancellationToken);
                    isToolError = IsJsonError(toolOutput);
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    toolOutput = $"Web search execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // WebFetch: executed directly in Worker (HTTP request)
            else if (AgentRuntimeWebFetchExecutor.IsWebFetchTool(toolCall.Name))
            {
                try
                {
                    toolOutput = await AgentRuntimeWebFetchExecutor.ExecuteAsync(
                        toolCall, state.CancellationToken);
                    isToolError = IsJsonError(toolOutput);
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    toolOutput = $"Web fetch execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // Browser tool calls: route to renderer via reverse-request
            else if (AgentRuntimeBrowserExecutor.IsBrowserTool(toolCall.Name))
            {
                try
                {
                    var result = await AgentRuntimeBrowserExecutor.ExecuteAsync(
                        toolCall, state.Parameters, state.RunId, context, state.CancellationToken);
                    toolOutput = result.Content.ValueKind == JsonValueKind.String
                        ? result.Content.GetString() ?? string.Empty
                        : result.Content.ToString();
                    isToolError = result.IsError;
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    toolOutput = $"Browser tool execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // Widget: pure Worker, no I/O
            else if (AgentRuntimeWidgetExecutor.IsWidgetTool(toolCall.Name))
            {
                toolOutput = AgentRuntimeWidgetExecutor.Execute(toolCall);
                isToolError = IsJsonError(toolOutput);
            }
            // Skill: reads SKILL.md from disk
            else if (AgentRuntimeSkillExecutor.IsSkillTool(toolCall.Name))
            {
                try
                {
                    toolOutput = await AgentRuntimeSkillExecutor.ExecuteAsync(toolCall, state.CancellationToken);
                    isToolError = IsJsonError(toolOutput);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    toolOutput = $"Skill tool execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // NotebookEdit: Jupyter notebook cell editing
            else if (AgentRuntimeNotebookEditExecutor.IsNotebookEditTool(toolCall.Name))
            {
                try
                {
                    toolOutput = await AgentRuntimeNotebookEditExecutor.ExecuteAsync(toolCall, state.CancellationToken);
                    isToolError = IsJsonError(toolOutput);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    toolOutput = $"NotebookEdit tool execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // Goal: in-memory goal tracking
            else if (AgentRuntimeGoalExecutor.IsGoalTool(toolCall.Name))
            {
                toolOutput = AgentRuntimeGoalExecutor.Execute(toolCall, state.Parameters);
                isToolError = IsJsonError(toolOutput);
            }
            // Task: in-memory task management
            else if (AgentRuntimeTaskExecutor.IsTaskTool(toolCall.Name))
            {
                toolOutput = AgentRuntimeTaskExecutor.Execute(toolCall, state.Parameters);
                isToolError = IsJsonError(toolOutput);
            }
            // PlanMode: file-based plan management
            else if (AgentRuntimePlanExecutor.IsPlanTool(toolCall.Name))
            {
                try
                {
                    toolOutput = await AgentRuntimePlanExecutor.ExecuteAsync(
                        toolCall, state.Parameters, state.RunId, context, state.CancellationToken);
                    isToolError = IsJsonError(toolOutput);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    toolOutput = $"Plan tool execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // CodeCompatible: PowerShell / Monitor
            else if (AgentRuntimeCodeCompatibleExecutor.IsCodeCompatibleTool(toolCall.Name))
            {
                try
                {
                    toolOutput = await AgentRuntimeCodeCompatibleExecutor.ExecuteAsync(
                        toolCall, state.Parameters, state.CancellationToken);
                    isToolError = IsJsonError(toolOutput);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    toolOutput = $"Code compatible tool execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // CodeGraph: reverse-request to Main process
            else if (AgentRuntimeCodeGraphExecutor.IsCodeGraphTool(toolCall.Name))
            {
                try
                {
                    toolOutput = await AgentRuntimeCodeGraphExecutor.ExecuteAsync(
                        toolCall, state.Parameters, context, state.CancellationToken);
                    isToolError = IsJsonError(toolOutput);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    toolOutput = $"CodeGraph tool execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // MCP: reverse-request to Main/renderer
            else if (AgentRuntimeMcpExecutor.IsMcpTool(toolCall.Name))
            {
                try
                {
                    toolOutput = await AgentRuntimeMcpExecutor.ExecuteAsync(
                        toolCall, context, state.CancellationToken);
                    isToolError = IsJsonError(toolOutput);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    toolOutput = $"MCP tool execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // Extension: reverse-request to Main/renderer
            else if (AgentRuntimeExtensionExecutor.IsExtensionTool(toolCall.Name))
            {
                try
                {
                    toolOutput = await AgentRuntimeExtensionExecutor.ExecuteAsync(
                        toolCall, context, state.CancellationToken);
                    isToolError = IsJsonError(toolOutput);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    toolOutput = $"Extension tool execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // Notify: reverse-request to Main process
            else if (AgentRuntimeNotifyExecutor.IsNotifyTool(toolCall.Name))
            {
                try
                {
                    toolOutput = await AgentRuntimeNotifyExecutor.ExecuteAsync(
                        toolCall, context, state.CancellationToken);
                    isToolError = IsJsonError(toolOutput);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    toolOutput = $"Notify tool execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // ImageGenerate: reverse-request to Main process
            else if (AgentRuntimeImageGenerateExecutor.IsImageGenerateTool(toolCall.Name))
            {
                try
                {
                    toolOutput = await AgentRuntimeImageGenerateExecutor.ExecuteAsync(
                        toolCall, state.Parameters, context, state.CancellationToken);
                    isToolError = IsJsonError(toolOutput);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    toolOutput = $"ImageGenerate tool execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // Team: in-memory + reverse-request
            else if (AgentRuntimeTeamExecutor.IsTeamTool(toolCall.Name))
            {
                try
                {
                    toolOutput = await AgentRuntimeTeamExecutor.ExecuteAsync(
                        toolCall, state.Parameters, context, state.CancellationToken);
                    isToolError = IsJsonError(toolOutput);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    toolOutput = $"Team tool execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // Cron: reverse-request to Main process
            else if (AgentRuntimeCronExecutor.IsCronTool(toolCall.Name))
            {
                try
                {
                    toolOutput = await AgentRuntimeCronExecutor.ExecuteAsync(
                        toolCall, state.Parameters, context, state.CancellationToken);
                    isToolError = IsJsonError(toolOutput);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    toolOutput = $"Cron tool execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // Plugin: reverse-request to Main process
            else if (AgentRuntimePluginExecutor.IsPluginTool(toolCall.Name))
            {
                try
                {
                    toolOutput = await AgentRuntimePluginExecutor.ExecuteAsync(
                        toolCall, state.Parameters, context, state.CancellationToken);
                    isToolError = IsJsonError(toolOutput);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    toolOutput = $"Plugin tool execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            // ChannelPlugin: reverse-request to Main process
            else if (AgentRuntimeChannelPluginExecutor.IsChannelPluginTool(toolCall.Name))
            {
                try
                {
                    toolOutput = await AgentRuntimeChannelPluginExecutor.ExecuteAsync(
                        toolCall, state.Parameters, context, state.CancellationToken);
                    isToolError = IsJsonError(toolOutput);
                }
                catch (OperationCanceledException) { throw; }
                catch (Exception ex)
                {
                    toolOutput = $"Channel plugin tool execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            else if (SubAgentExecutor.IsTaskTool(toolCall.Name))
            {
                try
                {
                    var result = await SubAgentExecutor.ExecuteAsync(
                        toolCall.Input, state.Parameters, state, context, toolCall.Id);
                    toolOutput = result.Content;
                    isToolError = result.IsError;
                }
                catch (OperationCanceledException)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    toolOutput = $"Sub-agent execution failed: {ex.Message}";
                    isToolError = true;
                }
            }
            else if (registry is not null && registry.TryGetExecutor(toolCall.Name, out var executor))
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

    /// <summary>
    /// Checks if a JSON string contains an "error" property (used by WebSearch/WebFetch).
    /// </summary>
    private static bool IsJsonError(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.TryGetProperty("error", out _);
        }
        catch
        {
            return false;
        }
    }
}
