using WishfulClaw.Agent.Tools;
using System.Text.Json;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Agent.Tools.Providers;

/// <summary>
/// Registers plan mode tool definitions.
/// Execution: ToolDispatchRouter → AgentRuntimePlanExecutor (file-based + DB).
/// </summary>
internal sealed class PlanToolProvider : IToolProvider
{
    public string Category => "plan";

    public void RegisterTools(ToolRegistry registry)
    {
        // EnterPlanMode — Agent enters plan mode, creates/resumes plan file
        var enterProps = new Dictionary<string, JsonElement>
        {
            ["reason"] = ToolSchemaBuilder.String("Brief reason for entering plan mode. This becomes the initial plan title.")
        };
        registry.Register(new ToolDefinitionPlaceholder(
            "EnterPlanMode",
            "Enter Plan Mode to explore the codebase and create a detailed implementation plan before writing code. " +
            "In plan mode, prioritize read/search tools for investigation and write the plan into the current plan file returned by this tool. " +
            "Write operations remain available when the planning work needs them.",
            ToolSchemaBuilder.Object(enterProps, ["reason"])));

        // ExitPlanMode — Agent finalizes plan, sends to user for review
        registry.Register(new ToolDefinitionPlaceholder(
            "ExitPlanMode",
            "Exit Plan Mode after writing the plan file. This signals that the plan is finalized and ready for user review. " +
            "After calling this tool, you MUST STOP and wait for the user to review the plan; do NOT continue with any further actions.",
            ToolSchemaBuilder.Object()));

        // UpdatePlanStep — Agent updates step status during execution
        var stepProps = new Dictionary<string, JsonElement>
        {
            ["stepId"] = ToolSchemaBuilder.Number("Step number (1-based). Auto-assigned if omitted."),
            ["title"] = ToolSchemaBuilder.String("Step title/description."),
            ["status"] = ToolSchemaBuilder.String("Step status: 'in_progress', 'completed', or 'failed'."),
            ["result"] = ToolSchemaBuilder.String("Optional result summary for the step.")
        };
        var stepRequired = new[] { "title", "status" };
        registry.Register(new ToolDefinitionPlaceholder(
            "UpdatePlanStep",
            "Update the status of a step in the current plan. Call this during plan execution to track progress. " +
            "The plan state file (.wishful-claw/plans/{planId}.state.json) is updated in real-time and can be read by external tools.",
            ToolSchemaBuilder.Object(stepProps, stepRequired)));
    }
}
