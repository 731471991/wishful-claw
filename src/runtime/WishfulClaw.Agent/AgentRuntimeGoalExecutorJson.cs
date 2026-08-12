using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent;

public static partial class AgentRuntimeGoalExecutor
{
    private static JsonElement BuildCreateParameters(
        string sessionId,
        string goalId,
        string objective,
        string? workingFolder,
        string status)
        => WorkerJsonHelper.BuildJsonElement(w =>
        {
            w.WriteStartObject();
            w.WriteString("sessionId", sessionId);
            w.WriteString("goalId", goalId);
            w.WriteString("objective", objective);
            w.WriteString("status", status);
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
