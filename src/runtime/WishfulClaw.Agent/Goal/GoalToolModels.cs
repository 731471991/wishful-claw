using WishfulClaw.Contracts;

namespace WishfulClaw.Agent;

public sealed record GoalToolGoal(
    string SessionId,
    string GoalId,
    string Objective,
    string Status,
    long UpdatedAt,
    long? TokenBudget = null,
    long TokensUsed = 0,
    long TimeUsedSeconds = 0);

public sealed record GoalToolProgress(
    int PlanCount,
    int CurrentPlanIndex,
    int CompletedPlans,
    int FailedPlans,
    string Status,
    string RunState,
    string? StartedAt = null);

public sealed record GoalToolResult(
    GoalToolGoal? Goal = null,
    GoalToolProgress? Progress = null,
    GoalActionResult? Action = null,
    string? Error = null);

public sealed record GoalToolEvent(
    long Id,
    string EventType,
    string? Message,
    string? MetadataJson,
    long CreatedAt);

public sealed record GoalToolPageResult(
    List<GoalToolGoal> Goals,
    bool HasMore,
    int? NextCurrentRank = null,
    long? NextUpdatedAt = null,
    string? NextGoalId = null,
    string? Error = null);

public sealed record GoalToolHistoryResult(
    GoalToolGoal? Goal,
    List<GoalToolEvent> Events,
    bool HasMore,
    long? NextCreatedAt = null,
    long? NextEventId = null,
    string? Error = null);
