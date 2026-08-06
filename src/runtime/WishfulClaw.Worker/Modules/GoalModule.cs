using System.Text.Json;
using WishfulClaw.Agent;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.Modules;

public sealed class GoalModule : IWorkerModule
{
    public string Name => "goal";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("goal/pause", PauseGoal);
        context.Register("goal/resume", ResumeGoal);
        context.Register("goal/abort", AbortGoal);
        context.Register("goal/status", GetGoalStatus);
        context.Register("goal/confirm", ConfirmGoal);
    }
    private static WorkerResponse PauseGoal(JsonElement parameters)
    {
        var goalId = parameters.TryGetProperty("goalId", out var id) ? id.GetString() : null;
        if (!string.IsNullOrEmpty(goalId))
            GoalOrchestrator.Pause(goalId);
        return WorkerResponse.Json(new { success = true });
    }

    private static WorkerResponse ResumeGoal(JsonElement parameters)
    {
        var goalId = parameters.TryGetProperty("goalId", out var id) ? id.GetString() : null;
        if (!string.IsNullOrEmpty(goalId))
            GoalOrchestrator.Resume(goalId);
        return WorkerResponse.Json(new { success = true });
    }

    private static WorkerResponse AbortGoal(JsonElement parameters)
    {
        var goalId = parameters.TryGetProperty("goalId", out var id) ? id.GetString() : null;
        if (!string.IsNullOrEmpty(goalId))
            GoalOrchestrator.Abort(goalId);
        return WorkerResponse.Json(new { success = true });
    }

    private static async Task<WorkerResponse> ConfirmGoal(JsonElement parameters, IWorkerRequestContext context)
    {
        var goalId = parameters.TryGetProperty("goalId", out var id) ? id.GetString() : null;
        var sessionId = parameters.TryGetProperty("sessionId", out var sid) ? sid.GetString() : null;

        if (string.IsNullOrEmpty(goalId) || string.IsNullOrEmpty(sessionId))
            return WorkerResponse.Json(new { success = false, error = "goalId and sessionId are required" });

        var pending = GoalOrchestrator.GetPendingGoal(goalId);
        if (pending == null)
            return WorkerResponse.Json(new { success = false, error = "No pending goal found with this goalId" });

        var parentState = new AgentRuntimeRunState($"goal-{goalId}", sessionId);
        var workingFolder = JsonHelpers.GetString(pending.Parameters, "workingFolder");

        var ok = await GoalOrchestrator.ConfirmGoalAsync(
            goalId, sessionId, workingFolder, pending.Parameters, parentState, context);

        return WorkerResponse.Json(new { success = ok });
    }

    private static WorkerResponse GetGoalStatus(JsonElement parameters)
    {
        var goalId = parameters.TryGetProperty("goalId", out var id) ? id.GetString() : null;
        if (string.IsNullOrEmpty(goalId))
            return WorkerResponse.Json(new { active = false });

        var ctx = GoalOrchestrator.GetContext(goalId);
        return WorkerResponse.Json(new
        {
            active = ctx?.Status == "active",
            status = ctx?.Status ?? "unknown",
            goalId = goalId,
            currentPlanIndex = ctx?.CurrentPlanIndex ?? -1,
            planCount = ctx?.Plans.Count ?? 0,
            completedPlans = ctx?.Plans.Count(p => p.Status == "completed") ?? 0
        });
    }
}
