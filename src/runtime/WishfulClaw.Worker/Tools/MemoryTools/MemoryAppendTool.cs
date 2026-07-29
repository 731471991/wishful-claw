using System.Text.Json;
using WishfulClaw.Core.Tools;
using WishfulClaw.Worker.Modules.Db;
using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Worker.Tools.MemoryTools;

using static WishfulClaw.Worker.Tools.ToolHelpers;

/// <summary>
/// Append a new memory entry to SQLite.
/// </summary>
public sealed class MemoryAppendTool : IToolExecutor
{
    public string Name => "memory_append";

    public string Description =>
        "Append a new memory entry to the database. " +
        "Use this to record facts, decisions, or insights worth remembering across sessions. " +
        "Specify priority: permanent (core identity, never demote), lasting (important decisions), " +
        "standard (general, default), ephemeral (transient info). " +
        "Returns the entry id for future updates. " +
        "When the user tells you something worth remembering, call this tool to persist it — saying 'got it' without calling the tool means nothing is saved.";

    public JsonElement InputSchema { get; } = ParseSchema(
        """{"type":"object","properties":{"content":{"type":"string","description":"The memory entry to append. Markdown text describing a fact, decision, or insight worth remembering."},"title":{"type":"string","description":"Short title for the memory entry. Auto-generated from content if omitted."},"priority":{"type":"string","enum":["permanent","lasting","standard","ephemeral"],"default":"standard","description":"Memory priority level"}},"required":["content"]}""");

    public Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        var content = GetString(input, "content");
        if (string.IsNullOrWhiteSpace(content))
            return Task.FromResult(new ToolResult("memory_append requires a non-empty 'content' parameter", true));

        var title = GetString(input, "title") ?? GenerateTitle(content!);
        var priorityStr = GetString(input, "priority") ?? "standard";
        var priority = MemoryToolHelpers.NormalizePriority(priorityStr);
        var scope = MemoryToolHelpers.ResolveScope(context);

        var db = DbClient.GetClient();
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var entry = new MemoryEntryEntity
        {
            Scope = scope,
            Title = title,
            Content = content!,
            Priority = priority.ToString().ToLowerInvariant(),
            Status = "active",
            CreatedAt = now,
            UpdatedAt = now
        };
        var id = db.Insertable(entry).ExecuteReturnIdentity();

        return Task.FromResult(new ToolResult(
            $"Memory entry #{id} appended successfully (priority={priority.ToString().ToLowerInvariant()}, scope={scope})."));
    }

    private static string GenerateTitle(string content)
    {
        var firstLine = content.Split('\n')[0].Trim();
        return firstLine.Length > 80 ? firstLine[..80] + "\u2026" : firstLine;
    }
}
