using System.Text.Json;

namespace WishfulClaw.Core.Protocol;

public static class JsonHelpers
{
    public static string? GetString(JsonElement element, string name)
    {
        if (element.ValueKind != JsonValueKind.Object || !element.TryGetProperty(name, out var property))
        {
            return null;
        }
        return property.ValueKind == JsonValueKind.String ? property.GetString() : null;
    }
}
