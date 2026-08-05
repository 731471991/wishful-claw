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
