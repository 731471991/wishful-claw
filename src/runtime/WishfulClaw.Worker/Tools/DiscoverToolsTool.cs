using System.Text.Json;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Worker.Tools;

/// <summary>
/// Meta-tool that lets the LLM discover tools not in the current preset.
/// Always registered regardless of preset — the LLM can call this to find
/// tools like cron, desktop, channel-plugin that are filtered out by presets.
///
/// Returns tool name + description + inputSchema for matching tools.
/// After discovering a tool, the LLM can call it directly — all executors
/// are in the registry regardless of preset.
/// </summary>
internal sealed class DiscoverToolsTool : IToolExecutor
{
    public string Name => "discover_tools";

    public string Description =>
        "Discover available tools not in the current preset. " +
        "Returns tool name, description, and input schema. " +
        "Use this when you need a tool (e.g. cron, desktop, channel) " +
        "that isn't in your current tool list. " +
        "Optionally filter by a substring in the tool name. " +
        "After discovering a tool, call it directly by name.";

    public JsonElement InputSchema { get; } = JsonSerializer.SerializeToElement(new
    {
        type = "object",
        properties = new
        {
            filter = new
            {
                type = "string",
                description = "Optional substring to filter tool names (e.g. 'cron', 'desktop', 'feishu')."
            }
        }
    });

    public Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        var filter = input.TryGetProperty("filter", out var filterEl)
            ? filterEl.GetString() ?? ""
            : "";

        var registry = ToolModuleState.Registry;
        if (registry is null)
        {
            return Task.FromResult(new ToolResult(
                JsonSerializer.Serialize(new { error = "Tool registry not initialized" }),
                IsError: true));
        }

        var allNames = registry.GetToolNames();
        var results = new List<object>();

        foreach (var name in allNames)
        {
            // Exclude ourselves from the results
            if (name == "discover_tools") continue;

            // Apply filter
            if (!string.IsNullOrEmpty(filter) &&
                !name.Contains(filter, StringComparison.OrdinalIgnoreCase))
                continue;

            // Get the tool definition (canonicalized)
            if (registry.TryGetExecutor(name, out var executor))
            {
                results.Add(new
                {
                    name = executor!.Name,
                    description = executor.Description,
                    inputSchema = executor.InputSchema
                });
            }
        }

        var json = JsonSerializer.Serialize(new
        {
            count = results.Count,
            tools = results
        });

        return Task.FromResult(new ToolResult(json));
    }
}
