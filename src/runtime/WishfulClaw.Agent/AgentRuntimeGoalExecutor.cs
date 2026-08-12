using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Infrastructure.Db;

namespace WishfulClaw.Agent;

/// <summary>
/// Goal tool executor — get/create/update goals.
/// CreateGoal triggers GoalOrchestrator.StartAsync to start the orchestration loop.
/// </summary>
public static class AgentRuntimeGoalExecutor
{
    public static bool IsGoalTool(string toolName) =>
        toolName is "get_goal" or "create_goal" or "update_goal" or "pause_goal" or "resume_goal" or "abort_goal";

    public static async Task<string> ExecuteAsync(
        AgentRuntimeNativeToolCall call,
        AgentRuntimeRunState state,
        IWorkerRequestContext context)
    {
        var sessionId = JsonHelpers.GetString(state.Parameters, "sessionId")?.Trim() ?? string.Empty;
        if (sessionId.Length == 0)
            return EncodeError("No active session.");

        DbClient.EnsureInitialized(state.Parameters);
        return call.Name switch
        {
            "get_goal" => await GetGoalAsync(sessionId, context),
            "create_goal" => await CreateGoalAsync(
                call.Input,
                sessionId,
                state.Parameters,
                context),
            "update_goal" => await UpdateGoalAsync(
                call.Input,
                sessionId,
                state.Parameters,
                context),
            "pause_goal" => PauseGoal(sessionId),
            "resume_goal" => ResumeGoal(sessionId, context),
            "abort_goal" => await AbortGoalAsync(sessionId, context),
            _ => EncodeError($"Unsupported goal tool: {call.Name}")
        };
    }

    private static async Task<string> GetGoalAsync(
        string sessionId,
        IWorkerRequestContext context)
    {
        var pendingGoalId = GoalOrchestrator.GetPendingGoalId(sessionId);
        if (pendingGoalId != null)
        {
            var pending = GoalOrchestrator.GetPendingGoal(pendingGoalId);
            if (pending != null)
            {
                await GoalOrchestrator.EmitPendingGoalAsync(
                    pending.GoalId,
                    sessionId,
                    pending.GoalText,
                    context);
                return EncodeResult(new GoalToolResult(
                    PendingGoal(pending),
                    PendingProgress()));
            }
        }

        return EncodePersistedGoal(DbGoalTools.GetBySessionId(sessionId));
    }

    private static async Task<string> CreateGoalAsync(
        JsonElement input,
        string sessionId,
        JsonElement parameters,
        IWorkerRequestContext context)
    {
        var objective = JsonHelpers.GetString(input, "objective")?.Trim() ?? string.Empty;
        if (objective.Length == 0)
            return EncodeError("create_goal requires a non-empty objective.");

        var pendingGoalId = GoalOrchestrator.GetPendingGoalId(sessionId);
        if (pendingGoalId != null)
        {
            var pending = GoalOrchestrator.GetPendingGoal(pendingGoalId);
            if (pending != null)
            {
                await GoalOrchestrator.EmitPendingGoalAsync(
                    pending.GoalId,
                    sessionId,
                    pending.GoalText,
                    context);
                return EncodeResult(new GoalToolResult(
                    PendingGoal(pending),
                    PendingProgress()));
            }
        }

        var persisted = DbGoalTools.GetBySessionId(sessionId);
        if (persisted != null && !GoalStatusValues.IsTerminal(persisted.Status))
            return EncodePersistedGoal(persisted);

        var workingFolder = JsonHelpers.GetString(parameters, "workingFolder");
        var goalId = GoalOrchestrator.CreatePendingGoal(
            objective,
            sessionId,
            workingFolder,
            parameters);
        return await AwaitGoalConfirmationAsync(
            goalId,
            sessionId,
            objective,
            context,
            parameters);
    }

    private static async Task<string> AwaitGoalConfirmationAsync(
        string goalId,
        string sessionId,
        string goalText,
        IWorkerRequestContext context,
        JsonElement parameters)
    {
        // Notify the frontend of the pending goal via reverse request (blocking)
        // The agent waits until the user confirms or discards the goal.
        var confirmParams = WorkerJsonHelper.BuildJsonElement(w =>
        {
            w.WriteStartObject();
            w.WriteString("goalId", goalId);
            w.WriteString("sessionId", sessionId);
            w.WriteString("objective", goalText);
            w.WriteString("status", "pending");
            w.WriteEndObject();
        });

        try
        {
            var response = await AgentRuntimeReverseRequests.RequestAsync(
                context, "goal/confirm-request", confirmParams, CancellationToken.None);

            var confirmed = response.TryGetProperty("confirmed", out var c) && c.GetBoolean();
            if (confirmed)
            {
                var pending = GoalOrchestrator.GetPendingGoal(goalId);
                if (pending == null)
                    return EncodeError("Pending goal no longer exists.");

                var dbParams = BuildCreateParameters(
                    sessionId,
                    goalId,
                    pending.GoalText,
                    pending.WorkingFolder);
                var row = DbGoalTools.CreateCurrentGoal(dbParams);
                var started = await GoalOrchestrator.ConfirmGoalAsync(
                    goalId,
                    sessionId,
                    pending.WorkingFolder,
                    pending.Parameters,
                    context);
                if (!started)
                    return EncodeError("Goal confirmation could not start the orchestrator.");

                return EncodePersistedGoal(row);
            }

            GoalOrchestrator.RemovePendingGoal(goalId);
            return EncodeError("Goal was discarded by user.");
        }
        catch (OperationCanceledException)
        {
            // Request cancelled (e.g. agent loop stopped)
            return EncodeError("Goal confirmation was cancelled.");
        }
    }

    private static async Task<string> UpdateGoalAsync(
        JsonElement input,
        string sessionId,
        JsonElement parameters,
        IWorkerRequestContext context)
    {
        var row = DbGoalTools.GetBySessionId(sessionId);
        if (row == null)
            return EncodeError("No goal to update. Call create_goal first.");

        var status = JsonHelpers.GetString(input, "status")?.Trim();
        var objective = JsonHelpers.GetString(input, "objective")?.Trim();
        if (string.IsNullOrEmpty(status) && string.IsNullOrEmpty(objective))
            return EncodeError("update_goal requires objective or status.");

        if (!string.IsNullOrEmpty(status)
            && status is not GoalStatusValues.Active
                and not GoalStatusValues.Complete
                and not GoalStatusValues.Failed
                and not GoalStatusValues.Aborted)
        {
            return EncodeError($"Unsupported goal status: {status}");
        }

        if (GoalStatusValues.IsTerminal(row.Status)
            && !string.IsNullOrEmpty(status))
        {
            return EncodeError("Terminal goal status cannot be updated.");
        }

        var activeContext = GoalOrchestrator.GetContext(row.GoalId);
        if (!string.IsNullOrEmpty(objective)
            && status is GoalStatusValues.Complete or GoalStatusValues.Failed or GoalStatusValues.Aborted)
        {
            var objectiveParams = BuildUpdateParameters(
                parameters,
                sessionId,
                row.GoalId,
                objective,
                null);
            row = DbGoalTools.UpdateByGoalId(objectiveParams)
                ?? throw new InvalidOperationException("Goal disappeared during objective update.");
            if (activeContext != null)
                activeContext.GoalText = objective;
        }

        GoalActionResult? action = null;
        if (status is GoalStatusValues.Complete or GoalStatusValues.Failed or GoalStatusValues.Aborted)
        {
            if (GoalOrchestrator.GetContext(row.GoalId) == null
                && !GoalStatusValues.IsTerminal(row.Status))
            {
                await GoalOrchestrator.ResumeFromDb(row.GoalId, sessionId);
            }

            action = await GoalOrchestrator.SetTerminalStatusFromToolAsync(
                row.GoalId,
                status,
                context);
            if (!action.Success)
                return EncodeActionFailure(row, action);

            var terminalRow = DbGoalTools.GetByGoalId(row.GoalId, sessionId);
            return EncodeResult(new GoalToolResult(
                terminalRow != null ? PersistedGoal(terminalRow) : PersistedGoal(row),
                RuntimeProgress(terminalRow ?? row),
                action));
        }

        var updateParams = BuildUpdateParameters(
            parameters,
            sessionId,
            row.GoalId,
            objective,
            status);
        var updated = DbGoalTools.UpdateByGoalId(updateParams);
        if (updated == null)
            return EncodeError("Goal not found during update.");

        if (activeContext != null && !string.IsNullOrEmpty(objective))
            activeContext.GoalText = objective;

        return EncodeResult(new GoalToolResult(
            PersistedGoal(updated),
            RuntimeProgress(updated)));
    }

    private static string EncodePersistedGoal(GoalRow? row)
        => row == null
            ? EncodeResult(new GoalToolResult())
            : EncodeResult(new GoalToolResult(
                PersistedGoal(row),
                RuntimeProgress(row)));

    private static GoalToolGoal PersistedGoal(GoalRow row)
    {
        var context = GoalOrchestrator.GetContext(row.GoalId);
        return new GoalToolGoal(
            row.SessionId,
            row.GoalId,
            context?.GoalText ?? row.Objective,
            context?.Status ?? row.Status,
            row.UpdatedAt,
            row.TokenBudget,
            row.TokensUsed,
            row.TimeUsedSeconds);
    }

    private static GoalToolProgress RuntimeProgress(GoalRow row)
    {
        var context = GoalOrchestrator.GetContext(row.GoalId);
        if (context != null)
        {
            return new GoalToolProgress(
                context.Plans.Count,
                context.CurrentPlanIndex,
                context.Plans.Count(p => p.Status == GoalPlanStatusValues.Completed),
                context.Plans.Count(p => p.Status == GoalPlanStatusValues.Failed),
                context.Status,
                context.RunState,
                context.StartedAt.ToString("O"));
        }

        var failedPlans = 0;
        if (!string.IsNullOrEmpty(row.PlansJson))
        {
            try
            {
                var plans = JsonSerializer.Deserialize(
                    row.PlansJson,
                    AgentRuntimeJsonContext.Default.ListGoalPlanItem);
                failedPlans = plans?.Count(p => p.Status == GoalPlanStatusValues.Failed) ?? 0;
            }
            catch (JsonException)
            {
                failedPlans = 0;
            }
        }

        return new GoalToolProgress(
            row.PlanCount,
            row.CurrentPlanIndex,
            row.CompletedPlanCount,
            failedPlans,
            row.Status,
            GoalRunStateValues.Idle);
    }

    private static GoalToolGoal PendingGoal(PendingGoal pending)
        => new(
            pending.SessionId,
            pending.GoalId,
            pending.GoalText,
            "pending",
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());

    private static GoalToolProgress PendingProgress()
        => new(0, -1, 0, 0, "pending", GoalRunStateValues.Idle);

    private static string PauseGoal(string sessionId)
    {
        var row = DbGoalTools.GetBySessionId(sessionId);
        if (row == null)
            return EncodeError("No goal to pause.");

        var action = GoalOrchestrator.Pause(row.GoalId);
        return action.Success
            ? EncodeActionResult(row, action)
            : EncodeActionFailure(row, action);
    }

    private static string ResumeGoal(
        string sessionId,
        IWorkerRequestContext context)
    {
        var row = DbGoalTools.GetBySessionId(sessionId);
        if (row == null)
            return EncodeError("No goal to resume.");

        var action = GoalOrchestrator.Resume(row.GoalId, sessionId, context);
        return action.Success
            ? EncodeActionResult(row, action)
            : EncodeActionFailure(row, action);
    }

    private static async Task<string> AbortGoalAsync(
        string sessionId,
        IWorkerRequestContext context)
    {
        var row = DbGoalTools.GetBySessionId(sessionId);
        if (row == null)
            return EncodeError("No goal to abort.");

        if (GoalOrchestrator.GetContext(row.GoalId) == null
            && !GoalStatusValues.IsTerminal(row.Status))
        {
            await GoalOrchestrator.ResumeFromDb(row.GoalId, sessionId);
        }

        var action = await GoalOrchestrator.AbortFromToolAsync(row.GoalId, context);
        return action.Success
            ? EncodeActionResult(row, action)
            : EncodeActionFailure(row, action);
    }

    private static string EncodeActionResult(
        GoalRow row,
        GoalActionResult action)
    {
        var current = DbGoalTools.GetByGoalId(row.GoalId, row.SessionId) ?? row;
        return EncodeResult(new GoalToolResult(
            PersistedGoal(current),
            RuntimeProgress(current),
            action));
    }

    private static string EncodeActionFailure(
        GoalRow row,
        GoalActionResult action)
    {
        var current = DbGoalTools.GetByGoalId(row.GoalId, row.SessionId) ?? row;
        return EncodeResult(new GoalToolResult(
            PersistedGoal(current),
            RuntimeProgress(current),
            action,
            action.Error ?? $"Goal action failed: {action.Action}"));
    }

    private static JsonElement BuildCreateParameters(
        string sessionId,
        string goalId,
        string objective,
        string? workingFolder)
        => WorkerJsonHelper.BuildJsonElement(w =>
        {
            w.WriteStartObject();
            w.WriteString("sessionId", sessionId);
            w.WriteString("goalId", goalId);
            w.WriteString("objective", objective);
            w.WriteString("status", GoalStatusValues.Active);
            if (!string.IsNullOrEmpty(workingFolder))
                w.WriteString("workingFolder", workingFolder);
            w.WriteEndObject();
        });

    private static JsonElement BuildUpdateParameters(
        JsonElement parameters,
        string sessionId,
        string goalId,
        string? objective,
        string? status)
        => WorkerJsonHelper.BuildJsonElement(w =>
        {
            w.WriteStartObject();
            w.WriteString("sessionId", sessionId);
            w.WriteString("goalId", goalId);
            if (parameters.ValueKind == JsonValueKind.Object
                && parameters.TryGetProperty("dbPath", out var dbPath)
                && dbPath.ValueKind == JsonValueKind.String)
            {
                w.WriteString("dbPath", dbPath.GetString());
            }
            w.WriteStartObject("patch");
            if (!string.IsNullOrEmpty(objective))
                w.WriteString("objective", objective);
            if (!string.IsNullOrEmpty(status))
                w.WriteString("status", status);
            w.WriteEndObject();
            w.WriteEndObject();
        });

    private static string EncodeResult(GoalToolResult result)
        => JsonSerializer.Serialize(
            result,
            AgentRuntimeJsonContext.Default.GoalToolResult);

    private static string EncodeError(string message)
        => EncodeResult(new GoalToolResult(Error: message));
}