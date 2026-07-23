using System.Text.Json;
using System.Text;
using WishfulClaw.Core.Tools;
using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Worker.Tools.MemoryTools;

using static WishfulClaw.Worker.Tools.ToolHelpers;

/// <summary>
/// Search persistent memory by keyword (FTS5).
/// Adapted from OpenClaw.net's MemorySearchTool.
/// </summary>
public sealed class MemorySearchTool : IToolExecutor
{
    private readonly IMemorySearch _search;

    public MemorySearchTool(IMemorySearch search) => _search = search;

    public string Name => "memory_search";

    public string Description =>
        "Search persistent memory by keyword. Useful for recalling prior decisions, user preferences, and project context. " +
        "Searches both project-scoped and global memories.";

    public JsonElement InputSchema => ParseSchema(
        """{"type":"object","properties":{"query":{"type":"string","description":"Search query"},"scope":{"type":"string","description":"Scope filter: 'global', 'project', or omit to search all"},"limit":{"type":"integer","default":10,"minimum":1,"maximum":50}},"required":["query"]}""");

    public async Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        var query = GetString(input, "query");
        if (string.IsNullOrWhiteSpace(query))
            return new ToolResult("memory_search requires a non-empty 'query' parameter", true);

        var limit = GetInt(input, "limit", 10);
        var scopeInput = GetString(input, "scope");
        var scope = ResolveSearchScope(scopeInput, context);

        var hits = await _search.SearchAsync(query!, scope, limit, context.CancellationToken);

        if (hits.Count == 0)
            return new ToolResult("No matching memory entries found.");

        var sb = new StringBuilder();
        sb.AppendLine($"Matches: {hits.Count}");
        foreach (var hit in hits)
        {
            sb.AppendLine($"- {hit.Title} (scope={hit.Scope}, tier={hit.Tier}, score={hit.Score:0.###})");
            var content = hit.Content;
            if (content.Length > 400)
                content = content[..400] + "…";
            sb.AppendLine("  " + content.Replace("\n", "\n  ", StringComparison.Ordinal));
        }

        return new ToolResult(sb.ToString().TrimEnd());
    }

    private static string? ResolveSearchScope(string? scopeInput, ToolExecutionContext context)
    {
        if (string.IsNullOrWhiteSpace(scopeInput))
            return null; // Search all scopes

        if (scopeInput == "project" && !string.IsNullOrWhiteSpace(context.WorkingFolder))
            return $"project:{context.WorkingFolder}";

        if (scopeInput == "global")
            return "global";

        return scopeInput;
    }
}
