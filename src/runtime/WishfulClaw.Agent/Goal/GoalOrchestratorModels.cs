using System.Text.Json;
using WishfulClaw.Contracts;

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
    public string Status { get; set; } = GoalPlanStatusValues.Pending; // pending | executing | completed | failed
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
    /// <summary>目标状态：active（进行中）| complete | failed | aborted（终态）。</summary>
    public string Status { get; set; } = GoalStatusValues.Active;
    private string _runState = GoalRunStateValues.Idle;
    /// <summary>执行状态（仅内存）：idle（未运行）| running（编排中）| paused（暂停）。</summary>
    public string RunState
    {
        get => Volatile.Read(ref _runState);
        set => Volatile.Write(ref _runState, value);
    }
    public List<GoalPlanItem> Plans { get; set; } = new();
    public int CurrentPlanIndex { get; set; } = -1;
    public CancellationTokenSource CancellationTokenSource { get; set; } = new();
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    internal object LifecycleSync { get; } = new();
    internal Task? RunTask { get; set; }
    internal AgentRuntimeRunState? RuntimeState { get; set; }
    internal long RunGeneration { get; set; }
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
