namespace WishfulClaw.Workspace.Memory;

/// <summary>
/// File-based memory store — reads and writes MEMORY.md, daily logs, and dormant files.
/// Hot and Warm tiers are file-driven; Cold tier (SQLite) is handled by MemoryFtsService.
/// </summary>
public interface IMemoryStore
{
    /// <summary>Ensure the memory directory layout exists for the given scope.</summary>
    Task EnsureMemoryLayoutAsync(string scope, CancellationToken ct = default);

    /// <summary>Read MEMORY.md sections for the given scope.</summary>
    Task<IReadOnlyList<MemorySection>> ReadMemoryAsync(string scope, CancellationToken ct = default);

    /// <summary>Write the full MEMORY.md content for the given scope.</summary>
    Task WriteMemoryAsync(string scope, string content, CancellationToken ct = default);

    /// <summary>Write or update a specific section in MEMORY.md by title.</summary>
    Task UpsertSectionAsync(string scope, string title, string body, CancellationToken ct = default);

    /// <summary>Append an entry to today's daily log (memory/daily/YYYY-MM-DD.md).</summary>
    Task AppendDailyAsync(string scope, string content, MemoryPriority priority = MemoryPriority.Standard, CancellationToken ct = default);

    /// <summary>List dormant memory entries (memory/dormant/*.md).</summary>
    Task<IReadOnlyList<MemoryEntry>> ListDormantAsync(string scope, CancellationToken ct = default);

    /// <summary>Read a specific dormant memory file by key.</summary>
    Task<MemoryEntry?> ReadDormantAsync(string scope, string key, CancellationToken ct = default);

    /// <summary>Write a dormant memory file.</summary>
    Task WriteDormantAsync(string scope, string key, string title, string content, MemoryFrontmatter frontmatter, CancellationToken ct = default);

    /// <summary>Promote a dormant entry back to MEMORY.md active section.</summary>
    Task<bool> PromoteDormantAsync(string scope, string key, CancellationToken ct = default);

    /// <summary>Delete a dormant file (used when archiving to DB).</summary>
    Task<bool> DeleteDormantAsync(string scope, string key, CancellationToken ct = default);

    /// <summary>Get memory statistics for the given scope.</summary>
    Task<MemoryStats> GetStatsAsync(string scope, CancellationToken ct = default);
}
