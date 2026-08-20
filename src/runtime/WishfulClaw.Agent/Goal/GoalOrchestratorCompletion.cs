using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent;

public static partial class GoalOrchestrator
{
    private sealed record GoalRunOutcome(
        string Status,
        GoalEventType EventType,
        string Message);

    private static async Task FinalizeOwnedRunAsync(
        GoalContext goal,
        long generation,
        GoalRunOutcome outcome,
        JsonElement parameters,
        AgentRuntimeRunState runtimeState,
        IWorkerRequestContext context)
    {
        GoalEventType eventType;
        string message;
        lock (goal.LifecycleSync)
        {
            if (goal.RunGeneration != generation)
            {
                runtimeState.Dispose();
                return;
            }

            if (!GoalStatusValues.IsTerminal(goal.Status))
                goal.Status = outcome.Status;

            goal.RunState = GoalRunStateValues.Idle;
            (eventType, message) = ResolveTerminalEvent(goal.Status, outcome);
        }

        PersistTerminalState(goal, parameters, message);
        await EmitGoalEventAsync(goal, eventType, message, context);

        lock (goal.LifecycleSync)
        {
            if (goal.RunGeneration == generation)
            {
                goal.RunTask = null;
                goal.RuntimeState = null;
                goal.RunState = GoalRunStateValues.Idle;
                if (IsCurrentGoalContext(goal))
                    ActiveGoals.TryRemove(goal.GoalId, out _);
            }
        }

        runtimeState.Dispose();
    }

    private static void FinalizeIdleTerminal(
        GoalContext goal,
        string status,
        string message)
    {
        goal.Status = status;
        goal.RunState = GoalRunStateValues.Idle;
        PersistTerminalState(goal, BuildResumeParameters(goal), message);
        if (IsCurrentGoalContext(goal))
            ActiveGoals.TryRemove(goal.GoalId, out _);
    }

    private static void PersistTerminalState(
        GoalContext goal,
        JsonElement parameters,
        string eventMessage)
    {
        try
        {
            WriteGoalState(goal);
        }
        catch (Exception ex)
        {
            WorkerLog.Warn($"Failed to write terminal goal state: {ex.Message}");
        }

        SyncGoalToDb(goal, parameters, eventMessage);
    }

    private static (GoalEventType EventType, string Message) ResolveTerminalEvent(
        string status,
        GoalRunOutcome outcome)
    {
        if (string.Equals(status, outcome.Status, StringComparison.Ordinal))
            return (outcome.EventType, outcome.Message);

        return status switch
        {
            GoalStatusValues.Complete => (GoalEventType.GoalCompleted, "All plans completed successfully"),
            GoalStatusValues.Failed => (GoalEventType.GoalFailed, "Goal failed"),
            GoalStatusValues.Aborted => (GoalEventType.GoalAborted, "Goal aborted"),
            _ => (outcome.EventType, outcome.Message)
        };
    }
}
