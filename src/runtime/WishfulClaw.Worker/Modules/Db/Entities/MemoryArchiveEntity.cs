using SqlSugar;

namespace WishfulClaw.Worker.Modules.Db;

// ─── Memory Archive Entity (Cold Tier) ───

[SugarTable("memory_archive")]
public class MemoryArchiveEntity
{
    [SugarColumn(IsPrimaryKey = true, ColumnName = "id")]
    public string Id { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "scope")]
    public string Scope { get; set; } = "global";

    [SugarColumn(ColumnName = "key")]
    public string Key { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "title", IsNullable = true)]
    public string? Title { get; set; }

    [SugarColumn(ColumnName = "content")]
    public string Content { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "priority")]
    public string Priority { get; set; } = "standard";

    [SugarColumn(ColumnName = "created_at")]
    public long CreatedAt { get; set; }

    [SugarColumn(ColumnName = "archived_at")]
    public long ArchivedAt { get; set; }
}
