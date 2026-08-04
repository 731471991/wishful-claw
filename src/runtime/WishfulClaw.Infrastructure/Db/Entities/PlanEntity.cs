using SqlSugar;

namespace WishfulClaw.Infrastructure.Db;

// ─── Plan Entity ───

[SugarTable("plans")]
public class PlanEntity
{
    [SugarColumn(IsPrimaryKey = true, ColumnName = "id")]
    public string Id { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "session_id")]
    public string SessionId { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "title")]
    public string Title { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "status")]
    public string Status { get; set; } = "drafting";

    [SugarColumn(ColumnName = "file_path", IsNullable = true)]
    public string? FilePath { get; set; }

    [SugarColumn(ColumnName = "content", IsNullable = true, ColumnDataType = "TEXT")]
    public string? Content { get; set; }

    [SugarColumn(ColumnName = "spec_json", IsNullable = true, ColumnDataType = "TEXT")]
    public string? SpecJson { get; set; }

    [SugarColumn(ColumnName = "created_at")]
    public long CreatedAt { get; set; }

    [SugarColumn(ColumnName = "updated_at")]
    public long UpdatedAt { get; set; }
}

// ─── Plan DTO ───

public sealed class PlanRow
{
    public string Id { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = "drafting";
    public string? FilePath { get; set; }
    public string? Content { get; set; }
    public string? SpecJson { get; set; }
    public long CreatedAt { get; set; }
    public long UpdatedAt { get; set; }

    public static PlanRow FromEntity(PlanEntity e) => new()
    {
        Id = e.Id,
        SessionId = e.SessionId,
        Title = e.Title,
        Status = e.Status,
        FilePath = e.FilePath,
        Content = e.Content,
        SpecJson = e.SpecJson,
        CreatedAt = e.CreatedAt,
        UpdatedAt = e.UpdatedAt
    };
}

// ─── Plan Result Records ───

public sealed record PlanFindResult(bool Success, PlanRow? Plan, string? Error);
public sealed record PlanMutationResult(bool Success, int Changed, string? Error);
