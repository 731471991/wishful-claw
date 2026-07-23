using System.Net.Http;
using System.Text.Json;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// HTTP header and body override utilities for provider requests.
/// Reads from provider.requestOverrides configuration.
/// </summary>
internal static class ProviderRequestOverrides
{
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
}
