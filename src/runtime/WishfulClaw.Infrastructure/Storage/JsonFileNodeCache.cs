using System.Text.Json;
using System.Text.Json.Nodes;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Infrastructure.Storage;

/// <summary>
/// Simple file-backed JSON cache. Tracks file size + last-write ticks to avoid
/// re-reading unchanged files. Used by ConfigStore and ProviderStore.
/// </summary>
public sealed class JsonFileNodeCache<TNode> where TNode : JsonNode
{
    private const long DefaultMaxCachedFileBytes = 2L * 1024 * 1024;
    private readonly long _maxCachedFileBytes;
    private TNode? _cached;
    private long _cachedLength = -1;
    private long _cachedWriteTicks = -1;

    public JsonFileNodeCache(long maxCachedFileBytes = DefaultMaxCachedFileBytes)
    {
        _maxCachedFileBytes = Math.Max(0, maxCachedFileBytes);
    }

    public TNode? Read(
        string filePath,
        JsonValueKind expectedKind,
        Func<JsonElement, TNode?> clone,
        string label)
    {
        if (!File.Exists(filePath))
        {
            _cached = null;
            _cachedLength = -1;
            _cachedWriteTicks = -1;
            return null;
        }

        try
        {
            var info = new FileInfo(filePath);
            if (_cached is not null &&
                info.Length == _cachedLength &&
                info.LastWriteTimeUtc.Ticks == _cachedWriteTicks)
            {
                return (TNode)_cached.DeepClone();
            }

            using var document = JsonDocument.Parse(File.ReadAllBytes(filePath));
            if (document.RootElement.ValueKind != expectedKind)
            {
                WorkerLog.Warn($"{label} has an invalid root type; ignoring content");
                return null;
            }

            var parsed = clone(document.RootElement);
            if (parsed is null) return null;
            Store(filePath, parsed);
            return parsed;
        }
        catch (Exception ex)
        {
            WorkerLog.Warn($"{label} read failed error={ex.GetType().Name}: {ex.Message}");
            return null;
        }
    }

    public void Store(string filePath, TNode value)
    {
        var info = new FileInfo(filePath);
        _cachedLength = info.Exists ? info.Length : -1;
        _cachedWriteTicks = info.Exists ? info.LastWriteTimeUtc.Ticks : -1;
        _cached = info.Exists && info.Length <= _maxCachedFileBytes
            ? (TNode)value.DeepClone()
            : null;
    }
}
