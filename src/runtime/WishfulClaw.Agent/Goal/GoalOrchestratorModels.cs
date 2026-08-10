using System.Text.Json;

namespace WishfulClaw.Agent;

/// <summary>
/// Data models for GoalOrchestrator.
/// </summary>

/// <summary>
/// Execution result of a single plan by a sub-agent.
/// </summary>
public sealed class PlanExecutionResult
{
    public string PlanId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = "pending"; // pending | executing | completed | failed
    public string? Summary { get; set; }
    public string? Error { get; set; }
    public bool Is429 { get; set; }
    public string? RetryAfterHint { get; set; }
    public int RetryCount { get; set; }
    public long ElapsedMs { get; set; }

    public static PlanExecutionResult FromPlanItem(GoalPlanItem plan) => new()
    {
        PlanId = plan.PlanId,
        Title = plan.Title,
        Status = plan.Status,
        RetryCount = plan.RetryCount,
        Summary = plan.ResultSummary
    };
}

/// <summary>
/// Result of LLM goal decomposition.
/// </summary>
public sealed class GoalDecompositionResult
{
    public bool Success { get; set; }
    public List<GoalPlanItem> Plans { get; set; } = new();
    public string? Error { get; set; }
}

/// <summary>
/// Goal orchestration context — holds all state for one Goal execution.
/// </summary>
public sealed class GoalContext
{
    public string GoalId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string GoalText { get; set; } = string.Empty;
    public string? WorkingFolder { get; set; }
    public string Status { get; set; } = "active"; // active | paused | completed | aborted
    public List<GoalPlanItem> Plans { get; set; } = new();
    public int CurrentPlanIndex { get; set; } = -1;
    public CancellationTokenSource CancellationTokenSource { get; set; } = new();
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    /// <summary>
    /// 编排循环是否已启动。启动恢复时若 context 不可用则不启动循环，
    /// 待前端 Resume 后补启动。
    /// </summary>
    public bool LoopStarted { get; set; }
}

/// <summary>
/// Event types for goal progress tracking.
/// </summary>
public enum GoalEventType
{
    GoalStarted,
    PlanStarted,
    PlanCompleted,
    PlanFailed,
    PlanRetried,
    PlanAdjusted,
    BackoffStarted,
    BackoffProgress,
    BackoffResolved,
    GoalPaused,
    GoalResumed,
    GoalAborted,
    GoalCompleted,
    GoalEvaluationPassed,
    GoalEvaluationFailed
}
