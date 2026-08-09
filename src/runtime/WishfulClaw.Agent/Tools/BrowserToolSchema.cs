using System.Buffers;
using System.Text.Json;

namespace WishfulClaw.Agent.Tools;

/// <summary>
/// Helper to create the JSON schema for browser tool inputs.
/// AOT-safe: uses Utf8JsonWriter instead of JsonSerializer.Serialize.
/// </summary>
internal static class BrowserToolSchema
{
    public static JsonElement CreateObjectSchema(Dictionary<string, JsonElement> properties, string[]? required = null)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
        {
            writer.WriteStartObject();
            writer.WriteString("type", "object");
            writer.WritePropertyName("properties");
            writer.WriteStartObject();
            foreach (var kvp in properties)
            {
                writer.WritePropertyName(kvp.Key);
                kvp.Value.WriteTo(writer);
            }
            writer.WriteEndObject();
            writer.WritePropertyName("required");
            writer.WriteStartArray();
            if (required is not null)
                foreach (var r in required)
                    writer.WriteStringValue(r);
            writer.WriteEndArray();
            writer.WriteEndObject();
        }
        using var doc = JsonDocument.Parse(buffer.WrittenMemory);
        return doc.RootElement.Clone();
    }

    public static JsonElement CreateStringProperty(string description)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
        {
            writer.WriteStartObject();
            writer.WriteString("type", "string");
            writer.WriteString("description", description);
            writer.WriteEndObject();
        }
        using var doc = JsonDocument.Parse(buffer.WrittenMemory);
        return doc.RootElement.Clone();
    }

    public static JsonElement CreateBooleanProperty(string description, bool? defaultValue = null)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
        {
            writer.WriteStartObject();
            writer.WriteString("type", "boolean");
            writer.WriteString("description", description);
            if (defaultValue.HasValue)
                writer.WriteBoolean("default", defaultValue.Value);
            writer.WriteEndObject();
        }
        using var doc = JsonDocument.Parse(buffer.WrittenMemory);
        return doc.RootElement.Clone();
    }

    public static JsonElement CreateNumberProperty(string description)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
        {
            writer.WriteStartObject();
            writer.WriteString("type", "number");
            writer.WriteString("description", description);
            writer.WriteEndObject();
        }
        using var doc = JsonDocument.Parse(buffer.WrittenMemory);
        return doc.RootElement.Clone();
    }
}
