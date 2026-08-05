using System.Collections.Concurrent;
using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent;

/// <summary>
/// Goal tool executor — get/create/update goals.
/// CreateGoal triggers GoalOrchestrator.StartAsync to start the orchestration loop.
/// </summary>
public static class AgentRuntimeGoalExecutor
{
    private static readonly ConcurrentDictionary<string, GoalRecord> Goals = new(StringComparer.Ordinal);

    public static bool IsGoalTool(string toolName) =>
        toolName is "get_goal" or "create_goal" or "update_goal";

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
            "get_goal" => EncodeGoal(Goals.TryGetValue(sessionId, out var g) ? g : null),
            "update_goal" => UpdateGoal(call.Input, sessionId),
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

        // Check if a goal is already running for this session
        var existingGoalId = GoalOrchestrator.GetActiveGoalId(sessionId);
        if (existingGoalId != null)
            return EncodeGoal(new GoalRecord(objective, "active", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), existingGoalId));

        // Start the orchestration loop
        var workingFolder = JsonHelpers.GetString(parameters, "workingFolder");
        var goalId = await GoalOrchestrator.StartAsync(
            objective, sessionId, workingFolder, parameters, parentState, context);

        // Store in memory with the orchestrator goalId
        var goal = new GoalRecord(objective, "active", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), goalId);
        Goals[sessionId] = goal;

        return EncodeGoal(goal);
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

        // If status is "completed" or "blocked", abort the orchestrator
        if (status is "completed" or "blocked" or "failed")
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

    private static string EncodeError(string message)
    {
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream))
        { w.WriteStartObject(); w.WriteString("error", message); w.WriteEndObject(); }
        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }

    private sealed record GoalRecord(string Objective, string Status, long UpdatedAt, string? GoalId = null);
}