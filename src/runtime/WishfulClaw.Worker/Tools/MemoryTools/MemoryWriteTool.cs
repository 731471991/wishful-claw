using System.Text.Json;
using WishfulClaw.Core.Tools;
using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Worker.Tools.MemoryTools;

using static WishfulClaw.Worker.Tools.ToolHelpers;

/// <summary>
/// Write or update a section in MEMORY.md.
/// Adapted from OpenClaw.net's MemoryNoteTool (write action) + KodaClaw's section upsert.
/// </summary>
public sealed class MemoryWriteTool : IToolExecutor
{
    private readonly IMemoryStore _store;
    private readonly IMemorySearch _search;

    public MemoryWriteTool(IMemoryStore store, IMemorySearch search)
    {
        _store = store;
        _search = search;
    }

    public string Name => "memory_write";

    public string Description =>
        "Write or update a section in MEMORY.md (hot memory). " +
        "If the section title exists, its content is replaced. Otherwise a new section is appended. " +
        "The FTS index is automatically updated.";

    public JsonElement InputSchema => ParseSchema(
        """{"type":"object","properties":{"section":{"type":"string","description":"Section title (the ## heading in MEMORY.md)"},"content":{"type":"string","description":"Markdown content for the section"},"scope":{"type":"string","description":"Scope: 'global' or 'project'. Defaults to current project."}},"required":["section","content"]}""");

    public async Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        var section = GetString(input, "section");
        var content = GetString(input, "content");

        if (string.IsNullOrWhiteSpace(section))
            return new ToolResult("memory_write requires a non-empty 'section' parameter", true);
        if (string.IsNullOrWhiteSpace(content))
            return new ToolResult("memory_write requires a non-empty 'content' parameter", true);

        var scope = MemoryAppendTool.ResolveScope(input, context);

        await _store.EnsureMemoryLayoutAsync(scope, context.CancellationToken);
        await _store.UpsertSectionAsync(scope, section!, content!, context.CancellationToken);

        // Update FTS index
        var key = MemoryMarkdownParser.NormalizeKey(section!);
        await _search.IndexAsync(scope, key, section!, content!, context.CancellationToken);

        return new ToolResult($"Memory section '{section}' written successfully (scope={scope}, key={key})");
    }
}
