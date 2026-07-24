using System.Text.Json;
using System.Text;
using WishfulClaw.Core.Tools;
using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Worker.Tools.MemoryTools;

using static WishfulClaw.Worker.Tools.ToolHelpers;

/// <summary>
/// Read hot memory (MEMORY.md) — full content, all sections.
/// </summary>
public sealed class MemoryHotReadTool : IToolExecutor
{
    private readonly IMemoryStore _store;

    public MemoryHotReadTool(IMemoryStore store) => _store = store;

    public string Name => "memory_hot_read";

    public string Description =>
        "Read the full hot memory (MEMORY.md). Returns all sections with their content. " +
        "Hot memory contains the most important, always-loaded context. Call this when you need to refresh your understanding of key facts.";

    public JsonElement InputSchema => ParseSchema(
        """{"type":"object","properties":{"scope":{"type":"string","description":"Scope: 'global' or 'project'. Defaults to current project."}},"required":[]}""");

    public async Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        var scope = MemoryToolHelpers.ResolveScope(input, context);
        await _store.EnsureMemoryLayoutAsync(scope, context.CancellationToken);
        var sections = await _store.ReadMemoryAsync(scope, context.CancellationToken);
        if (sections.Count == 0)
            return new ToolResult("MEMORY.md is empty or does not exist.");

        var sb = new StringBuilder();
        sb.AppendLine($"MEMORY.md ({scope}) — {sections.Count} sections:");
        foreach (var s in sections)
        {
            sb.AppendLine($"\n## {s.Title}");
            sb.AppendLine(s.Body);
        }
        return new ToolResult(sb.ToString().TrimEnd());
    }
}
