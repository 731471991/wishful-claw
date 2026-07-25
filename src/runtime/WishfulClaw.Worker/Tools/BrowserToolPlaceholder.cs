using System.Text.Json;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Worker.Tools;

/// <summary>
/// Placeholder tool definitions for browser tools.
/// Actual execution is handled by ToolCallProcessor → AgentRuntimeBrowserExecutor → reverse-request.
/// These are only registered so that tool/list includes them in the LLM's available tools list.
/// </summary>
internal sealed class BrowserToolPlaceholder : IToolExecutor
{
    public string Name { get; }
    public string Description { get; }
    public JsonElement InputSchema { get; }

    public BrowserToolPlaceholder(string name, string description, JsonElement inputSchema)
    {
        Name = name;
        Description = description;
        InputSchema = inputSchema;
    }

    public Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        // This should never be called — ToolCallProcessor intercepts browser tools
        // before reaching the registry. If it IS called, something is wrong.
        return Task.FromResult(new ToolResult(
            $"Browser tool '{Name}' should be executed via the renderer, not the native worker. " +
            "This is a bug in the tool routing logic.",
            true));
    }
}

/// <summary>
/// Helper to create the JSON schema for browser tool inputs.
/// </summary>
internal static class BrowserToolSchema
{
    public static JsonElement CreateObjectSchema(Dictionary<string, JsonElement> properties, string[]? required = null)
    {
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(new
        {
            type = "object",
            properties,
            required = required ?? Array.Empty<string>()
        }));
        return doc.RootElement.Clone();
    }

    public static JsonElement CreateStringProperty(string description)
    {
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(new
        {
            type = "string",
            description
        }));
        return doc.RootElement.Clone();
    }

    public static JsonElement CreateBooleanProperty(string description, bool? defaultValue = null)
    {
        var obj = new Dictionary<string, object?>
        {
            ["type"] = "boolean",
            ["description"] = description
        };
        if (defaultValue.HasValue) obj["default"] = defaultValue.Value;
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(obj));
        return doc.RootElement.Clone();
    }

    public static JsonElement CreateNumberProperty(string description)
    {
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(new
        {
            type = "number",
            description
        }));
        return doc.RootElement.Clone();
    }
}