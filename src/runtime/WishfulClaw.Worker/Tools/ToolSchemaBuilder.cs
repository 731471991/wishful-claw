using System.Text.Json;

namespace WishfulClaw.Worker.Tools;

/// <summary>
/// Helper to build JSON schemas for tool definitions.
/// Provides a fluent API for constructing JSON Schema objects.
/// </summary>
internal static class ToolSchemaBuilder
{
    public static JsonElement Object(
        Dictionary<string, JsonElement>? properties = null,
        string[]? required = null)
    {
        var obj = new Dictionary<string, object?>
        {
            ["type"] = "object"
        };
        if (properties is not null)
            obj["properties"] = properties;
        else
            obj["properties"] = new Dictionary<string, object>();
        obj["required"] = required ?? Array.Empty<string>();
        var json = JsonSerializer.Serialize(obj);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    public static JsonElement String(string description, string[]? enumValues = null)
    {
        var obj = new Dictionary<string, object?>
        {
            ["type"] = "string",
            ["description"] = description
        };
        if (enumValues is not null)
            obj["enum"] = enumValues;
        var json = JsonSerializer.Serialize(obj);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    public static JsonElement Number(string description)
    {
        var obj = new Dictionary<string, object?>
        {
            ["type"] = "number",
            ["description"] = description
        };
        var json = JsonSerializer.Serialize(obj);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    public static JsonElement Boolean(string description)
    {
        var obj = new Dictionary<string, object?>
        {
            ["type"] = "boolean",
            ["description"] = description
        };
        var json = JsonSerializer.Serialize(obj);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    public static JsonElement ArraySchema(string description, JsonElement? items = null)
    {
        var obj = new Dictionary<string, object?>
        {
            ["type"] = "array",
            ["description"] = description
        };
        if (items.HasValue)
            obj["items"] = items.Value;
        var json = JsonSerializer.Serialize(obj);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }
}
