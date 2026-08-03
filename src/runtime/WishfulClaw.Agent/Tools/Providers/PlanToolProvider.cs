using WishfulClaw.Agent.Tools;
using System.Text.Json;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Agent.Tools.Providers;

/// <summary>
/// Registers plan mode tool definitions.
/// Execution: ToolDispatchRouter → AgentRuntimePlanExecutor (file-based).
/// </summary>
internal sealed class PlanToolProvider : IToolProvider
{
    public string Category => "plan";

    public void RegisterTools(ToolRegistry registry)
    {
        var planProps = new Dictionary<string, JsonElement>
        {
            ["plan"] = ToolSchemaBuilder.String("The plan content (markdown).")
        };

        registry.Register(new ToolDefinitionPlaceholder(
            "EnterPlanMode",
            "Enter plan mode to create and present a plan to the user for review.",
            ToolSchemaBuilder.Object(planProps, ["plan"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "ExitPlanMode",
            "Exit plan mode after the plan has been reviewed and approved.",
            ToolSchemaBuilder.Object()));
    }
}
