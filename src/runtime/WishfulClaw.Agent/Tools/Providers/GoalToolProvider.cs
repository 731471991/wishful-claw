using WishfulClaw.Agent.Tools;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Agent.Tools.Providers;

/// <summary>
/// Registers goal management tool definitions.
/// Execution: ToolDispatchRouter → AgentRuntimeGoalExecutor (in-memory, no I/O).
/// Available in goal mode only.
/// </summary>
public sealed class GoalToolProvider : IToolProvider
{
    public string Category => "goal";

    public void RegisterTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "get_goal",
            "Get the current goal for the agent session.",
            ToolSchemaBuilder.Object(),
            availableModes: ["goal"]));

        registry.Register(new ToolDefinitionPlaceholder(
            "create_goal",
            "Create a new goal for the agent session. The goal is created in a pending state and will not start until the user confirms it via the frontend confirmation card. After confirmation, the goal orchestrator runs the goal in the background automatically - you do NOT execute the goal work yourself, only supervise and report progress.",
            ToolSchemaBuilder.Object(
                new() { ["objective"] = ToolSchemaBuilder.String("The goal description.") },
                ["objective"]),
            availableModes: ["goal"]));

        registry.Register(new ToolDefinitionPlaceholder(
            "update_goal",
            "Update the current goal's status or content.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["objective"] = ToolSchemaBuilder.String("Updated goal description."),
                    ["status"] = ToolSchemaBuilder.String(
                        "New status.",
                        [GoalStatusValues.Active, GoalStatusValues.Complete, GoalStatusValues.Failed])
                }),
            availableModes: ["goal"]));

        registry.Register(new ToolDefinitionPlaceholder(
            "pause_goal",
            "Pause the current goal execution. The orchestrator will stop and can be resumed later.",
            ToolSchemaBuilder.Object(),
            availableModes: ["goal"]));

        registry.Register(new ToolDefinitionPlaceholder(
            "resume_goal",
            "Resume a paused goal execution.",
            ToolSchemaBuilder.Object(),
            availableModes: ["goal"]));

        registry.Register(new ToolDefinitionPlaceholder(
            "abort_goal",
            "Abort/cancel the current goal execution permanently.",
            ToolSchemaBuilder.Object(),
            availableModes: ["goal"]));
    }
}