using SqlSugar;

namespace WishfulClaw.Infrastructure.Db;

// ─── Goal Entity ───

[SugarTable("goals")]
public class GoalEntity
{
    [SugarColumn(IsPrimaryKey = true, ColumnName = "goal_id")]
    public string GoalId { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "session_id")]
    public string SessionId { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "objective", ColumnDataType = "TEXT")]
    public string Objective { get; set; } = string.Empty;

    /// <summary>
    /// active | paused | blocked | usage_limited | budget_limited | complete
    /// </summary>
    [SugarColumn(ColumnName = "status")]
    public string Status { get; set; } = "active";

    [SugarColumn(ColumnName = "token_budget", IsNullable = true)]
    public long? TokenBudget { get; set; }

    [SugarColumn(ColumnName = "tokens_used")]
    public long TokensUsed { get; set; }

    [SugarColumn(ColumnName = "time_used_seconds")]
    public long TimeUsedSeconds { get; set; }

    /// <summary>
    /// JSON array of plan items: [{ planId, title, description, status, retryCount, resultSummary }]
    /// Used by GoalOrchestrator for plan management.
    /// </summary>
    [SugarColumn(ColumnName = "plans_json", IsNullable = true, ColumnDataType = "TEXT")]
    public string? PlansJson { get; set; }

    [SugarColumn(ColumnName = "plan_count")]
    public int PlanCount { get; set; }

    [SugarColumn(ColumnName = "completed_plan_count")]
    public int CompletedPlanCount { get; set; }

    [SugarColumn(ColumnName = "current_plan_index")]
    public int CurrentPlanIndex { get; set; } = -1;

    [SugarColumn(ColumnName = "working_folder", IsNullable = true)]
    public string? WorkingFolder { get; set; }

    [SugarColumn(ColumnName = "created_at")]
    public long CreatedAt { get; set; }

    [SugarColumn(ColumnName = "updated_at")]
    public long UpdatedAt { get; set; }
}

// ─── Goal Event Entity ───

[SugarTable("goal_events")]
public class GoalEventEntity
{
    [SugarColumn(IsPrimaryKey = true, ColumnName = "id", IsIdentity = true)]
    public long Id { get; set; }

    [SugarColumn(ColumnName = "session_id")]
    public string SessionId { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "goal_id", IsNullable = true)]
    public string? GoalId { get; set; }

    /// <summary>
    /// created | replaced | objective_updated | budget_updated | status_changed | usage_accounted |
    /// usage_limited | budget_limited | completion_deferred | blocked | completed | stall_paused |
    /// auto_continue_blocked | cleared
    /// </summary>
    [SugarColumn(ColumnName = "event_type")]
    public string EventType { get; set; } = "created";

    [SugarColumn(ColumnName = "message", IsNullable = true, ColumnDataType = "TEXT")]
    public string? Message { get; set; }

    [SugarColumn(ColumnName = "metadata_json", IsNullable = true, ColumnDataType = "TEXT")]
    public string? MetadataJson { get; set; }

    [SugarColumn(ColumnName = "created_at")]
    public long CreatedAt { get; set; }
}

// ─── Goal DTO (matches frontend SessionGoalRow) ───

public sealed class GoalRow
{
    public string GoalId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string Objective { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
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
