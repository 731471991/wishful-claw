using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using WishfulClaw.Agent;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Infrastructure.Db;

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

    /// <summary>
    /// 服务启动时自动恢复 DB 中 active/paused 的 goals。
    /// </summary>
    public async Task InitializeAsync()
    {
        try
        {
            var activeGoals = DbGoalTools.ListActiveGoals();
            if (activeGoals.Count == 0) return;

            WorkerLog.Info($"[GoalModule] Restoring {activeGoals.Count} active/paused goals from DB...");
            foreach (var row in activeGoals)
            {
                if (string.IsNullOrEmpty(row.SessionId) || string.IsNullOrEmpty(row.GoalId))
                    continue;

                await GoalOrchestrator.ResumeFromDb(row.GoalId, row.SessionId);
                WorkerLog.Info($"[GoalModule] Restored goal {row.GoalId} session={row.SessionId} status={row.Status}");
            }
        }
        catch (Exception ex)
        {
            WorkerLog.Warn($"[GoalModule] InitializeAsync failed: {ex.Message}");
        }
    }
    private static WorkerResponse PauseGoal(JsonElement parameters)
    {
        var goalId = parameters.TryGetProperty("goalId", out var id) ? id.GetString() : null;
        var result = string.IsNullOrEmpty(goalId)
            ? MissingGoalId("pause")
            : GoalOrchestrator.Pause(goalId);
        return WorkerResponse.Json(result, WishfulClawJsonContext.Default.GoalActionResult);
    }

    private static Task<WorkerResponse> ResumeGoal(JsonElement parameters, IWorkerRequestContext context)
    {
        var goalId = parameters.TryGetProperty("goalId", out var id) ? id.GetString() : null;
        var sessionId = parameters.TryGetProperty("sessionId", out var sid) ? sid.GetString() : null;
        var result = string.IsNullOrEmpty(goalId)
            ? MissingGoalId("resume")
            : GoalOrchestrator.Resume(goalId, sessionId, context);
        return Task.FromResult(WorkerResponse.Json(
            result,
            WishfulClawJsonContext.Default.GoalActionResult));
    }

    private static WorkerResponse AbortGoal(JsonElement parameters)
    {
        var goalId = parameters.TryGetProperty("goalId", out var id) ? id.GetString() : null;
        var result = string.IsNullOrEmpty(goalId)
            ? MissingGoalId("abort")
            : GoalOrchestrator.Abort(goalId);
        return WorkerResponse.Json(result, WishfulClawJsonContext.Default.GoalActionResult);
    }

    private static async Task<WorkerResponse> ConfirmGoal(JsonElement parameters, IWorkerRequestContext context)
    {
        var goalId = parameters.TryGetProperty("goalId", out var id) ? id.GetString() : null;
        var sessionId = parameters.TryGetProperty("sessionId", out var sid) ? sid.GetString() : null;

        if (string.IsNullOrEmpty(goalId) || string.IsNullOrEmpty(sessionId))
            return WorkerResponse.Json(new SimpleSuccessResult(false, Error: "goalId and sessionId are required"), WishfulClawJsonContext.Default.SimpleSuccessResult);

        var pending = GoalOrchestrator.GetPendingGoal(goalId);
        if (pending == null)
            return WorkerResponse.Json(new SimpleSuccessResult(false, Error: "No pending goal found with this goalId"), WishfulClawJsonContext.Default.SimpleSuccessResult);

        var parentState = new AgentRuntimeRunState($"goal-{goalId}", sessionId);
        var workingFolder = JsonHelpers.GetString(pending.Parameters, "workingFolder");

        var ok = await GoalOrchestrator.ConfirmGoalAsync(
            goalId, sessionId, workingFolder, pending.Parameters, parentState, context);

        return WorkerResponse.Json(new SimpleSuccessResult(ok), WishfulClawJsonContext.Default.SimpleSuccessResult);
    }

    private static WorkerResponse GetGoalStatus(JsonElement parameters)
    {
        var goalId = parameters.TryGetProperty("goalId", out var id) ? id.GetString() : null;
        if (string.IsNullOrEmpty(goalId))
            return WorkerResponse.Json(new GoalStatusResponse(false), WishfulClawJsonContext.Default.GoalStatusResponse);

        var ctx = GoalOrchestrator.GetContext(goalId);
        return WorkerResponse.Json(new GoalStatusResponse(
            ctx?.Status == GoalStatusValues.Active,
            ctx?.Status ?? "unknown",
            ctx?.RunState ?? "unknown",
            goalId,
            ctx?.CurrentPlanIndex ?? -1,
            ctx?.Plans.Count ?? 0,
            ctx?.Plans.Count(p => p.Status == GoalPlanStatusValues.Completed) ?? 0), WishfulClawJsonContext.Default.GoalStatusResponse);
    }

    private static GoalActionResult MissingGoalId(string action)
        => new(false, "not_found", "unknown", "unknown", Error: $"goalId is required for {action}.");
}
