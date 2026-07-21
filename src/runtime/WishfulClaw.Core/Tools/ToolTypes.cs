using System.Text.Json;

namespace WishfulClaw.Core.Tools;

/// <summary>
/// Tool definition sent to the LLM provider.
/// </summary>
public sealed record ToolDefinition(
    string Name,
    string Description,
    JsonElement InputSchema);

/// <summary>
/// Result of executing a tool.
/// </summary>
public sealed record ToolResult(
    string Content,
    bool IsError = false,
    string? Error = null);

/// <summary>
/// Context passed to tool executors.
/// </summary>
public sealed record ToolExecutionContext(
    string? WorkingFolder = null,
    string? SessionId = null,
    string? RunId = null,
    CancellationToken CancellationToken = default);
