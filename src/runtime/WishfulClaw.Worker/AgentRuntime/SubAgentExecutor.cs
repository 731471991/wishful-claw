using System.Buffers;
using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Executes sub-agent (Task) tool calls.
/// Creates a child AgentRuntimeRunState, builds child parameters, runs a full
/// AgentLoop, and returns the final assistant message as the tool result.
///
/// Architecture references:
/// - OpenCowork: AgentRuntimeSubAgentExecutor.cs (child state, event emission, prompt building)
/// - Reasonix: task.go (system prompt design, tool filtering, depth limiting)
/// </summary>
internal static class SubAgentExecutor
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

        // Emit sub_agent_start event to parent's stream
        await AgentRuntimeTools.EmitAsync(
            parentState, context,
            new AgentRuntimeStreamEvent(
                "sub_agent_start",
                SubAgentName: definition.Name,
                ToolUseId: toolCallId,
                Input: input.Clone()));

        WorkerLog.Info(
            $"sub-agent start parentRunId={parentState.RunId} toolUseId={toolCallId} " +
            $"agent={definition.Name} depth={currentDepth + 1}");

        // Build child parameters
        var childParameters = BuildChildParameters(
            parameters, definition, prompt, currentDepth + 1);

        // Create child run state with event suppression
        var childRunId = $"subagent-{toolCallId}-{Guid.NewGuid():N}";
        var childState = new AgentRuntimeRunState(childRunId, parentState.SessionId);
        childState.SuppressTransportEvents = true;

        // Collector captures text events from the child loop and forwards
        // key events to the parent's stream with sub_agent_ prefix wrapping.
        var collector = new SubAgentRunCollector
        {
            ForwardEvent = async (evt) =>
            {
                // Wrap the event with sub-agent identification fields and
                // emit to the parent's stream (which is NOT suppressed).
                var wrappedEvent = evt with
                {
                    SubAgentName = definition.Name,
                    ToolUseId = toolCallId
                };
                await AgentRuntimeTools.EmitAsync(parentState, context, wrappedEvent);
            }
        };
        childState.EventObserver = collector.ObserveAsync;

        childState.ReplaceParameters(childParameters);

        // Register parent cancellation → child cancellation
        using var parentCancellationRegistration = parentState.CancellationToken.Register(
            static state => ((AgentRuntimeRunState)state!).Cancel("parent"),
            childState);

        string subAgentOutput;
        bool subAgentError = false;

        try
        {
            // Run the child agent loop
            await AgentLoop.ExecuteLoopAsync(childParameters, childState, context);

            // Extract the final assistant message from collected events
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

        // Emit sub_agent_end event to parent's stream
        var resultJson = BuildResultJson(
            definition.Name, toolCallId, subAgentOutput, !subAgentError, childState.StopReason);

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
            $"outputLen={subAgentOutput.Length}");

        return new ToolResult(subAgentOutput, subAgentError);
    }

    // ── Definition resolution ──

    private static SubAgentDefinition? ResolveDefinition(
        string subAgentType,
        JsonElement parameters,
        JsonElement input)
    {
        if (string.Equals(subAgentType, CustomSubAgentType, StringComparison.Ordinal))
        {
            var workingFolder = JsonHelpers.GetString(parameters, "workingFolder");
            return SubAgentDefinitionLoader.CreateCustomDefinition(workingFolder);
        }

        foreach (var agent in SubAgentDefinitionLoader.LoadAll())
        {
            if (string.Equals(agent.Name, subAgentType, StringComparison.OrdinalIgnoreCase))
            {
                return agent;
            }
        }

        return null;
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
                "Your final assistant message is returned verbatim to the parent agent as the task report. " +
                "End every run with a self-contained report, whether the task succeeded, partially succeeded, " +
                "was blocked, or failed. Do not call tools after writing that final report.\n" +
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
        string? stopReason)
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
            writer.WriteEndObject();
        }
        using var document = JsonDocument.Parse(buffer.WrittenMemory);
        return document.RootElement.Clone();
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
