namespace WishfulClaw.Workspace.Memory;

/// <summary>
/// File-based hot memory store — only manages MEMORY.md.
/// All other memory data lives in SQLite (memory_entries table).
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

    /// <summary>Delete a section from MEMORY.md by title.</summary>
    Task<bool> DeleteSectionAsync(string scope, string title, CancellationToken ct = default);

    /// <summary>Get memory statistics for the given scope.</summary>
    Task<MemoryStats> GetStatsAsync(string scope, CancellationToken ct = default);
}
