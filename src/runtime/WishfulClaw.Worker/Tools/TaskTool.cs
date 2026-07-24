using System.Text.Json;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Worker.Tools;

/// <summary>
/// Task tool definition for the LLM.
/// The actual execution is intercepted by ToolCallProcessor and routed to SubAgentExecutor.
/// This executor exists only to provide the tool definition (name, description, inputSchema)
/// to the ToolRegistry so the LLM knows the Task tool is available.
/// </summary>
public sealed class TaskTool : IToolExecutor
{
    private static readonly JsonElement CachedSchema = BuildSchema();

    public string Name => "Task";

    public string Description =>
        "Launch a sub-agent to handle a complex, multi-step task autonomously. " +
        "The sub-agent runs in its own session with a focused system prompt and " +
        "inherits the parent agent's tools. Only its final answer is returned to you. " +
        "Use this for: multi-file investigation, parallel research, focused sub-tasks " +
        "that would clutter your context. Each sub-agent invocation is stateless — " +
        "it does not see the current conversation history.";

    public JsonElement InputSchema => CachedSchema;

    public Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        // This should never be called — ToolCallProcessor intercepts Task tool calls
        // and routes them to SubAgentExecutor before reaching the registry.
        return Task.FromResult(new ToolResult(
            "Task tool execution should be handled by SubAgentExecutor.",
            IsError: true));
    }

    private static JsonElement BuildSchema()
    {
        var json = JsonDocument.Parse(
            """
            {
              "type": "object",
              "properties": {
                "description": {
                  "type": "string",
                  "description": "A short (3-5 word) description of the task"
                },
                "prompt": {
                  "type": "string",
                  "description": "The task for the sub-agent to perform. Be specific about the deliverable."
                },
                "subagent_type": {
                  "type": "string",
                  "description": "The type of sub-agent to use. Use 'custom' for a general-purpose sub-agent.",
                  "default": "custom"
                }
              },
              "required": ["description", "prompt", "subagent_type"],
              "additionalProperties": false
            }
            """);
        return json.RootElement.Clone();
    }
}
