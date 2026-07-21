using System.Buffers;
using System.Net.Http;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Shared provider support utilities: header overrides, body overrides,
/// JSON element creation helpers.
/// </summary>
internal static class AgentRuntimeProviderSupport
{
    private static readonly JsonWriterOptions WriterOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private static readonly JsonSerializerOptions StringSerializeOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    // ── Body overrides ──

    public static HashSet<string> GetOmittedBodyKeys(JsonElement provider)
    {
        var result = new HashSet<string>(StringComparer.Ordinal);
        if (!provider.TryGetProperty("requestOverrides", out var overrides) ||
            overrides.ValueKind != JsonValueKind.Object ||
            !overrides.TryGetProperty("omitBodyKeys", out var keys) ||
            keys.ValueKind != JsonValueKind.Array)
        {
            return result;
        }

        foreach (var key in keys.EnumerateArray())
        {
            if (key.ValueKind == JsonValueKind.String && key.GetString() is { Length: > 0 } value)
            {
                result.Add(value);
            }
        }
        return result;
    }

    public static void WriteBodyOverrides(
        Utf8JsonWriter writer,
        JsonElement provider,
        HashSet<string>? omitted = null)
    {
        if (!provider.TryGetProperty("requestOverrides", out var overrides) ||
            overrides.ValueKind != JsonValueKind.Object ||
            !overrides.TryGetProperty("body", out var body) ||
            body.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        foreach (var property in body.EnumerateObject())
        {
            if (omitted?.Contains(property.Name) == true)
            {
                continue;
            }
            property.WriteTo(writer);
        }
    }

    // ── Header overrides ──

    public static void ApplyHttpHeaderOverrides(
        HttpRequestMessage request,
        JsonElement provider,
        Func<string, bool>? shouldSkip = null)
    {
        if (!provider.TryGetProperty("requestOverrides", out var overrides) ||
            overrides.ValueKind != JsonValueKind.Object ||
            !overrides.TryGetProperty("headers", out var headers) ||
            headers.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        var sessionId = JsonHelpers.GetString(provider, "sessionId") ?? string.Empty;
        var model = JsonHelpers.GetString(provider, "model") ?? string.Empty;
        foreach (var property in headers.EnumerateObject())
        {
            if (property.Value.ValueKind != JsonValueKind.String ||
                shouldSkip?.Invoke(property.Name) == true)
            {
                continue;
            }

            var value = ResolveHeaderTemplate(property.Value.GetString() ?? string.Empty, sessionId, model);
            if (value.Length == 0)
            {
                continue;
            }
            request.Headers.Remove(property.Name);
            request.Headers.TryAddWithoutValidation(property.Name, value);
        }
    }

    public static void ApplyDebugHeaderOverrides(
        Dictionary<string, string> headers,
        JsonElement provider,
        Func<string, bool>? shouldSkip = null)
    {
        if (!provider.TryGetProperty("requestOverrides", out var overrides) ||
            overrides.ValueKind != JsonValueKind.Object ||
            !overrides.TryGetProperty("headers", out var overrideHeaders) ||
            overrideHeaders.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        var sessionId = JsonHelpers.GetString(provider, "sessionId") ?? string.Empty;
        var model = JsonHelpers.GetString(provider, "model") ?? string.Empty;
        foreach (var property in overrideHeaders.EnumerateObject())
        {
            if (property.Value.ValueKind != JsonValueKind.String ||
                shouldSkip?.Invoke(property.Name) == true)
            {
                continue;
            }

            var value = ResolveHeaderTemplate(property.Value.GetString() ?? string.Empty, sessionId, model);
            if (value.Length == 0)
            {
                continue;
            }
            headers[property.Name] = IsSensitiveHeader(property.Name) ? "***" : value;
        }
    }

    public static string ResolveHeaderTemplate(string value, string sessionId, string model)
    {
        return value
            .Replace("{{sessionId}}", sessionId, StringComparison.Ordinal)
            .Replace("{{ sessionId }}", sessionId, StringComparison.Ordinal)
            .Replace("{{model}}", model, StringComparison.Ordinal)
            .Replace("{{ model }}", model, StringComparison.Ordinal)
            .Trim();
    }

    public static bool IsSensitiveHeader(string name)
    {
        return name.Contains("authorization", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("api-key", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("apikey", StringComparison.OrdinalIgnoreCase) ||
            name.Contains("token", StringComparison.OrdinalIgnoreCase);
    }

    // ── JSON element creation helpers ──

    public static JsonElement CreateEmptyObjectElement()
    {
        using var document = JsonDocument.Parse("{}");
        return document.RootElement.Clone();
    }

    public static JsonElement CreateStringElement(string value)
    {
        return JsonSerializer.SerializeToElement(value, StringSerializeOptions);
    }

    public static JsonElement CreateObjectElement(Action<Utf8JsonWriter> writeProperties)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer, WriterOptions))
        {
            writer.WriteStartObject();
            writeProperties(writer);
            writer.WriteEndObject();
        }
        using var document = JsonDocument.Parse(buffer.WrittenMemory);
        return document.RootElement.Clone();
    }

    // ── Image helpers (simplified) ──

    public static string StripDataUrlPrefix(string? value)
    {
        var trimmed = value?.Trim() ?? string.Empty;
        var marker = ";base64,";
        var markerIndex = trimmed.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        return markerIndex >= 0 ? trimmed[(markerIndex + marker.Length)..] : trimmed;
    }

    public static string? DetectImageMediaTypeFromBase64(string? imageBase64)
    {
        var normalized = StripDataUrlPrefix(imageBase64).Replace(" ", string.Empty);
        if (normalized.Length == 0)
        {
            return null;
        }
        if (normalized.StartsWith("iVBORw0KGgo", StringComparison.Ordinal))
        {
            return "image/png";
        }
        if (normalized.StartsWith("/9j/", StringComparison.Ordinal))
        {
            return "image/jpeg";
        }
        if (normalized.StartsWith("UklGR", StringComparison.Ordinal))
        {
            return "image/webp";
        }
        return null;
    }

    // ── Tool result helpers ──

    public static string ToolResultToString(JsonElement content)
    {
        if (content.ValueKind == JsonValueKind.String)
        {
            return content.GetString() ?? string.Empty;
        }

        if (content.ValueKind != JsonValueKind.Array)
        {
            return content.GetRawText();
        }

        var text = new StringBuilder();
        foreach (var block in content.EnumerateArray())
        {
            if (JsonHelpers.GetString(block, "type") == "text" &&
                JsonHelpers.GetString(block, "text") is { Length: > 0 } blockText)
            {
                if (text.Length > 0)
                {
                    text.Append('\n');
                }
                text.Append(blockText);
            }
        }
        return text.ToString();
    }
}
