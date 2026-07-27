using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace WishfulClaw.Worker.Tools;

/// <summary>
/// Shared helper methods for tool implementations.
/// </summary>
internal static class ToolHelpers
{
    public static string? GetString(JsonElement element, string name)
    {
        if (element.ValueKind == JsonValueKind.Object &&
            element.TryGetProperty(name, out var prop) &&
            prop.ValueKind == JsonValueKind.String)
        {
            return prop.GetString();
        }
        return null;
    }

    public static int GetInt(JsonElement element, string name, int defaultValue)
    {
        if (element.ValueKind == JsonValueKind.Object &&
            element.TryGetProperty(name, out var prop) &&
            prop.ValueKind == JsonValueKind.Number)
        {
            return prop.GetInt32();
        }
        return defaultValue;
    }

    public static long GetLong(JsonElement element, string name, long defaultValue = 0)
    {
        if (element.ValueKind == JsonValueKind.Object &&
            element.TryGetProperty(name, out var prop) &&
            prop.ValueKind == JsonValueKind.Number)
        {
            return prop.GetInt64();
        }
        return defaultValue;
    }

    public static bool GetBool(JsonElement element, string name, bool defaultValue)
    {
        if (element.ValueKind == JsonValueKind.Object &&
            element.TryGetProperty(name, out var prop))
        {
            if (prop.ValueKind == JsonValueKind.True) return true;
            if (prop.ValueKind == JsonValueKind.False) return false;
        }
        return defaultValue;
    }

    public static string? ResolveFilePath(JsonElement input, string? workingFolder)
    {
        var path = GetString(input, "file_path") ?? GetString(input, "path");
        if (string.IsNullOrWhiteSpace(path))
        {
            return null;
        }

        if (!Path.IsPathRooted(path) && !string.IsNullOrWhiteSpace(workingFolder))
        {
            path = Path.Combine(workingFolder, path);
        }

        return Path.GetFullPath(path);
    }

    public static string ResolveSearchPath(JsonElement input, string? workingFolder)
    {
        var path = GetString(input, "path")?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(path) || path == ".")
        {
            path = workingFolder ?? System.Environment.CurrentDirectory;
        }

        if (!Path.IsPathRooted(path) && !string.IsNullOrWhiteSpace(workingFolder))
        {
            path = Path.Combine(workingFolder, path);
        }

        return Path.GetFullPath(path);
    }

    public static JsonElement ParseSchema(string json)
    {
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    /// <summary>
    /// Writes text to a file and flushes to disk immediately.
    /// Uses FileStream with Flush(true) to ensure subsequent reads
    /// always see the updated content (fixes Edit->Read cache issue).
    /// </summary>
    public static async Task WriteAndFlushAsync(string path, string content, CancellationToken cancellationToken)
    {
        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }
        await using var fs = new FileStream(
            path,
            FileMode.Create,
            FileAccess.Write,
            FileShare.Read,
            bufferSize: 4096,
            useAsync: true);
        var bytes = System.Text.Encoding.UTF8.GetBytes(content);
        await fs.WriteAsync(bytes.AsMemory(0, bytes.Length), cancellationToken);
        await fs.FlushAsync(cancellationToken);
        fs.Flush(true);
    }
}
