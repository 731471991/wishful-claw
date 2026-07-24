namespace WishfulClaw.Workspace.Memory;

/// <summary>
/// Memory tier — lifecycle stage of a memory entry.
/// Hot: active in MEMORY.md, loaded at startup.
/// Warm: demoted to dormant/, searchable but not auto-loaded.
/// Cold: archived to SQLite,检索 only.
/// </summary>
public enum MemoryTier
{
    Hot,
    Warm,
    Cold
}

/// <summary>
/// Memory priority — influences demotion behaviour.
/// Directly adopted from KodaClaw's priority system.
/// </summary>
public enum MemoryPriority
{
    /// <summary>Core identity / values — never demote.</summary>
    Permanent,

    /// <summary>Important decisions, long-term context — demote only when clearly stale.</summary>
    Lasting,

    /// <summary>General entries, tech lessons, bug notes — demote after 30+ days inactive (default).</summary>
    Standard,

    /// <summary>Transient info — demote after 7 days.</summary>
    Ephemeral
}

/// <summary>
/// A single memory entry parsed from MEMORY.md or a dormant file.
/// </summary>
public sealed record MemoryEntry
{
    /// <summary>Normalized key (lowercased, hyphenated title).</summary>
    public required string Key { get; init; }

    /// <summary>Human-readable title (the ## heading from MEMORY.md or filename).</summary>
    public required string Title { get; init; }

    /// <summary>Markdown body content.</summary>
    public required string Content { get; init; }

    /// <summary>Priority level.</summary>
    public MemoryPriority Priority { get; init; } = MemoryPriority.Standard;

    /// <summary>Current tier (Hot/Warm/Cold).</summary>
    public MemoryTier Tier { get; init; } = MemoryTier.Hot;

    /// <summary>Scope: "global" or "project:{projectId}".</summary>
    public required string Scope { get; init; }

    /// <summary>Creation timestamp (ISO 8601 string from frontmatter).</summary>
    public string? Created { get; init; }

    /// <summary>Tags from frontmatter.</summary>
    public string[] Tags { get; init; } = [];

    /// <summary>Source file path (relative to workspace root).</summary>
    public string? SourcePath { get; init; }
}

/// <summary>
/// A search result hit with relevance score.
/// </summary>
public sealed record MemorySearchResult
{
    public required long Id { get; init; }
    public required string Title { get; init; }
    public required string Content { get; init; }
    public required string Scope { get; init; }
    public required string Priority { get; init; }
    public required string Status { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}

/// <summary>
/// Statistics for memory dashboard.
/// </summary>
public sealed record MemoryStats
{
    public int HotCount { get; init; }
    public int WarmCount { get; init; }
    public int ColdCount { get; init; }
    public int TopicsCount { get; init; }
    public int DailyCount { get; init; }
}

/// <summary>
/// Parsed frontmatter from a memory markdown file.
/// </summary>
public sealed record MemoryFrontmatter
{
    public MemoryPriority Priority { get; init; } = MemoryPriority.Standard;
    public string Status { get; init; } = "active";
    public string? Created { get; init; }
    public string? Title { get; init; }
    public string[] Tags { get; init; } = [];
    public string? ValidUntil { get; init; }
    public int BodyStartLine { get; init; }
}

/// <summary>
/// A parsed section from MEMORY.md (## heading + body).
/// </summary>
public sealed record MemorySection
{
    public required string Title { get; init; }
    public required string Body { get; init; }
}
