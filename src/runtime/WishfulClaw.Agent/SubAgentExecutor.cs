using System.Buffers;
using System.Text;
using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Agent;

/// <summary>
/// Executes sub-agent (Task) tool calls.
/// Creates a child AgentRuntimeRunState, builds child parameters, runs a full
/// AgentLoop, and returns the final assistant message as the tool result.
///
/// Architecture references:
/// - OpenCowork: AgentRuntimeSubAgentExecutor.cs (child state, event emission, prompt building)
/// - Reasonix: task.go (system prompt design, tool filtering, depth limiting)
/// </summary>
public static class SubAgentExecutor
{
    private const string TaskToolName = "Task";
    private const string CustomSubAgentType = "custom";
    private const int MaxSubAgentDepth = 2;

    public static bool IsTaskTool(string toolName)
    {
        return string.Equals(toolName, TaskToolName, StringComparison.Ordinal);
    }

    /// <summary>
    /// Executes a Task tool call by spawning a child agent loop.
    /// </summary>
    public static async Task<ToolResult> ExecuteAsync(
        JsonElement input,
        JsonElement parameters,
        AgentRuntimeRunState parentState,
        IWorkerRequestContext context,
        string toolCallId)
    {
        // Sub-agent type is optional — defaults to "custom" (general-purpose).
        // The .md file preset mechanism is available but not required.
        var subAgentType = JsonHelpers.GetString(input, "subagent_type")?.Trim() ?? CustomSubAgentType;
        var definition = ResolveDefinition(subAgentType, parameters, input);
        if (definition is null)
        {
            return ErrorResult($"Unknown subagent_type \"{subAgentType}\".");
        }

        // Depth check — prevent infinite recursion
        var currentDepth = GetSubAgentDepth(parameters);
        if (currentDepth >= MaxSubAgentDepth)
        {
            return ErrorResult(
                $"Maximum sub-agent depth ({MaxSubAgentDepth}) reached. " +
                "Cannot spawn another sub-agent.");
        }

        var prompt = BuildPromptText(input);
        if (string.IsNullOrWhiteSpace(prompt))
        {
            return ErrorResult("Task requires a non-empty prompt.");
        }

        // Background mode: fire-and-forget, return immediately
        var isBackground = JsonHelpers.GetBool(input, "background", false);

        // Emit sub_agent_start event to parent's stream
        await AgentRuntimeTools.EmitAsync(
            parentState, context,
            new AgentRuntimeStreamEvent(
                "sub_agent_start",
                SubAgentName: definition.Name,
                ToolUseId: toolCallId,
                Input: input.Clone()));

        if (isBackground)
        {
            return await ExecuteBackgroundAsync(
                input, parameters, definition, prompt,
                currentDepth, parentState, context, toolCallId);
        }

        return await ExecuteForegroundAsync(
            input, parameters, definition, prompt,
            currentDepth, parentState, context, toolCallId);
    }

    // ── Foreground execution (main conversation waits) ──

    private static async Task<ToolResult> ExecuteForegroundAsync(
        JsonElement input,
        JsonElement parameters,
        SubAgentDefinition definition,
        string prompt,
        int currentDepth,
        AgentRuntimeRunState parentState,
        IWorkerRequestContext context,
        string toolCallId)
    {
        var description = JsonHelpers.GetString(input, "description") ?? definition.Name;

        // Register in the registry so SubAgentStatus/SubAgentDetail can query it
        BackgroundSubAgentRegistry.Register(
            toolUseId: toolCallId, agentName: definition.Name,
            description: description, prompt: prompt, isBackground: false);

        var childParameters = BuildChildParameters(
            parameters, definition, prompt, currentDepth + 1);

        var childRunId = $"subagent-{toolCallId}-{Guid.NewGuid():N}";
        var childState = new AgentRuntimeRunState(childRunId, parentState.SessionId);
        childState.SuppressTransportEvents = true;

        var collector = CreateCollector(parentState, context, definition.Name, toolCallId);
        childState.EventObserver = collector.ObserveAsync;
        childState.ReplaceParameters(childParameters);

        using var parentCancellationRegistration = parentState.CancellationToken.Register(
            static state => ((AgentRuntimeRunState)state!).Cancel("parent"),
            childState);

        string subAgentOutput;
        bool subAgentError = false;

        try
        {
            await AgentLoop.ExecuteLoopAsync(childParameters, childState, context);
            subAgentOutput = collector.GetFinalOutput();

            if (string.IsNullOrWhiteSpace(subAgentOutput))
            {
                subAgentOutput = "Sub-agent completed but produced no output.";
                subAgentError = true;
            }
        }
        catch (OperationCanceledException) when (childState.IsCancellationRequested)
        {
            subAgentOutput = "Sub-agent was cancelled.";
            subAgentError = true;
        }
        catch (Exception ex)
        {
            WorkerLog.Warn(
                $"sub-agent failed parentRunId={parentState.RunId} toolUseId={toolCallId} " +
                $"error={ex.GetType().Name}: {ex.Message}");
            subAgentOutput = $"Sub-agent failed: {ex.Message}";
            subAgentError = true;
        }
        finally
        {
            childState.Dispose();
        }

        // Update registry with final state
        if (subAgentError && childState.IsCancellationRequested)
        {
            BackgroundSubAgentRegistry.Cancel(toolCallId);
        }
        else if (subAgentError)
        {
            BackgroundSubAgentRegistry.Fail(
                toolCallId, subAgentOutput, collector.ToolCallCount,
                collector.Iterations, BuildToolCallEntries(collector.ToolCallSummaries));
        }
        else
        {
            BackgroundSubAgentRegistry.Complete(
                toolCallId, subAgentOutput, collector.ToolCallCount,
                collector.Iterations, BuildToolCallEntries(collector.ToolCallSummaries));
        }

        var toolCallSummary = BuildToolCallSummary(collector.ToolCallSummaries);
        var toolResultText = string.IsNullOrEmpty(toolCallSummary)
            ? subAgentOutput
            : subAgentOutput + "\n\n" + toolCallSummary;

        var resultJson = BuildResultJson(
            definition.Name, toolCallId, subAgentOutput, !subAgentError, childState.StopReason,
            collector.ToolCallCount, collector.Iterations);

        await AgentRuntimeTools.EmitAsync(
            parentState, context,
            new AgentRuntimeStreamEvent(
                "sub_agent_end",
                SubAgentName: definition.Name,
                ToolUseId: toolCallId,
                Result: resultJson));

        WorkerLog.Info(
            $"sub-agent end parentRunId={parentState.RunId} toolUseId={toolCallId} " +
            $"agent={definition.Name} success={!subAgentError} " +
            $"outputLen={subAgentOutput.Length} toolCalls={collector.ToolCallCount} " +
            $"iterations={collector.Iterations} background=false");

        return new ToolResult(toolResultText, subAgentError);
    }

    // ── Background execution (fire-and-forget, non-blocking) ──

    private static Task<ToolResult> ExecuteBackgroundAsync(
        JsonElement input,
        JsonElement parameters,
        SubAgentDefinition definition,
        string prompt,
        int currentDepth,
        AgentRuntimeRunState parentState,
        IWorkerRequestContext context,
        string toolCallId)
    {
        var description = JsonHelpers.GetString(input, "description") ?? definition.Name;

        // Register in the background registry so SubAgentStatus can query it
        BackgroundSubAgentRegistry.Register(toolUseId: toolCallId, agentName: definition.Name, description: description, prompt: prompt, isBackground: true);

        var childParameters = BuildChildParameters(
            parameters, definition, prompt, currentDepth + 1);

        var childRunId = $"subagent-bg-{toolCallId}-{Guid.NewGuid():N}";
        var childState = new AgentRuntimeRunState(childRunId, parentState.SessionId);
        childState.SuppressTransportEvents = true;

        var collector = CreateCollector(parentState, context, definition.Name, toolCallId);
        childState.EventObserver = collector.ObserveAsync;
        childState.ReplaceParameters(childParameters);

        // Register parent cancellation → child cancellation
        parentState.CancellationToken.Register(
            static state => ((AgentRuntimeRunState)state!).Cancel("parent"),
            childState);

        // Fire-and-forget: run the child loop on a background task
        _ = Task.Run(async () =>
        {
            try
            {
                await AgentLoop.ExecuteLoopAsync(childParameters, childState, context);

                // Update progress before completing
                BackgroundSubAgentRegistry.UpdateProgress(
                    toolCallId, collector.ToolCallCount, collector.Iterations,
                    BuildToolCallEntries(collector.ToolCallSummaries));

                var output = collector.GetFinalOutput();
                if (string.IsNullOrWhiteSpace(output))
                    output = "Sub-agent completed but produced no output.";

                BackgroundSubAgentRegistry.Complete(
                    toolCallId, output, collector.ToolCallCount, collector.Iterations,
                    BuildToolCallEntries(collector.ToolCallSummaries));

                // Emit sub_agent_end so the frontend updates the card
                var resultJson = BuildResultJson(
                    definition.Name, toolCallId, output, true, childState.StopReason,
                    collector.ToolCallCount, collector.Iterations);

                await AgentRuntimeTools.EmitAsync(
                    parentState, context,
                    new AgentRuntimeStreamEvent(
                        "sub_agent_end",
                        SubAgentName: definition.Name,
                        ToolUseId: toolCallId,
                        Result: resultJson));

                // Inject completion notification into parent's message queue
                // so the main agent gets informed in its next iteration
                var notificationMsg = BuildSubAgentCompletionMessage(
                    toolCallId, definition.Name, description, output, collector);

                parentState.EnqueueMessages(notificationMsg);

                WorkerLog.Info(
                    $"background sub-agent completed parentRunId={parentState.RunId} " +
                    $"toolUseId={toolCallId} agent={definition.Name} " +
                    $"outputLen={output.Length} toolCalls={collector.ToolCallCount} " +
                    $"iterations={collector.Iterations}");
            }
            catch (OperationCanceledException) when (childState.IsCancellationRequested)
            {
                BackgroundSubAgentRegistry.Cancel(toolCallId);

                await AgentRuntimeTools.EmitAsync(
                    parentState, context,
                    new AgentRuntimeStreamEvent(
                        "sub_agent_end",
                        SubAgentName: definition.Name,
                        ToolUseId: toolCallId,
                        Result: BuildResultJson(
                            definition.Name, toolCallId, "Sub-agent was cancelled.",
                            false, "cancelled", collector.ToolCallCount, collector.Iterations)));

                WorkerLog.Info(
                    $"background sub-agent cancelled parentRunId={parentState.RunId} " +
                    $"toolUseId={toolCallId}");
            }
            catch (Exception ex)
            {
                BackgroundSubAgentRegistry.Fail(
                    toolCallId, ex.Message, collector.ToolCallCount, collector.Iterations,
                    BuildToolCallEntries(collector.ToolCallSummaries));

                await AgentRuntimeTools.EmitAsync(
                    parentState, context,
                    new AgentRuntimeStreamEvent(
                        "sub_agent_end",
                        SubAgentName: definition.Name,
                        ToolUseId: toolCallId,
                        Result: BuildResultJson(
                            definition.Name, toolCallId, $"Sub-agent failed: {ex.Message}",
                            false, "error", collector.ToolCallCount, collector.Iterations)));

                WorkerLog.Warn(
                    $"background sub-agent failed parentRunId={parentState.RunId} " +
                    $"toolUseId={toolCallId} error={ex.GetType().Name}: {ex.Message}");
            }
            finally
            {
                childState.Dispose();
            }
        }, parentState.CancellationToken);

        // Return immediately with a placeholder result
        var placeholder =
            $"Background sub-agent started.\n" +
            $"  ID: {toolCallId}\n" +
            $"  Agent: {definition.Name}\n" +
            $"  Description: {description}\n" +
            $"The sub-agent is running in the background. You can continue working.\n" +
            $"Use SubAgentStatus to check its progress. When it completes, you will be notified automatically.";

        return Task.FromResult(new ToolResult(placeholder));
    }

    // ── Shared helpers ──

    private static SubAgentRunCollector CreateCollector(
        AgentRuntimeRunState parentState,
        IWorkerRequestContext context,
        string agentName,
        string toolCallId)
    {
        return new SubAgentRunCollector
        {
            ForwardEvent = async (evt) =>
            {
                var wrappedEvent = evt with
                {
                    SubAgentName = agentName,
                    ToolUseId = toolCallId
                };
                await AgentRuntimeTools.EmitAsync(parentState, context, wrappedEvent);
            }
        };
    }

    /// <summary>
    /// Builds a user message that gets injected into the parent conversation
    /// when a background sub-agent completes.
    /// </summary>
    private static JsonElement BuildSubAgentCompletionMessage(
        string toolUseId,
        string agentName,
        string description,
        string output,
        SubAgentRunCollector collector)
    {
        var toolCallSummary = BuildToolCallSummary(collector.ToolCallSummaries);
        var fullReport = string.IsNullOrEmpty(toolCallSummary)
            ? output
            : output + "\n\n" + toolCallSummary;

        var notificationText =
            $"[Background Sub-Agent Completed]\n" +
            $"  ID: {toolUseId}\n" +
            $"  Agent: {agentName}\n" +
            $"  Description: {description}\n" +
            $"  Tool calls: {collector.ToolCallCount}\n" +
            $"  Iterations: {collector.Iterations}\n\n" +
            $"Report:\n{fullReport}";

        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer, WriteOptions))
        {
            writer.WriteStartObject();
            writer.WriteString("id", $"wc_bg_complete_{toolUseId}");
            writer.WriteString("role", "user");
            writer.WritePropertyName("content");
            writer.WriteStartArray();
            writer.WriteStartObject();
            writer.WriteString("type", "text");
            writer.WriteString("text", notificationText);
            writer.WriteEndObject();
            writer.WriteEndArray();
            writer.WriteNumber("createdAt", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            writer.WriteEndObject();
        }
        using var doc = JsonDocument.Parse(buffer.WrittenMemory);
        return doc.RootElement.Clone();
    }

    // ── Definition resolution ──

    private static SubAgentDefinition? ResolveDefinition(
        string subAgentType,
        JsonElement parameters,
        JsonElement input)
    {
        if (string.Equals(subAgentType, CustomSubAgentType, StringComparison.OrdinalIgnoreCase))
        {
            var workingFolder = JsonHelpers.GetString(parameters, "workingFolder");
            return SubAgentDefinitionLoader.CreateCustomDefinition(workingFolder);
        }

        // Look up in the in-memory registry (populated at startup)
        return SubAgentRegistry.Get(subAgentType);
    }

    // ── Child parameter building ──

    private static JsonElement BuildChildParameters(
        JsonElement parentParameters,
        SubAgentDefinition definition,
        string prompt,
        int childDepth)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer, WriteOptions))
        {
            writer.WriteStartObject();

            // Copy all properties from parent, except messages (will be replaced)
            // and personaId/userRules (sub-agent uses its own system prompt)
            foreach (var prop in parentParameters.EnumerateObject())
            {
                if (prop.NameEquals("messages") ||
                    prop.NameEquals("personaId") ||
                    prop.NameEquals("userRules") ||
                    prop.NameEquals("providerTurnOnly"))
                {
                    continue;
                }
                prop.WriteTo(writer);
            }

            // Override maxIterations with the definition's maxTurns
            writer.WriteNumber("maxIterations", definition.MaxTurns);

            // Set sub-agent depth for recursion control
            writer.WriteNumber("subAgentDepth", childDepth);

            // Override system prompt in provider
            var provider = AgentLoop.GetObject(parentParameters, "provider");
            if (provider.ValueKind == JsonValueKind.Object)
            {
                writer.WritePropertyName("provider");
                writer.WriteStartObject();
                var hasSystemPrompt = false;
                foreach (var prop in provider.EnumerateObject())
                {
                    if (prop.NameEquals("systemPrompt"))
                    {
                        writer.WriteString("systemPrompt", definition.SystemPrompt);
                        hasSystemPrompt = true;
                    }
                    else if (prop.NameEquals("model") && !string.IsNullOrWhiteSpace(definition.Model))
                    {
                        writer.WriteString("model", definition.Model);
                    }
                    else if (prop.NameEquals("temperature") && definition.Temperature.HasValue)
                    {
                        writer.WriteNumber("temperature", definition.Temperature.Value);
                    }
                    else
                    {
                        prop.WriteTo(writer);
                    }
                }
                if (!hasSystemPrompt)
                {
                    writer.WriteString("systemPrompt", definition.SystemPrompt);
                }
                writer.WriteEndObject();
            }

            // Build messages array with just the user prompt
            writer.WritePropertyName("messages");
            writer.WriteStartArray();
            writer.WriteStartObject();
            writer.WriteString("id", $"wc_subagent_{Guid.NewGuid():N}");
            writer.WriteString("role", "user");
            writer.WritePropertyName("content");
            writer.WriteStartArray();
            writer.WriteStartObject();
            writer.WriteString("type", "text");
            writer.WriteString("text", prompt);
            writer.WriteEndObject();
            // System reminder: final message is the report
            writer.WriteStartObject();
            writer.WriteString("type", "text");
            writer.WriteString(
                "text",
                "<system-reminder>\n" +
                "Your final assistant message is returned verbatim to the parent agent as the task report.\n" +
                "The parent agent relies on this report to answer follow-up questions from the user, " +
                "so it MUST be self-contained and include:\n" +
                "- What you did and why\n" +
                "- Key findings or information discovered\n" +
                "- What was modified (file names, specific changes)\n" +
                "- Any problems encountered and how they were resolved\n" +
                "Do NOT just say \"done\" or \"completed\" — the parent agent must be able to answer " +
                "questions like \"what files were read?\" or \"what was changed?\" from your report alone.\n" +
                "Do not call tools after writing that final report.\n" +
                "</system-reminder>");
            writer.WriteEndObject();
            writer.WriteEndArray();
            writer.WriteNumber("createdAt", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            writer.WriteEndObject();
            writer.WriteEndArray();

            writer.WriteEndObject();
        }

        using var document = JsonDocument.Parse(buffer.WrittenMemory);
        return document.RootElement.Clone();
    }

    // ── Prompt building ──

    private static string BuildPromptText(JsonElement input)
    {
        var prompt =
            JsonHelpers.GetString(input, "prompt") ??
            JsonHelpers.GetString(input, "query") ??
            JsonHelpers.GetString(input, "task");

        return prompt?.Trim() ?? string.Empty;
    }

    // ── Result JSON ──

    private static JsonElement BuildResultJson(
        string agentName,
        string toolUseId,
        string output,
        bool success,
        string? stopReason,
        int toolCallCount,
        int iterations)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer, WriteOptions))
        {
            writer.WriteStartObject();
            writer.WriteString("agentName", agentName);
            writer.WriteString("toolUseId", toolUseId);
            writer.WriteBoolean("success", success);
            writer.WriteString("output", output);
            writer.WriteString("stopReason", stopReason ?? "completed");
            writer.WriteNumber("toolCallCount", toolCallCount);
            writer.WriteNumber("iterations", iterations);
            writer.WriteEndObject();
        }
        using var document = JsonDocument.Parse(buffer.WrittenMemory);
        return document.RootElement.Clone();
    }

    /// <summary>
    /// Builds a concise tool call summary appended to the tool_result
    /// so the main agent has context about what the sub-agent did.
    /// Format: "工具调用摘要：\n1. Read(agents.md) → 成功\n..."
    /// </summary>
    private static string BuildToolCallSummary(IReadOnlyList<ToolCallSummary> summaries)
    {
        if (summaries.Count == 0) return string.Empty;

        var sb = new StringBuilder();
        sb.AppendLine("工具调用摘要：");
        for (var i = 0; i < summaries.Count; i++)
        {
            var s = summaries[i];
            var keyParam = ExtractKeyParam(s.Name, s.Input);
            var statusText = s.Status switch
            {
                "completed" => "成功",
                "error" => "失败",
                _ => s.Status
            };
            var paramPart = string.IsNullOrEmpty(keyParam) ? "" : $"({keyParam})";
            sb.AppendLine($"{i + 1}. {s.Name}{paramPart} → {statusText}");
        }
        return sb.ToString().TrimEnd();
    }

    /// <summary>
    /// Extracts the first key parameter from a tool call input for the summary.
    /// E.g., Read → file_path, Bash → command, Grep → pattern.
    /// </summary>
    private static string ExtractKeyParam(string toolName, JsonElement? input)
    {
        if (input is not { ValueKind: JsonValueKind.Object }) return string.Empty;

        var el = input.Value;
        var key = toolName switch
        {
            "Read" or "Edit" or "Write" or "WriteFile" or "CreateFile" => "file_path",
            "Bash" or "ShellExec" => "command",
            "Glob" => "pattern",
            "Grep" => "pattern",
            "Task" => "description",
            "WebFetch" => "url",
            "WebSearch" => "query",
            _ => null
        };

        // Try the mapped key first, then fall back to the first property
        if (key is not null && el.TryGetProperty(key, out var prop) && prop.ValueKind == JsonValueKind.String)
        {
            return TruncateForSummary(prop.GetString() ?? string.Empty, toolName);
        }

        // Fall back to first string property
        foreach (var p in el.EnumerateObject())
        {
            if (p.Value.ValueKind == JsonValueKind.String)
            {
                return TruncateForSummary(p.Value.GetString() ?? string.Empty, toolName);
            }
        }

        return string.Empty;
    }

    private static string TruncateForSummary(string value, string toolName)
    {
        // For Bash commands, truncate at first && or |
        if (toolName is "Bash" or "ShellExec")
        {
            var cutIdx = value.IndexOfAny(['&', '|']);
            if (cutIdx > 0) value = value[..cutIdx].Trim();
        }

        // Only show file name, not full path
        if (toolName is "Read" or "Edit" or "Write" or "WriteFile" or "CreateFile")
        {
            var lastSlash = value.LastIndexOfAny(['/', '\\']);
            if (lastSlash >= 0 && lastSlash < value.Length - 1)
            {
                value = value[(lastSlash + 1)..];
            }
        }

        // Max 40 chars
        return value.Length > 40 ? value[..40] + "..." : value;
    }

    // ── Registry Helpers ──

    /// <summary>
    /// Converts the collector's tool call summaries into registry entries
    /// for the SubAgentDetail tool.
    /// </summary>
    private static List<BackgroundSubAgentRegistry.SubAgentToolCallEntry> BuildToolCallEntries(
        IReadOnlyList<ToolCallSummary> summaries)
    {
        var entries = new List<BackgroundSubAgentRegistry.SubAgentToolCallEntry>();
        foreach (var s in summaries)
        {
            var keyParam = ExtractKeyParam(s.Name, s.Input);
            entries.Add(new BackgroundSubAgentRegistry.SubAgentToolCallEntry(
                s.Id, s.Name, keyParam, s.Status));
        }
        return entries;
    }

    // ── Helpers ──

    private static int GetSubAgentDepth(JsonElement parameters)
    {
        return JsonHelpers.GetInt(parameters, "subAgentDepth", 0);
    }

    private static ToolResult ErrorResult(string message)
    {
        return new ToolResult(message, IsError: true, Error: message);
    }

    private static readonly JsonWriterOptions WriteOptions = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };
}
