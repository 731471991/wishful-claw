using System.Text;
using System.Text.Json;
using WishfulClaw.Core.Tools;
using WishfulClaw.Agent;

namespace WishfulClaw.Agent.Tools;

/// <summary>
/// Task tool — the entry point for launching sub-agents.
///
/// This tool's description and inputSchema are built dynamically from the
/// SubAgentRegistry so the LLM can see all available agent types.
/// Execution is intercepted by ToolDispatchRouter → SubAgentExecutor;
/// ExecuteAsync here should never be reached.
///
/// Design (mirrors WishfulClaw's create-tool.ts):
/// - Task is the unified entry point; subagent_type selects which SubAgent to run.
/// - "custom" is always available as the general-purpose fallback.
/// - Sub-agent definitions are registered in SubAgentRegistry at startup.
/// </summary>
public sealed class TaskTool : IToolExecutor
{
    public string Name => "Task";

    public string Description { get; }

    public JsonElement InputSchema { get; }

    public TaskTool()
    {
        Description = BuildDescription();
        InputSchema = BuildSchema();
    }

    public Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        // This should never be called — ToolDispatchRouter intercepts Task tool calls
        // and routes them to SubAgentExecutor before reaching the registry.
        return Task.FromResult(new ToolResult(
            "Task tool execution should be handled by SubAgentExecutor.",
            IsError: true));
    }

    /// <summary>
    /// Build the tool description listing all available sub-agent types.
    /// Mirrors WishfulClaw's buildTaskDescription().
    /// </summary>
    private static string BuildDescription()
    {
        var agents = SubAgentRegistry.GetAll();
        var sb = new StringBuilder();

        sb.AppendLine("Launch a sub-agent to handle a complex, multi-step task autonomously.");
        sb.AppendLine();
        sb.AppendLine("The sub-agent runs in its own session with a focused system prompt and ");
        sb.AppendLine("inherits the parent agent's tools. Only its final answer is returned to you.");
        sb.AppendLine();
        sb.AppendLine("Available agent types:");

        if (agents.Count == 0)
        {
            sb.AppendLine("- custom: General-purpose sub-agent with a built-in default system prompt.");
        }
        else
        {
            foreach (var a in agents)
            {
                sb.AppendLine($"- {a.Name}: {a.Description}");
            }
            sb.AppendLine("- custom: General-purpose sub-agent with a built-in default system prompt. Use this when none of the specialized agents are a clean fit.");
        }

        sb.AppendLine();
        sb.AppendLine("Usage notes:");
        sb.AppendLine("- For complex tasks (multi-file, cross-cutting, requires deep investigation): delegate immediately — do NOT investigate first and then delegate.");
        sb.AppendLine("- For simple tasks (1-3 steps): do it yourself, don't delegate.");
        sb.AppendLine("- Always include a short description (3-5 words) summarizing what the agent will do.");
        sb.AppendLine("- Each sub-agent invocation is stateless: it does not see the current conversation history, so write self-contained prompts that include all context the sub-agent needs.");
        sb.AppendLine("- Sub-agents inherit the parent's current tools, including Task when it is available, so they may delegate further when useful.");
        sb.AppendLine("- Set background=true to run the sub-agent in the background without blocking the main conversation. Returns immediately with a sub-agent ID. Use SubAgentStatus to check progress and SubAgentDetail for full execution details.");

        return sb.ToString().TrimEnd();
    }

    /// <summary>
    /// Build the input schema with a dynamic subagent_type enum.
    /// </summary>
    private static JsonElement BuildSchema()
    {
        var names = SubAgentRegistry.GetNames();
        var enumItems = string.Join(", ", names.Select(n => $"\"{n}\""));

        var json = $$"""
        {
          "type": "object",
          "properties": {
            "description": {
              "type": "string",
              "description": "A short (3-5 word) description of the task, used for display"
            },
            "prompt": {
              "type": "string",
              "description": "The task for the sub-agent to perform. Be specific about the deliverable — the sub-agent does not see this conversation. Include all necessary context."
            },
            "subagent_type": {
              "type": "string",
              "enum": [{{enumItems}}],
              "default": "custom",
              "description": "The type of sub-agent to use. Defaults to 'custom' for general-purpose tasks."
            },
            "background": {
              "type": "boolean",
              "default": false,
              "description": "If true, the sub-agent runs in the background without blocking the main conversation. Returns immediately with a sub-agent ID. Use SubAgentStatus to check progress. If false (default), the main conversation waits for the sub-agent to complete and returns its final report."
            }
          },
          "required": ["description", "prompt"],
          "additionalProperties": false
        }
        """;

        return JsonDocument.Parse(json).RootElement.Clone();
    }
}
