using System.Collections.Concurrent;
using System.Text.Json;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Goal tool executor — get/create/update goals.
/// Simplified port: in-memory storage (no SQLite). Ported from OpenCowork AgentRuntimeGoalExecutor.
/// </summary>
internal static class AgentRuntimeGoalExecutor
{
    private static readonly ConcurrentDictionary<string, GoalRecord> Goals = new(StringComparer.Ordinal);

    public static bool IsGoalTool(string toolName) =>
        toolName is "get_goal" or "create_goal" or "update_goal";

    public static string Execute(AgentRuntimeNativeToolCall call, JsonElement parameters)
    {
        var sessionId = JsonHelpers.GetString(parameters, "sessionId")?.Trim() ?? string.Empty;
        if (sessionId.Length == 0)
            return EncodeError("No active session.");

        return call.Name switch
        {
            "get_goal" => EncodeGoal(Goals.TryGetValue(sessionId, out var g) ? g : null),
            "create_goal" => CreateGoal(call.Input, sessionId),
            "update_goal" => UpdateGoal(call.Input, sessionId),
            _ => EncodeError($"Unknown goal tool: {call.Name}")
        };
    }

    private static string CreateGoal(JsonElement input, string sessionId)
    {
        var objective = JsonHelpers.GetString(input, "objective")?.Trim() ?? string.Empty;
        if (objective.Length == 0)
            return EncodeError("create_goal requires a non-empty objective.");

        var goal = new GoalRecord(objective, "active", DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
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

    private sealed record GoalRecord(string Objective, string Status, long UpdatedAt);
}
