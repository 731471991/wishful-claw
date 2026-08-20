using System.Collections.Concurrent;

namespace WishfulClaw.Agent;

/// <summary>
/// Caches built system prompts by input parameters.
/// Design inspired by Reasonix: system prompt is built once (boot equivalent)
/// and stays byte-stable across turns to maximize provider prefix cache hits.
/// Memory content (MEMORY.md) is read once and cached — mid-session changes
/// don't touch the prefix, they ride transient user-message injection.
/// </summary>
public static class SystemPromptCache
{
    private static readonly ConcurrentDictionary<string, string> _cache = new();

    /// <summary>
    /// Returns cached prompt if key matches, otherwise builds and caches.
    /// </summary>
    public static string GetOrBuild(string cacheKey, Func<string> builder)
    {
        return _cache.GetOrAdd(cacheKey, _ => builder());
    }

    /// <summary>
    /// Invalidate a specific cache entry (e.g., persona edited).
    /// </summary>
    public static void Invalidate(string cacheKey)
    {
        _cache.TryRemove(cacheKey, out _);
    }

    /// <summary>
    /// Clear all cached prompts.
    /// </summary>
    public static void Clear() => _cache.Clear();

    /// <summary>
    /// Compute a cache key from the parameters that affect system prompt content.
    /// Changes to any of these will miss the cache and rebuild.
    /// </summary>
    public static string ComputeKey(
        string? personaId,
        string? workingFolder,
        string? language,
        string? userRules,
        string? sshConnectionId,
        string? projectId,
        string? sessionMode = null)
    {
        return string.Join('|',
            personaId ?? string.Empty,
            workingFolder ?? string.Empty,
            language ?? string.Empty,
            userRules ?? string.Empty,
            sshConnectionId ?? string.Empty,
            projectId ?? string.Empty,
            sessionMode ?? string.Empty);
    }
}
