using WishfulClaw.Worker.Tools;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Worker.Tools.Providers;

/// <summary>
/// Registers goal management tool definitions.
/// Execution: ToolDispatchRouter → AgentRuntimeGoalExecutor (in-memory, no I/O).
/// </summary>
internal sealed class GoalToolProvider : IToolProvider
{
    public string Category => "goal";

    public void RegisterTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "get_goal",
            "Get the current goal for the agent session.",
            ToolSchemaBuilder.Object()));

        registry.Register(new ToolDefinitionPlaceholder(
            "create_goal",
            "Create a new goal for the agent session.",
            ToolSchemaBuilder.Object(
                new() { ["goal"] = ToolSchemaBuilder.String("The goal description.") },
                ["goal"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "update_goal",
            "Update the current goal's status or content.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["goal"] = ToolSchemaBuilder.String("Updated goal description."),
                    ["status"] = ToolSchemaBuilder.String("New status.", ["active", "completed", "failed"])
                })));
    }
}
