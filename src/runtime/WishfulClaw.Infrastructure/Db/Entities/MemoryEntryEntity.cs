using SqlSugar;

namespace WishfulClaw.Infrastructure.Db;

/// <summary>
/// Memory entry stored in SQLite. Replaces file-based dormant/daily storage.
/// </summary>
[SugarTable("memory_entries")]
public class MemoryEntryEntity
{
    [SugarColumn(IsPrimaryKey = true, IsIdentity = true, ColumnName = "id")]
    public long Id { get; set; }

    [SugarColumn(ColumnName = "scope")]
    public string Scope { get; set; } = "global";

    [SugarColumn(ColumnName = "title", IsNullable = true)]
    public string? Title { get; set; }

    [SugarColumn(ColumnName = "content")]
    public string Content { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "priority")]
    public string Priority { get; set; } = "standard";

    [SugarColumn(ColumnName = "status")]
    public string Status { get; set; } = "active";

    [SugarColumn(ColumnName = "created_at")]
    public long CreatedAt { get; set; }

    [SugarColumn(ColumnName = "updated_at")]
    public long UpdatedAt { get; set; }
}
