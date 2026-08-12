using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent;

public static partial class GoalOrchestrator
{
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

        GoalRunOutcome outcome;
        try
        {
            outcome = await RunAsync(goal, parameters, runtimeState, context);
        }
        catch (OperationCanceledException)
        {
            outcome = new GoalRunOutcome(
                GoalStatusValues.Aborted,
                GoalEventType.GoalAborted,
                "Goal aborted");
        }
        catch (Exception ex)
        {
            outcome = new GoalRunOutcome(
                GoalStatusValues.Failed,
                GoalEventType.GoalFailed,
                $"Goal failed: {ex.Message}");
        }

        await FinalizeOwnedRunAsync(
            goal,
            generation,
            outcome,
            parameters,
            runtimeState,
            context);
    }
}
