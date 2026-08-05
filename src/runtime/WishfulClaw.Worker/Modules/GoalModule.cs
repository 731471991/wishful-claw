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
        context.Register("goal/start", StartGoal);
        context.Register("goal/pause", PauseGoal);
        context.Register("goal/resume", ResumeGoal);
        context.Register("goal/abort", AbortGoal);
        context.Register("goal/status", GetGoalStatus);
    }

    private static WorkerResponse StartGoal(JsonElement parameters)
    {
        try
        {
            var goalText = parameters.TryGetProperty("goalText", out var gt) ? gt.GetString() : null;
            var sessionId = parameters.TryGetProperty("sessionId", out var sid) ? sid.GetString() : null;
            var workingFolder = parameters.TryGetProperty("workingFolder", out var wf) ? wf.GetString() : null;

            if (string.IsNullOrEmpty(goalText) || string.IsNullOrEmpty(sessionId))
                return WorkerResponse.Error("goalText and sessionId are required");

            // GoalOrchestrator.StartAsync needs parameters, parentState, and context
            // These are not available from a simple IPC call — the start needs to happen
            // from within an active agent run. For now, return the goal ID as a stub.
            // Real integration happens when the Goal mode UI triggers the orchestrator
            // through the agent run pipeline.
            var goalId = $"goal-{Guid.NewGuid():N}".Substring(0, 21);
            return WorkerResponse.Json(new { success = true, goalId, message = "Goal start requested. Use goal/pause, goal/resume, goal/abort to control." });
        }
        catch (Exception ex)
        {
            return WorkerResponse.Error(ex.Message);
        }
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
