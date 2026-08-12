using System.Buffers;
using System.Collections.Concurrent;
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
    private static readonly ConcurrentDictionary<string, GoalRecord> Goals = new(StringComparer.Ordinal);

    public static bool IsGoalTool(string toolName) =>
        toolName is "get_goal" or "create_goal" or "update_goal" or "pause_goal" or "resume_goal" or "abort_goal";

    /// <summary>
    /// Execute a goal tool synchronously (get_goal, update_goal).
    /// create_goal must use ExecuteAsync to trigger the orchestrator.
    /// </summary>
    public static string Execute(AgentRuntimeNativeToolCall call, JsonElement parameters)
    {
        var sessionId = JsonHelpers.GetString(parameters, "sessionId")?.Trim() ?? string.Empty;
        if (sessionId.Length == 0)
            return EncodeError("No active session.");

        return call.Name switch
        {
            "get_goal" => EncodeGoalWithProgress(Goals.TryGetValue(sessionId, out var g) ? g : null, sessionId),
            "update_goal" => UpdateGoal(call.Input, sessionId),
            "pause_goal" => PauseGoal(sessionId),
            "resume_goal" => ResumeGoal(sessionId),
            "abort_goal" => AbortGoal(sessionId),
            _ => EncodeError($"Use ExecuteAsync for {call.Name}")
        };
    }

    /// <summary>
    /// Execute a goal tool asynchronously. create_goal triggers GoalOrchestrator.
    /// </summary>
    public static async Task<string> ExecuteAsync(
        AgentRuntimeNativeToolCall call,
        AgentRuntimeRunState state,
        IWorkerRequestContext context)
    {
        var sessionId = JsonHelpers.GetString(state.Parameters, "sessionId")?.Trim() ?? string.Empty;
        if (sessionId.Length == 0)
            return EncodeError("No active session.");

        if (call.Name == "get_goal")
        {
            // Re-emit pending confirmation event if a pending goal exists,
            // so the frontend can show the confirmation card again
            var goal = Goals.TryGetValue(sessionId, out var g) ? g : null;
            if (goal?.Status == "pending" && goal.GoalId != null)
            {
                var pendingText = GoalOrchestrator.GetPendingGoal(goal.GoalId)?.GoalText ?? goal.Objective;
                _ = GoalOrchestrator.EmitPendingGoalAsync(goal.GoalId, sessionId, pendingText, context);
            }
            return Execute(call, state.Parameters);
        }

        if (call.Name != "create_goal")
            return Execute(call, state.Parameters);

        return await CreateGoalAsync(call.Input, sessionId, state.Parameters, state, context);
    }

    private static async Task<string> CreateGoalAsync(
        JsonElement input,
        string sessionId,
        JsonElement parameters,
        AgentRuntimeRunState parentState,
        IWorkerRequestContext context)
    {
        var objective = JsonHelpers.GetString(input, "objective")?.Trim() ?? string.Empty;
        if (objective.Length == 0)
            return EncodeError("create_goal requires a non-empty objective.");

        // Check if a goal is already running or pending for this session
        var existingGoalId = GoalOrchestrator.GetActiveGoalId(sessionId) ?? GoalOrchestrator.GetPendingGoalId(sessionId);
        if (existingGoalId != null)
        {
            var existingStatus = GoalOrchestrator.GetActiveGoalId(sessionId) != null ? "active" : "pending";
            if (existingStatus == "pending")
            {
                // Re-send reverse request for existing pending goal
                var existingText = GoalOrchestrator.GetPendingGoal(existingGoalId)?.GoalText ?? objective;
                var existingGoal = new GoalRecord(objective, "pending", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), existingGoalId);
                Goals[sessionId] = existingGoal;
                return await AwaitGoalConfirmationAsync(existingGoal, existingGoalId, sessionId, existingText, context, parameters);
            }
            return EncodeGoal(new GoalRecord(objective, existingStatus, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), existingGoalId));
        }

        // Create a pending goal
        var workingFolder = JsonHelpers.GetString(parameters, "workingFolder");
        var goalId = GoalOrchestrator.CreatePendingGoal(
            objective, sessionId, workingFolder, parameters);

        // Store in memory with pending status
        var goal = new GoalRecord(objective, "pending", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), goalId);
        Goals[sessionId] = goal;

        // Send reverse request and wait for user confirmation
        return await AwaitGoalConfirmationAsync(goal, goalId, sessionId, objective, context);
    }

    private static async Task<string> AwaitGoalConfirmationAsync(
        GoalRecord goal, string goalId, string sessionId, string goalText, IWorkerRequestContext context, JsonElement? parameters = null)
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
                // Persist goal to DB
                try
                {
                    var wfValue = parameters?.TryGetProperty("workingFolder", out var wf) == true ? wf.GetString() : null;
                    var dbParams = WorkerJsonHelper.BuildJsonElement(w =>
                    {
                        w.WriteStartObject();
                        w.WriteString("sessionId", sessionId);
                        w.WriteString("goalId", goalId);
                        w.WriteString("objective", goalText);
                        w.WriteString("status", "active");
                        if (wfValue != null) w.WriteString("workingFolder", wfValue);
                        w.WriteEndObject();
                    });
                    DbGoalTools.Create(dbParams);
                }
                catch (Exception ex)
                {
                    WorkerLog.Warn($"Failed to persist goal to DB: {ex.Message}");
                }

                // Start the orchestrator
                var workingFolder = GoalOrchestrator.GetPendingGoal(goalId)?.WorkingFolder;
                var pendingParams = GoalOrchestrator.GetPendingGoal(goalId)?.Parameters ?? new JsonElement();
                var goalTextFromPending = GoalOrchestrator.GetPendingGoal(goalId)?.GoalText ?? goalText;
                var goalId2 = await GoalOrchestrator.StartAsync(
                    goalTextFromPending, sessionId, workingFolder, goalId,
                    pendingParams, context);
                // Update in-memory state
                Goals[sessionId] = new GoalRecord(goal.Objective, GoalStatusValues.Active, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), goalId2);
                return EncodeGoal(new GoalRecord(goal.Objective, GoalStatusValues.Active, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), goalId2));
            }
            else
            {
                // User discarded — remove pending goal
                GoalOrchestrator.RemovePendingGoal(goalId);
                Goals.TryRemove(sessionId, out _);
                return EncodeError("Goal was discarded by user.");
            }
        }
        catch (OperationCanceledException)
        {
            // Request cancelled (e.g. agent loop stopped)
            return EncodeError("Goal confirmation was cancelled.");
        }
    }

    private static string UpdateGoal(JsonElement input, string sessionId)
    {
        if (!Goals.TryGetValue(sessionId, out var existing))
            return EncodeError("No goal to update. Call create_goal first.");

        var status = JsonHelpers.GetString(input, "status")?.Trim();
        var objective = JsonHelpers.GetString(input, "objective")?.Trim();
        var updated = new GoalRecord(
            objective ?? existing.Objective,
            status ?? existing.Status,
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        Goals[sessionId] = updated;

        // Terminal goal updates stop the active orchestrator.
        if (status is GoalStatusValues.Complete or GoalStatusValues.Failed or GoalStatusValues.Aborted)
        {
            var activeGoalId = GoalOrchestrator.GetActiveGoalId(sessionId);
            if (activeGoalId != null)
                GoalOrchestrator.Abort(activeGoalId);
        }

        return EncodeGoal(updated);
    }

    private static string EncodeGoal(GoalRecord? goal)
    {
        if (goal is null)
            return "{\"goal\":null}";
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream))
        {
            w.WriteStartObject();
            w.WriteStartObject("goal");
            w.WriteString("objective", goal.Objective);
            w.WriteString("status", goal.Status);
            w.WriteNumber("updatedAt", goal.UpdatedAt);
            if (!string.IsNullOrEmpty(goal.GoalId))
                w.WriteString("goalId", goal.GoalId);
            w.WriteEndObject();
            w.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }

    private static string GetGoalProgressJson(string sessionId)
    {
        var goalId = GoalOrchestrator.GetActiveGoalId(sessionId);
        if (goalId == null) return "null";
        var ctx = GoalOrchestrator.GetContext(goalId);
        if (ctx == null) return "null";

        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream))
        {
            w.WriteStartObject();
            w.WriteNumber("planCount", ctx.Plans.Count);
            w.WriteNumber("currentPlanIndex", ctx.CurrentPlanIndex);
            w.WriteNumber("completedPlans", ctx.Plans.Count(p => p.Status == "completed"));
            w.WriteNumber("failedPlans", ctx.Plans.Count(p => p.Status == "failed"));
            w.WriteString("status", ctx.Status);
            w.WriteString("startedAt", ctx.StartedAt.ToString("O"));
            w.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }

    private static string EncodeGoalWithProgress(GoalRecord? goal, string sessionId)
    {
        if (goal is null)
            return "{\"goal\":null,\"progress\":null}";
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream))
        {
            w.WriteStartObject();
            w.WriteStartObject("goal");
            w.WriteString("objective", goal.Objective);
            w.WriteString("status", goal.Status);
            w.WriteNumber("updatedAt", goal.UpdatedAt);
            if (!string.IsNullOrEmpty(goal.GoalId))
                w.WriteString("goalId", goal.GoalId);
            w.WriteEndObject();

            // Plan progress
            w.WritePropertyName("progress");
            w.WriteRawValue(GetGoalProgressJson(sessionId));
            w.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }

    private static string PauseGoal(string sessionId)
    {
        var goalId = GoalOrchestrator.GetActiveGoalId(sessionId);
        if (goalId == null) return EncodeError("No active goal to pause.");
        GoalOrchestrator.Pause(goalId);
        return EncodeGoal(new GoalRecord("", GoalStatusValues.Active, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), goalId));
    }

    private static string ResumeGoal(string sessionId)
    {
        var goalId = GoalOrchestrator.GetActiveGoalId(sessionId);
        if (goalId == null)
        {
            // Try DB recovery (sync, no RunAsync start — will be triggered by frontend Resume)
            var row = DbGoalTools.GetBySessionId(sessionId);
            if (row == null)
                return EncodeError("No paused goal to resume.");
            // Fire-and-forget DB recovery
            _ = GoalOrchestrator.ResumeFromDb(row.GoalId, sessionId);
            return EncodeGoal(new GoalRecord("", row.Status, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), row.GoalId));
        }
        GoalOrchestrator.Resume(goalId);
        return EncodeGoal(new GoalRecord("", GoalStatusValues.Active, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), goalId));
    }

    private static string AbortGoal(string sessionId)
    {
        var goalId = GoalOrchestrator.GetActiveGoalId(sessionId);
        if (goalId == null) return EncodeError("No active goal to abort.");
        GoalOrchestrator.Abort(goalId);
        return EncodeError("Goal aborted.");
    }

    private static string EncodeError(string message)
    {
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream))
        { w.WriteStartObject(); w.WriteString("error", message); w.WriteEndObject(); }
        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }

    private sealed record GoalRecord(string Objective, string Status, long UpdatedAt, string? GoalId = null);
}