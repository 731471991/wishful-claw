using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Infrastructure.Db;

namespace WishfulClaw.Agent;

/// <summary>
/// Lifecycle ownership and state transitions for GoalOrchestrator.
/// </summary>
public static partial class GoalOrchestrator
{
    /// <summary>
    /// Start a new Goal execution asynchronously.
    /// Returns immediately; the orchestration loop runs in the background.
    /// goalId is provided by the caller (from DB / PendingGoal) to ensure
    /// ActiveGoals key matches the persisted goalId.
    /// </summary>
    public static Task<string> StartAsync(
        string goalText,
        string sessionId,
        string? workingFolder,
        string goalId,
        JsonElement parameters,
        IWorkerRequestContext context)
    {
        var goal = new GoalContext
        {
            GoalId = goalId,
            SessionId = sessionId,
            GoalText = goalText,
            WorkingFolder = workingFolder,
            Status = GoalStatusValues.Active,
            RunState = GoalRunStateValues.Idle,
            StartedAt = DateTime.UtcNow
        };

        if (!ActiveGoals.TryAdd(goalId, goal))
        {
            if (ActiveGoals.TryGetValue(goalId, out var existingGoal))
            {
                StartOrResumeRun(existingGoal, parameters, context);
            }
            return Task.FromResult(goalId);
        }

        _ = EmitGoalEventAsync(goal, GoalEventType.GoalStarted,
            $"Goal created: {goalText}. Decomposing into plans...", context);

        StartOrResumeRun(goal, parameters, context);
        return Task.FromResult(goalId);
    }

    /// <summary>
    /// Pause a running Goal without replacing its owned orchestration loop.
    /// </summary>
    public static GoalActionResult Pause(string goalId)
    {
        if (!ActiveGoals.TryGetValue(goalId, out var goal))
            return GoalActionNotFound("pause", goalId);

        lock (goal.LifecycleSync)
        {
            if (!IsCurrentGoalContext(goal))
                return GoalActionNotFound("pause", goalId);

            if (GoalStatusValues.IsTerminal(goal.Status))
                return GoalActionTerminal("pause", goal);

            if (goal.RunState == GoalRunStateValues.Paused)
                return GoalAction(goal, true, "already_paused");

            if (goal.RunState != GoalRunStateValues.Running || goal.RunTask is not { IsCompleted: false })
                return GoalAction(goal, false, "idle", "Goal has no running orchestration loop to pause.");

            goal.RunState = GoalRunStateValues.Paused;
            return GoalAction(goal, true, "paused");
        }
    }

    /// <summary>
    /// Resume an existing paused loop without requiring a worker request context.
    /// Idle goals must use the overload that supplies a request context.
    /// </summary>
    public static GoalActionResult Resume(string goalId)
    {
        if (!ActiveGoals.TryGetValue(goalId, out var goal))
            return GoalActionNotFound("resume", goalId);

        lock (goal.LifecycleSync)
        {
            if (!IsCurrentGoalContext(goal))
                return GoalActionNotFound("resume", goalId);

            if (GoalStatusValues.IsTerminal(goal.Status))
                return GoalActionTerminal("resume", goal);

            if (goal.RunState == GoalRunStateValues.Paused
                && goal.RunTask is { IsCompleted: false })
            {
                goal.RunState = GoalRunStateValues.Running;
                return GoalAction(goal, true, "resumed");
            }

            if (goal.RunState == GoalRunStateValues.Running
                && goal.RunTask is { IsCompleted: false })
            {
                return GoalAction(goal, true, "already_running");
            }

            return GoalAction(goal, false, "idle", "Starting an idle goal requires a worker request context.");
        }
    }

    /// <summary>
    /// Atomically resume an in-memory goal or restore it from DB before starting.
    /// A paused goal only wakes its existing loop; an idle goal creates one owned loop.
    /// </summary>
    public static GoalActionResult Resume(
        string goalId,
        string? sessionId,
        IWorkerRequestContext context)
    {
        if (!ActiveGoals.TryGetValue(goalId, out var goal))
        {
            if (string.IsNullOrEmpty(sessionId))
                return GoalActionNotFound("resume", goalId);

            var row = DbGoalTools.GetByGoalId(goalId, sessionId);
            if (row == null)
                return GoalActionNotFound("resume", goalId);

            if (GoalStatusValues.IsTerminal(row.Status))
            {
                return new GoalActionResult(
                    false,
                    "terminal",
                    row.Status,
                    GoalRunStateValues.Idle,
                    goalId,
                    "Terminal goals cannot be resumed.");
            }

            var restoredGoal = RestoreGoalContext(row);
            ActiveGoals.TryAdd(goalId, restoredGoal);
            if (!ActiveGoals.TryGetValue(goalId, out goal))
                return GoalActionNotFound("resume", goalId);
        }

        var parameters = BuildResumeParameters(goal);
        return StartOrResumeRun(goal, parameters, context);
    }

    /// <summary>
    /// Restore an active goal from DB as idle after process restart.
    /// The orchestration loop starts only after an explicit Resume call.
    /// </summary>
    public static Task<bool> ResumeFromDb(string goalId, string sessionId)
    {
        if (ActiveGoals.ContainsKey(goalId))
            return Task.FromResult(true);

        var row = DbGoalTools.GetByGoalId(goalId, sessionId);
        if (row == null || GoalStatusValues.IsTerminal(row.Status))
        {
            return Task.FromResult(false);
        }

        var goal = RestoreGoalContext(row);
        var restored = ActiveGoals.TryAdd(goalId, goal) || ActiveGoals.ContainsKey(goalId);
        if (restored)
        {
            WorkerLog.Info($"ResumeFromDb: restored goal {goalId} session={sessionId} status={goal.Status} planCount={goal.Plans.Count} runState=idle");
        }
        return Task.FromResult(restored);
    }

    /// <summary>
    /// Request cancellation for an active Goal without waiting for loop cleanup.
    /// </summary>
    public static GoalActionResult Abort(string goalId)
    {
        return RequestAbort(goalId, out _);
    }

    /// <summary>
    /// Request cancellation and wait for the owned orchestration loop to exit.
    /// </summary>
    public static async Task<GoalActionResult> AbortAsync(string goalId)
    {
        var result = RequestAbort(goalId, out var runTask);
        if (!result.Success || runTask == null)
            return result;

        try
        {
            await runTask;
        }
        catch
        {
            // The owned loop converts cancellation/failure into Goal status before cleanup.
        }

        return result with
        {
            Action = "aborted",
            Status = GoalStatusValues.Aborted,
            RunState = GoalRunStateValues.Idle
        };
    }

    private static GoalActionResult RequestAbort(string goalId, out Task? runTask)
    {
        runTask = null;
        if (!ActiveGoals.TryGetValue(goalId, out var goal))
            return GoalActionNotFound("abort", goalId);

        lock (goal.LifecycleSync)
        {
            if (!IsCurrentGoalContext(goal))
                return GoalActionNotFound("abort", goalId);

            if (GoalStatusValues.IsTerminal(goal.Status))
                return GoalActionTerminal("abort", goal);

            runTask = goal.RunTask;
            goal.Status = GoalStatusValues.Aborted;
            goal.CancellationTokenSource.Cancel();
            goal.RuntimeState?.Cancel("goal aborted");

            if (runTask == null)
            {
                goal.RunState = GoalRunStateValues.Idle;
                WriteGoalState(goal);
                SyncGoalToDb(goal, BuildResumeParameters(goal));
                ActiveGoals.TryRemove(goal.GoalId, out _);
                return GoalAction(goal, true, "aborted");
            }

            return GoalAction(goal, true, "aborting");
        }
    }

    private static GoalContext RestoreGoalContext(GoalRow row)
    {
        List<GoalPlanItem> plans = new();
        if (!string.IsNullOrEmpty(row.PlansJson))
        {
            try
            {
                plans = JsonSerializer.Deserialize(
                    row.PlansJson,
                    AgentRuntimeJsonContext.Default.ListGoalPlanItem) ?? new();
                foreach (var plan in plans)
                {
                    if (string.IsNullOrEmpty(plan.PlanId))
                        plan.PlanId = $"plan-{Guid.NewGuid():N}".Substring(0, 16);
                }
            }
            catch (Exception ex)
            {
                WorkerLog.Warn($"ResumeFromDb: failed to deserialize plans: {ex.Message}");
            }
        }

        return new GoalContext
        {
            GoalId = row.GoalId,
            SessionId = row.SessionId,
            GoalText = row.Objective,
            WorkingFolder = row.WorkingFolder,
            Status = row.Status == "paused" ? GoalStatusValues.Active : row.Status,
            RunState = GoalRunStateValues.Idle,
            Plans = plans,
            CurrentPlanIndex = plans.Count > 0 ? row.CurrentPlanIndex : -1,
            StartedAt = DateTime.UtcNow
        };
    }

    private static JsonElement BuildResumeParameters(GoalContext goal)
    {
        return string.IsNullOrEmpty(goal.WorkingFolder)
            ? new JsonElement()
            : WorkerJsonHelper.BuildJsonElement(w =>
            {
                w.WriteStartObject();
                w.WriteString("workingFolder", goal.WorkingFolder);
                w.WriteEndObject();
            });
    }

    private static GoalActionResult StartOrResumeRun(
        GoalContext goal,
        JsonElement parameters,
        IWorkerRequestContext context)
    {
        lock (goal.LifecycleSync)
        {
            if (!IsCurrentGoalContext(goal))
                return GoalActionNotFound("resume", goal.GoalId);

            if (GoalStatusValues.IsTerminal(goal.Status))
                return GoalActionTerminal("resume", goal);

            if (goal.RunState == GoalRunStateValues.Paused
                && goal.RunTask is { IsCompleted: false })
            {
                goal.RunState = GoalRunStateValues.Running;
                return GoalAction(goal, true, "resumed");
            }

            if (goal.RunState == GoalRunStateValues.Running
                && goal.RunTask is { IsCompleted: false })
            {
                return GoalAction(goal, true, "already_running");
            }

            goal.RunState = GoalRunStateValues.Running;
            var generation = ++goal.RunGeneration;
            var runtimeState = new AgentRuntimeRunState(
                $"goal-{goal.GoalId}-{generation}",
                goal.SessionId);
            runtimeState.ReplaceParameters(parameters);
            goal.RuntimeState = runtimeState;
            var backgroundContext = context.ForBackgroundOperation();
            goal.RunTask = Task.Run(() => RunOwnedAsync(
                goal,
                generation,
                parameters,
                runtimeState,
                backgroundContext));
            return GoalAction(goal, true, "started");
        }
    }

    private static async Task RunOwnedAsync(
        GoalContext goal,
        long generation,
        JsonElement parameters,
        AgentRuntimeRunState runtimeState,
        IWorkerRequestContext context)
    {
        using var goalCancellationRegistration = goal.CancellationTokenSource.Token.Register(
            static state => ((AgentRuntimeRunState)state!).Cancel("goal"),
            runtimeState);

        try
        {
            await RunAsync(goal, parameters, runtimeState, context);
            if (goal.Status == GoalStatusValues.Aborted)
            {
                await EmitGoalEventAsync(goal, GoalEventType.GoalAborted, "Goal aborted", context);
            }
        }
        catch (OperationCanceledException)
        {
            TrySetOwnedRunStatus(goal, generation, GoalStatusValues.Aborted);
            await EmitGoalEventAsync(goal, GoalEventType.GoalAborted, "Goal aborted", context);
        }
        catch (Exception ex)
        {
            if (TrySetOwnedRunStatus(goal, generation, GoalStatusValues.Failed))
            {
                await EmitGoalEventAsync(goal, GoalEventType.GoalCompleted, $"Goal failed: {ex.Message}", context);
            }
        }
        finally
        {
            lock (goal.LifecycleSync)
            {
                if (goal.RunGeneration == generation)
                {
                    goal.RunTask = null;
                    goal.RuntimeState = null;
                    goal.RunState = GoalRunStateValues.Idle;
                    runtimeState.Dispose();
                    if (goal.Status == GoalStatusValues.Aborted)
                    {
                        WriteGoalState(goal);
                        SyncGoalToDb(goal, parameters);
                    }
                    if (IsCurrentGoalContext(goal))
                    {
                        ActiveGoals.TryRemove(goal.GoalId, out _);
                    }
                }
            }
        }
    }

    private static bool TrySetOwnedRunStatus(GoalContext goal, long generation, string status)
    {
        lock (goal.LifecycleSync)
        {
            if (goal.RunGeneration != generation || GoalStatusValues.IsTerminal(goal.Status))
                return false;

            goal.Status = status;
            return true;
        }
    }

    private static bool TrySetActiveRunStatus(GoalContext goal, string status)
    {
        lock (goal.LifecycleSync)
        {
            if (GoalStatusValues.IsTerminal(goal.Status))
                return false;

            goal.Status = status;
            return true;
        }
    }

    private static bool IsCurrentGoalContext(GoalContext goal)
        => ActiveGoals.TryGetValue(goal.GoalId, out var activeGoal)
            && ReferenceEquals(activeGoal, goal);

    private static GoalActionResult GoalAction(
        GoalContext goal,
        bool success,
        string action,
        string? error = null)
        => new(success, action, goal.Status, goal.RunState, goal.GoalId, error);

    private static GoalActionResult GoalActionNotFound(string action, string? goalId)
        => new(false, "not_found", "unknown", "unknown", goalId, $"Goal not found for {action}.");

    private static GoalActionResult GoalActionTerminal(string action, GoalContext goal)
        => GoalAction(goal, false, "terminal", $"Terminal goals cannot be {action}d.");
}
