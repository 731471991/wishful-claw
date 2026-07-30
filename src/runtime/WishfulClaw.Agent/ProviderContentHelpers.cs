using System.Text;
using System.Text.Json;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent;

/// <summary>
/// Image and tool result content helpers.
/// </summary>
public static class ProviderContentHelpers
{
    // ── Image helpers ──

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
