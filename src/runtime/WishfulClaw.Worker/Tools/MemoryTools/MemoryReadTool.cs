using System.Text.Json;
using System.Text;
using WishfulClaw.Core.Tools;
using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Worker.Tools.MemoryTools;

using static WishfulClaw.Worker.Tools.ToolHelpers;

/// <summary>
/// Read memory files: MEMORY.md, dormant entries, or topics.
/// Adapted from OpenClaw.net's MemoryNoteTool (read action).
/// </summary>
public sealed class MemoryReadTool : IToolExecutor
{
    private readonly IMemoryStore _store;

    public MemoryReadTool(IMemoryStore store) => _store = store;

    public string Name => "memory_read";

    public string Description =>
        "Read memory files. Target options: 'memory' (MEMORY.md hot memory), 'dormant' (list warm memory entries), " +
        "'dormant:{key}' (read specific dormant entry), 'topics' (list topic files), 'stats' (memory statistics).";

    public JsonElement InputSchema => ParseSchema(
        """{"type":"object","properties":{"target":{"type":"string","description":"What to read: 'memory', 'dormant', 'dormant:{key}', 'topics', 'stats'","default":"memory"},"scope":{"type":"string","description":"Scope: 'global' or 'project'. Defaults to current project."}},"required":[]}""");

    public async Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        var target = GetString(input, "target") ?? "memory";
        var scope = MemoryAppendTool.ResolveScope(input, context);

        await _store.EnsureMemoryLayoutAsync(scope, context.CancellationToken);

        // ── stats ──
        if (target == "stats")
        {
            var stats = await _store.GetStatsAsync(scope, context.CancellationToken);
            return new ToolResult(
                $"Memory Stats (scope={scope}):\n" +
                $"  Hot: {stats.HotCount}\n" +
                $"  Warm: {stats.WarmCount}\n" +
                $"  Cold: {stats.ColdCount}\n" +
                $"  Topics: {stats.TopicsCount}\n" +
                $"  Daily logs: {stats.DailyCount}");
        }

        // ── memory (MEMORY.md) ──
        if (target == "memory")
        {
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

        // ── dormant (list) ──
        if (target == "dormant")
        {
            var entries = await _store.ListDormantAsync(scope, context.CancellationToken);
            if (entries.Count == 0)
                return new ToolResult("No dormant memory entries found.");

            var sb = new StringBuilder();
            sb.AppendLine($"Dormant memory ({scope}) — {entries.Count} entries:");
            foreach (var e in entries)
            {
                sb.AppendLine($"- {e.Key} (priority={e.Priority}, created={e.Created ?? "unknown"})");
            }
            return new ToolResult(sb.ToString().TrimEnd());
        }

        // ── dormant:{key} (read specific) ──
        if (target.StartsWith("dormant:", StringComparison.OrdinalIgnoreCase))
        {
            var key = target["dormant:".Length..].Trim();
            var entry = await _store.ReadDormantAsync(scope, key, context.CancellationToken);
            if (entry is null)
                return new ToolResult($"No dormant memory entry found for key: {key}", true);

            return new ToolResult(
                $"Key: {entry.Key}\n" +
                $"Title: {entry.Title}\n" +
                $"Priority: {entry.Priority}\n" +
                $"Created: {entry.Created ?? "unknown"}\n\n" +
                entry.Content);
        }

        // ── topics ──
        if (target == "topics")
        {
            var topicsDir = MemoryPathResolver.GetTopicsDir(scope);
            if (!System.IO.Directory.Exists(topicsDir))
                return new ToolResult("No topics directory found.");

            var files = System.IO.Directory.GetFiles(topicsDir, "*.md");
            if (files.Length == 0)
                return new ToolResult("No topic files found.");

            var sb = new StringBuilder();
            sb.AppendLine($"Topics ({scope}) — {files.Length} files:");
            foreach (var f in files)
            {
                sb.AppendLine($"- {System.IO.Path.GetFileNameWithoutExtension(f)}");
            }
            return new ToolResult(sb.ToString().TrimEnd());
        }

        return new ToolResult($"Unknown target: {target}. Use 'memory', 'dormant', 'dormant:{{key}}', 'topics', or 'stats'.", true);
    }
}
