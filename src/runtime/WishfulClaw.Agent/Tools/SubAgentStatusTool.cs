using System.Text.Json;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Agent.Tools;

/// <summary>
/// Query the brief status of any sub-agent (foreground or background).
/// Returns: ID, name, description, mode, status, tool call count, iterations, elapsed.
/// Does NOT include output or tool call details — use SubAgentDetail for that.
/// </summary>
public sealed class SubAgentStatusTool : IToolExecutor
{
    public string Name => "SubAgentStatus";

    public string Description =>
        "Check the brief status of a sub-agent by its toolUseId. " +
        "Returns a short summary: ID, name, description, mode (foreground/background), " +
        "status (running/completed/failed/cancelled), tool call count, iterations, elapsed time. " +
        "If no toolUseId is provided, lists all sub-agents with one-line summaries. " +
        "For full output report and step-by-step tool call log, use SubAgentDetail instead.";

    public JsonElement InputSchema { get; } = JsonDocument.Parse(
        """
        {
          "type": "object",
          "properties": {
            "toolUseId": {
              "type": "string",
              "description": "The sub-agent's toolUseId (returned when the sub-agent was started). If omitted, lists all sub-agents."
            }
          },
          "required": []
        }
        """).RootElement.Clone();

    public Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        var toolUseId = ToolHelpers.GetString(input, "toolUseId");

        if (string.IsNullOrWhiteSpace(toolUseId))
        {
            var all = Agent.BackgroundSubAgentRegistry.GetAll();
            if (all.Count == 0)
            {
                return Task.FromResult(new ToolResult("No sub-agents registered."));
            }

            var lines = new List<string> { $"Sub-Agents ({all.Count}):" };
            foreach (var r in all)
            {
                lines.Add($"  {Agent.BackgroundSubAgentRegistry.FormatBrief(r)}");
            }
            return Task.FromResult(new ToolResult(string.Join("\n", lines)));
        }

        var record = Agent.BackgroundSubAgentRegistry.Get(toolUseId!);
        if (record is null)
        {
            return Task.FromResult(new ToolResult(
                $"No sub-agent found with toolUseId '{toolUseId}'.", true));
        }

        return Task.FromResult(new ToolResult(
            Agent.BackgroundSubAgentRegistry.FormatStatusInfo(record)));
    }
}

/// <summary>
/// Query the full execution detail of any sub-agent (foreground or background).
/// Returns: status info + complete output report + step-by-step tool call log.
/// </summary>
public sealed class SubAgentDetailTool : IToolExecutor
{
    public string Name => "SubAgentDetail";

    public string Description =>
        "Get the full execution detail of a sub-agent by its toolUseId. " +
        "Returns everything: status summary, complete output report, and a step-by-step " +
        "tool call log (tool name, key parameter, execution status for each call). " +
        "Use this when you need to review what a sub-agent actually did, not just its status. " +
        "For a quick status check without the full output, use SubAgentStatus instead.";

    public JsonElement InputSchema { get; } = JsonDocument.Parse(
        """
        {
          "type": "object",
          "properties": {
            "toolUseId": {
              "type": "string",
              "description": "The sub-agent's toolUseId (returned when the sub-agent was started)."
            }
          },
          "required": ["toolUseId"]
        }
        """).RootElement.Clone();

    public Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        var toolUseId = ToolHelpers.GetString(input, "toolUseId");
        if (string.IsNullOrWhiteSpace(toolUseId))
        {
            return Task.FromResult(new ToolResult(
                "SubAgentDetail requires a 'toolUseId' parameter.", true));
        }

        var record = Agent.BackgroundSubAgentRegistry.Get(toolUseId!);
        if (record is null)
        {
            return Task.FromResult(new ToolResult(
                $"No sub-agent found with toolUseId '{toolUseId}'.", true));
        }

        return Task.FromResult(new ToolResult(
            Agent.BackgroundSubAgentRegistry.FormatDetail(record)));
    }
}
