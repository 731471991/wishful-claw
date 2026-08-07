using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace WishfulClaw.Core.Tools;

/// <summary>
/// Interface for tool executors. Each tool implements this interface.
/// Executor pattern — each tool is self-contained, adding a tool = new file.
/// </summary>
public interface IToolExecutor
{
    /// <summary>
    /// Tool name (e.g. "Read", "Write", "Bash").
    /// </summary>
    string Name { get; }

    /// <summary>
    /// Human-readable description for the LLM.
    /// </summary>
    string Description { get; }

    /// <summary>
    /// JSON schema for the tool's input parameters.
    /// </summary>
    JsonElement InputSchema { get; }

    /// <summary>
    /// The session modes this tool is available in. null = all modes.
    /// e.g. ["normal"] = only in normal mode, ["goal"] = only in goal mode.
    /// Default implementation returns null (available in all modes).
    /// </summary>
    string[]? AvailableModes => null;

    /// <summary>
    /// Execute the tool with the given input and context.
    /// </summary>
    Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context);
}