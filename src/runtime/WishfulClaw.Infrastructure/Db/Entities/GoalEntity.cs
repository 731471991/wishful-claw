
using WishfulClaw.Contracts;

namespace WishfulClaw.Infrastructure.Db;

// ─── Goal Entity ───

public class GoalEntity
{
    public string GoalId { get; set; } = string.Empty;

    public string SessionId { get; set; } = string.Empty;

    public string? ProjectId { get; set; }

    public string Objective { get; set; } = string.Empty;

    /// <summary>
    /// pending | active | complete | failed | aborted
    /// </summary>
    public string Status { get; set; } = GoalStatusValues.Active;

    public long? TokenBudget { get; set; }

    public long TokensUsed { get; set; }

    public long TimeUsedSeconds { get; set; }

    /// <summary>
    /// JSON array of plan items: [{ planId, title, description, status, retryCount, resultSummary }]
    /// Used by GoalOrchestrator for plan management.
    /// </summary>
    public string? PlansJson { get; set; }

    public int PlanCount { get; set; }

    public int CompletedPlanCount { get; set; }

    public int CurrentPlanIndex { get; set; } = -1;

    public string? WorkingFolder { get; set; }

    public long CreatedAt { get; set; }

    public long UpdatedAt { get; set; }
}

// ─── Goal Event Entity ───

public class GoalEventEntity
{
    public long Id { get; set; }

    public string SessionId { get; set; } = string.Empty;

    public string? GoalId { get; set; }

    /// <summary>
    /// created | confirmed | objective_updated | budget_updated | status_changed | usage_accounted |
    /// usage_limited | budget_limited | completion_deferred | blocked | completed | failed | aborted |
    /// stall_paused | auto_continue_blocked
    /// </summary>
    public string EventType { get; set; } = "created";

    public string? Message { get; set; }

    public string? MetadataJson { get; set; }

    public long CreatedAt { get; set; }
}

// ─── Goal DTO (matches frontend SessionGoalRow) ───

public sealed class GoalRow
{
    public string GoalId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string? ProjectId { get; set; }
    public string Objective { get; set; } = string.Empty;
    public string Status { get; set; } = GoalStatusValues.Active;
    public long? TokenBudget { get; set; }
    public long TokensUsed { get; set; }
    public long TimeUsedSeconds { get; set; }
    public string? PlansJson { get; set; }
    public int PlanCount { get; set; }
    public int CompletedPlanCount { get; set; }
    public int CurrentPlanIndex { get; set; } = -1;
    public string? WorkingFolder { get; set; }
    public long CreatedAt { get; set; }
    public long UpdatedAt { get; set; }

    public static GoalRow FromEntity(GoalEntity e) => new()
    {
    GoalId = e.GoalId,
    SessionId = e.SessionId,
    ProjectId = e.ProjectId,
    Objective = e.Objective,
    Status = e.Status,
    TokenBudget = e.TokenBudget,
    TokensUsed = e.TokensUsed,
    TimeUsedSeconds = e.TimeUsedSeconds,
    PlansJson = e.PlansJson,
    PlanCount = e.PlanCount,
    CompletedPlanCount = e.CompletedPlanCount,
    CurrentPlanIndex = e.CurrentPlanIndex,
    WorkingFolder = e.WorkingFolder,
    CreatedAt = e.CreatedAt,
    UpdatedAt = e.UpdatedAt
    };
}

// ─── Goal Event DTO (matches frontend SessionGoalEventRow) ───

public sealed class GoalEventRow
{
    public long Id { get; set; }
    public string SessionId { get; set; } = string.Empty;
    public string? GoalId { get; set; }
    public string EventType { get; set; } = "created";
    public string? Message { get; set; }
    public string? MetadataJson { get; set; }
    public long CreatedAt { get; set; }

    public static GoalEventRow FromEntity(GoalEventEntity e) => new()
    {
    Id = e.Id,
    SessionId = e.SessionId,
    GoalId = e.GoalId,
    EventType = e.EventType,
    Message = e.Message,
    MetadataJson = e.MetadataJson,
    CreatedAt = e.CreatedAt
    };
}

// ─── Result Records ───

public sealed record GoalFindResult(bool Success, GoalRow? Goal, string? Error);
public sealed record GoalMutationResult(bool Success, int Changed, string? Error);
public sealed record GoalEventFindResult(bool Success, List<GoalEventRow> Events, string? Error);
public sealed record GoalEventMutationResult(bool Success, GoalEventRow? Event, string? Error);
public sealed record GoalPageResult(
    List<GoalRow> Items,
    bool HasMore,
    int? NextCurrentRank = null,
    long? NextUpdatedAt = null,
    string? NextGoalId = null);
public sealed record GoalEventPageResult(
    List<GoalEventRow> Items,
    bool HasMore,
    long? NextCreatedAt = null,
    long? NextEventId = null);
public sealed record GoalReopenResult(
    bool Success,
    GoalRow? Goal = null,
    string? SourceGoalId = null,
    string? Error = null);
