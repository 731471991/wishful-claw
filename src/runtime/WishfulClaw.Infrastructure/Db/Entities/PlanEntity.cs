
namespace WishfulClaw.Infrastructure.Db;

// ─── Plan Entity ───

public class PlanEntity
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
