
namespace WishfulClaw.Infrastructure.Db;

// ─── Memory Archive Entity (Cold Tier) ───

public class MemoryArchiveEntity
{
    public string Id { get; set; } = string.Empty;

    public string Scope { get; set; } = "global";

    public string Key { get; set; } = string.Empty;

    public string? Title { get; set; }

    public string Content { get; set; } = string.Empty;

    public string Priority { get; set; } = "standard";

    public long CreatedAt { get; set; }

    public long ArchivedAt { get; set; }
}
