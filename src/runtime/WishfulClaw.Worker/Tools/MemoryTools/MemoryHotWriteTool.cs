using System.Text.Json;
using WishfulClaw.Core.Tools;
using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Worker.Tools.MemoryTools;

using static WishfulClaw.Worker.Tools.ToolHelpers;

/// <summary>
/// Write, update, or delete a section in hot memory (MEMORY.md).
/// </summary>
public sealed class MemoryHotWriteTool : IToolExecutor
{
    private readonly IMemoryStore _store;

    public MemoryHotWriteTool(IMemoryStore store) => _store = store;

    public string Name => "memory_hot_write";

    public string Description =>
        "Write, update, or delete a section in hot memory (MEMORY.md). " +
        "If the section title exists, its content is replaced. Otherwise a new section is appended. " +
        "Set content to empty string to delete the section. " +
        "Use this for important context that should always be loaded.";

    public JsonElement InputSchema => ParseSchema(
        """{"type":"object","properties":{"section":{"type":"string","description":"Section title (the ## heading in MEMORY.md)"},"content":{"type":"string","description":"Markdown content for the section. Empty string to delete the section."}},"required":["section"]}""");

    public async Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        var section = GetString(input, "section");
        if (string.IsNullOrWhiteSpace(section))
            return new ToolResult("memory_hot_write requires a non-empty 'section' parameter", true);

        var content = GetString(input, "content");
        var scope = MemoryToolHelpers.ResolveScope(context);
        await _store.EnsureMemoryLayoutAsync(scope, context.CancellationToken);

        if (string.IsNullOrWhiteSpace(content))
        {
            // Delete section
            var deleted = await _store.DeleteSectionAsync(scope, section!, context.CancellationToken);
            return deleted
                ? new ToolResult($"Section '{section}' deleted from hot memory (scope={scope}).")
                : new ToolResult($"Section '{section}' not found in hot memory (scope={scope}).", true);
        }

        await _store.UpsertSectionAsync(scope, section!, content!, context.CancellationToken);
        return new ToolResult($"Section '{section}' written to hot memory (scope={scope}).");
    }
}
