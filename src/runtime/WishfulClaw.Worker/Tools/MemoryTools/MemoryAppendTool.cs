using System.Text.Json;
using WishfulClaw.Core.Tools;
using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Worker.Tools.MemoryTools;

using static WishfulClaw.Worker.Tools.ToolHelpers;

/// <summary>
/// Append a memory entry to today's daily log.
/// Adapted from KodaClaw's WorkspaceMemoryAppendTool.
/// </summary>
public sealed class MemoryAppendTool : IToolExecutor
{
    private static readonly HashSet<string> ValidPriorities = new(StringComparer.OrdinalIgnoreCase)
    {
        "permanent", "lasting", "standard", "ephemeral"
    };

    private readonly IMemoryStore _store;
    private readonly IMemorySearch _search;

    public MemoryAppendTool(IMemoryStore store, IMemorySearch search)
    {
        _store = store;
        _search = search;
    }

    public string Name => "memory_append";

    public string Description =>
        "Append a memory entry to today's daily memory log. " +
        "Use this to record important facts, decisions, or insights worth remembering across sessions. " +
        "Specify priority: permanent (core identity), lasting (important decisions), " +
        "standard (general, default), ephemeral (transient info).";

    public JsonElement InputSchema => ParseSchema(
        """{"type":"object","properties":{"content":{"type":"string","description":"The memory entry to append. Markdown text describing a fact, decision, or insight worth remembering."},"priority":{"type":"string","enum":["permanent","lasting","standard","ephemeral"],"default":"standard","description":"Memory priority level"},"scope":{"type":"string","description":"Memory scope: 'global' or 'project'. Defaults to current project if available."}},"required":["content"]}""");

    public async Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        var content = GetString(input, "content");
        if (string.IsNullOrWhiteSpace(content))
            return new ToolResult("memory_append requires a non-empty 'content' parameter", true);

        var priorityStr = GetString(input, "priority") ?? "standard";
        var priority = NormalizePriority(priorityStr);

        var scope = ResolveScope(input, context);

        await _store.EnsureMemoryLayoutAsync(scope, context.CancellationToken);
        await _store.AppendDailyAsync(scope, content!, priority, context.CancellationToken);

        // Also index in FTS for immediate searchability
        var date = DateTimeOffset.Now.ToString("yyyy-MM-dd");
        var key = $"daily-{date}";
        var title = $"Daily Memory {date}";
        await _search.IndexAsync(scope, key, title, content!, context.CancellationToken);

        return new ToolResult($"Memory appended successfully (scope={scope}, priority={priority.ToString().ToLowerInvariant()}, date={date})");
    }

    internal static string ResolveScope(JsonElement input, ToolExecutionContext context)
    {
        var scope = GetString(input, "scope");
        if (!string.IsNullOrWhiteSpace(scope))
        {
            if (scope == "project" && !string.IsNullOrWhiteSpace(context.WorkingFolder))
                return $"project:{context.WorkingFolder}";
            if (scope == "global")
                return "global";
            return scope;
        }

        // Default: project scope if workingFolder available, otherwise global
        return !string.IsNullOrWhiteSpace(context.WorkingFolder)
            ? $"project:{context.WorkingFolder}"
            : "global";
    }

    internal static MemoryPriority NormalizePriority(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return MemoryPriority.Standard;

        return value.Trim().ToLowerInvariant() switch
        {
            "permanent" or "p0" => MemoryPriority.Permanent,
            "lasting" or "p1" => MemoryPriority.Lasting,
            "standard" or "p2" => MemoryPriority.Standard,
            "ephemeral" or "p3" => MemoryPriority.Ephemeral,
            _ => MemoryPriority.Standard
        };
    }
}
