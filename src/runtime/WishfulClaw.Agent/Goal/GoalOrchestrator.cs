using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Channels;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent;

/// <summary>
/// GoalOrchestrator — manages the full lifecycle of a Goal execution.
/// Decomposes a goal into plans, spawns sub-agents to execute each plan serially,
/// collects results, and emits progress events.
///
/// Two-layer architecture:
/// - Orchestration layer (this class): LLM-based goal decomposition + plan management
/// - Execution layer (sub-agents): reuse AgentLoop + plan mode tools
///
/// Plans 4-6 will add: self-check evaluation, 429 backoff, interruptible.
/// </summary>
public static partial class GoalOrchestrator
{
    private static readonly ConcurrentDictionary<string, GoalContext> ActiveGoals = new(StringComparer.Ordinal);

    /// <summary>
    /// Start a new Goal execution asynchronously.
    /// Returns immediately; the orchestration loop runs in the background.
    /// </summary>
    public static async Task<string> StartAsync(
        string goalText,
        string sessionId,
        string? workingFolder,
        JsonElement parameters,
        AgentRuntimeRunState parentState,
        IWorkerRequestContext context)
    {
        var goalId = $"goal-{Guid.NewGuid():N}".Substring(0, 21);
        var goal = new GoalContext
        {
            GoalId = goalId,
            SessionId = sessionId,
            GoalText = goalText,
            WorkingFolder = workingFolder,
            Status = "active",
            StartedAt = DateTime.UtcNow
        };

        ActiveGoals[goalId] = goal;

        // Fire and forget the orchestration loop
        _ = Task.Run(async () =>
        {
            try
            {
                await RunAsync(goal, parameters, parentState, context);
            }
            catch (OperationCanceledException)
            {
                goal.Status = "aborted";
                await EmitGoalEventAsync(goal, GoalEventType.GoalAborted, "Goal aborted", context);
            }
            catch (Exception ex)
            {
                goal.Status = "failed";
                await EmitGoalEventAsync(goal, GoalEventType.GoalCompleted, $"Goal failed: {ex.Message}", context);
            }
            finally
            {
                ActiveGoals.TryRemove(goalId, out _);
            }
        }, goal.CancellationTokenSource.Token);

        return goalId;
    }

    /// <summary>
    /// Abort a running Goal.
    /// </summary>
    public static void Abort(string goalId)
    {
        if (ActiveGoals.TryGetValue(goalId, out var goal))
        {
            goal.CancellationTokenSource.Cancel();
            goal.Status = "aborted";
        }
    }

    /// <summary>
    /// Check if a Goal is currently running.
    /// </summary>
    public static bool IsActive(string goalId)
    {
        return ActiveGoals.TryGetValue(goalId, out var goal) && goal.Status == "active";
    }

    /// <summary>
    /// Get the current context for a running Goal.
    /// </summary>
    public static GoalContext? GetContext(string goalId)
    {
        return ActiveGoals.TryGetValue(goalId, out var goal) ? goal : null;
    }

    // ── Event emission ──

    /// <summary>
    /// Emit a goal progress event to the frontend via the agent stream.
    /// </summary>
    private static async Task EmitGoalEventAsync(
        GoalContext goal,
        GoalEventType eventType,
        string message,
        IWorkerRequestContext context)
    {
        try
        {
            var eventPayload = new AgentRuntimeStreamEvent(
                "goal_progress",
                SubAgentName: $"Goal: {goal.GoalText.Substring(0, Math.Min(50, goal.GoalText.Length))}",
                ToolUseId: goal.GoalId,
                Input: JsonSerializer.SerializeToElement(new
                {
                    goalId = goal.GoalId,
                    sessionId = goal.SessionId,
                    eventType = eventType.ToString(),
                    message = message,
                    status = goal.Status,
                    currentPlanIndex = goal.CurrentPlanIndex,
                    planCount = goal.Plans.Count,
                    completedPlans = goal.Plans.Count(p => p.Status == "completed"),
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                }));

            await AgentRuntimeTools.EmitAsync(
                new AgentRuntimeRunState($"goal-{goal.GoalId}", goal.SessionId),
                context,
                eventPayload);
        }
        catch
        {
            // Event emission failures should not crash the orchestration loop
        }
    }
}
