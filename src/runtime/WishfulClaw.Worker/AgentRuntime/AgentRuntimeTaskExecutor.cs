using System.Collections.Concurrent;
using System.Text.Json;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Task tool executor — TaskCreate/Get/Update/List.
/// Simplified port: in-memory storage (no SQLite). Ported from OpenCowork AgentRuntimeTaskExecutor.
/// </summary>
internal static class AgentRuntimeTaskExecutor
{
    private static readonly ConcurrentDictionary<string, ConcurrentDictionary<string, TaskRecord>> SessionTasks = new(StringComparer.Ordinal);

    public static bool IsTaskTool(string toolName) =>
        toolName is "TaskCreate" or "TaskGet" or "TaskUpdate" or "TaskList";

    public static string Execute(AgentRuntimeNativeToolCall call, JsonElement parameters)
    {
        var sessionId = JsonHelpers.GetString(parameters, "sessionId")?.Trim() ?? string.Empty;
        if (sessionId.Length == 0)
            return EncodeError("No active session context.");

        var tasks = SessionTasks.GetOrAdd(sessionId, _ => new ConcurrentDictionary<string, TaskRecord>(StringComparer.Ordinal));

        return call.Name switch
        {
            "TaskCreate" => CreateTask(call.Input, tasks),
            "TaskGet" => GetTask(call.Input, tasks),
            "TaskUpdate" => UpdateTask(call.Input, tasks),
            "TaskList" => ListTasks(tasks),
            _ => EncodeError($"Unknown task tool: {call.Name}")
        };
    }

    private static string CreateTask(JsonElement input, ConcurrentDictionary<string, TaskRecord> tasks)
    {
        var title = JsonHelpers.GetString(input, "title")?.Trim() ?? string.Empty;
        if (title.Length == 0)
            return EncodeError("TaskCreate requires a non-empty title.");

        var id = $"task-{Guid.NewGuid():N}"[..16];
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var task = new TaskRecord(id, title,
            JsonHelpers.GetString(input, "description") ?? string.Empty,
            "pending", now, now);
        tasks[id] = task;
        return EncodeTask(task);
    }

    private static string GetTask(JsonElement input, ConcurrentDictionary<string, TaskRecord> tasks)
    {
        var id = JsonHelpers.GetString(input, "task_id")?.Trim() ?? string.Empty;
        if (!tasks.TryGetValue(id, out var task))
            return EncodeError($"Task not found: {id}");
        return EncodeTask(task);
    }

    private static string UpdateTask(JsonElement input, ConcurrentDictionary<string, TaskRecord> tasks)
    {
        var id = JsonHelpers.GetString(input, "task_id")?.Trim() ?? string.Empty;
        if (!tasks.TryGetValue(id, out var existing))
            return EncodeError($"Task not found: {id}");

        var status = JsonHelpers.GetString(input, "status")?.Trim() ?? existing.Status;
        var title = JsonHelpers.GetString(input, "title")?.Trim() ?? existing.Title;
        var desc = JsonHelpers.GetString(input, "description")?.Trim() ?? existing.Description;
        var updated = existing with { Title = title, Description = desc, Status = status, UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() };
        tasks[id] = updated;
        return EncodeTask(updated);
    }

    private static string ListTasks(ConcurrentDictionary<string, TaskRecord> tasks)
    {
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream))
        {
            w.WriteStartObject();
            w.WritePropertyName("tasks");
            w.WriteStartArray();
            foreach (var t in tasks.Values.OrderBy(x => x.CreatedAt))
            {
                w.WriteStartObject();
                w.WriteString("id", t.Id);
                w.WriteString("title", t.Title);
                w.WriteString("status", t.Status);
                w.WriteNumber("createdAt", t.CreatedAt);
                w.WriteEndObject();
            }
            w.WriteEndArray();
            w.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }

    private static string EncodeTask(TaskRecord task)
    {
        using var stream = new MemoryStream();
        using (var w = new Utf8JsonWriter(stream))
        {
            w.WriteStartObject();
            w.WriteStartObject("task");
            w.WriteString("id", task.Id);
            w.WriteString("title", task.Title);
            w.WriteString("description", task.Description);
            w.WriteString("status", task.Status);
            w.WriteNumber("createdAt", task.CreatedAt);
            w.WriteNumber("updatedAt", task.UpdatedAt);
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

    private sealed record TaskRecord(string Id, string Title, string Description, string Status, long CreatedAt, long UpdatedAt);
}
