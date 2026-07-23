namespace WishfulClaw.Workspace.Memory;

/// <summary>
/// Full-text search over memory entries (hot + warm + cold).
/// Hot/Warm: FTS5 index synced from Markdown files.
/// Cold: FTS5 index on memory_archive table.
/// </summary>
public interface IMemorySearch
{
    /// <summary>
    /// Search memory by query string. Searches project-scoped first, then global.
    /// Returns results sorted by relevance score descending.
    /// </summary>
    /// <param name="query">Search query.</param>
    /// <param name="scope">Scope filter ("project:{id}" or "global"). If null, searches all scopes.</param>
    /// <param name="limit">Max results (default 10, max 50).</param>
    Task<IReadOnlyList<MemorySearchResult>> SearchAsync(
        string query,
        string? scope = null,
        int limit = 10,
        CancellationToken ct = default);

    /// <summary>
    /// Index or update a memory entry in the FTS index.
    /// Called by MemoryStore when hot/warm memory files change.
    /// </summary>
    Task IndexAsync(string scope, string key, string title, string content, CancellationToken ct = default);

    /// <summary>
    /// Remove a memory entry from the FTS index.
    /// </summary>
    Task RemoveFromIndexAsync(string scope, string key, CancellationToken ct = default);

    /// <summary>
    /// Archive a dormant memory entry to the SQLite memory_archive table (cold tier).
    /// </summary>
    Task ArchiveToColdAsync(string scope, string key, string title, string content, MemoryPriority priority, CancellationToken ct = default);

    /// <summary>
    /// Search cold memory (archived in SQLite) only.
    /// </summary>
    Task<IReadOnlyList<MemorySearchResult>> SearchColdAsync(
        string query,
        string? scope = null,
        int limit = 10,
        CancellationToken ct = default);
}
