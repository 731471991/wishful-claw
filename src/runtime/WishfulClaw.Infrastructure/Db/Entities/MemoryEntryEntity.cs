
namespace WishfulClaw.Infrastructure.Db;

/// <summary>
/// Memory entry stored in SQLite. Replaces file-based dormant/daily storage.
/// </summary>
public class MemoryEntryEntity
{
    public long Id { get; set; }

    public string Scope { get; set; } = "global";

    public string? Title { get; set; }

    public string Content { get; set; } = string.Empty;

    public string Priority { get; set; } = "standard";

    public string Status { get; set; } = "active";

    public long CreatedAt { get; set; }

    public long UpdatedAt { get; set; }
}
