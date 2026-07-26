using System.Text.Json;

namespace WishfulClaw.Worker.Tools;

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
