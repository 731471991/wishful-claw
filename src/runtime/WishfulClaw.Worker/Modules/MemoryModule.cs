using System.IO;
using System.Linq;
using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Workspace.Memory;
using WishfulClaw.Worker.Tools;
using WishfulClaw.Worker.AgentRuntime;
using WishfulClaw.Worker.Modules.Db;

namespace WishfulClaw.Worker.Modules;

/// <summary>
/// Worker module for memory IPC endpoints.
/// </summary>
internal sealed class MemoryModule : IWorkerModule
{
    public string Name => "memory";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("memory/stats", MemoryStats);
        context.Register("memory/read", MemoryRead);
        context.Register("memory/write", MemoryWrite);
        context.Register("memory/search", MemorySearch);
        context.Register("memory/append", MemoryAppend);
        context.Register("memory/update", MemoryUpdate);
    }

    // ── Handlers ──

    private static Task<WorkerResponse> MemoryStats(JsonElement parameters)
    {
        var scope = GetScope(parameters);
        return RunAsync(() =>
        {
            var path = MemoryPathResolver.GetMemoryFilePath(scope);
            var hotCount = 0;
            if (File.Exists(path))
            {
                var content = File.ReadAllText(path);
                // Count "## " headings at line start
                hotCount = content.Split('\n').Count(l => l.StartsWith("## "));
            }
            return Task.FromResult(WorkerResponse.Json(new MemoryStats
            {
                HotCount = hotCount,
                WarmCount = 0,
                ColdCount = 0,
                TopicsCount = 0,
                DailyCount = 0
            }));
        });
    }

    private static Task<WorkerResponse> MemoryRead(JsonElement parameters)
    {
        var scope = GetScope(parameters);
        return RunAsync(async () =>
        {
            var path = MemoryPathResolver.GetMemoryFilePath(scope);
            if (!File.Exists(path))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                await File.WriteAllTextAsync(path, "# Long-Term Memory\n");
            }
            var content = await File.ReadAllTextAsync(path);
            return WorkerResponse.Json(new { content });
        });
    }

    private static Task<WorkerResponse> MemoryWrite(JsonElement parameters)
    {
        var scope = GetScope(parameters);
        var content = GetString(parameters, "content") ?? "";
        return RunAsync(async () =>
        {
            var path = MemoryPathResolver.GetMemoryFilePath(scope);
            if (!File.Exists(path))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                await File.WriteAllTextAsync(path, "# Long-Term Memory\n");
            }
            await File.WriteAllTextAsync(path, content);
            SystemPromptCache.Clear(); // Invalidate cached system prompt — memory content changed
            return WorkerResponse.Json(new { ok = true });
        });
    }

    private static Task<WorkerResponse> MemorySearch(JsonElement parameters)
    {
        var query = GetString(parameters, "query") ?? "";
        var scope = GetScope(parameters, allowNull: true);
        var limit = GetInt(parameters, "limit", 10);
        var includeDeprecated = GetBool(parameters, "include_deprecated", false);
        var search = GetSearch();
        return RunAsync(async () =>
        {
            var hits = await search.SearchAsync(query, scope, limit, includeDeprecated);
            return WorkerResponse.Json(new { hits });
        });
    }

    private static Task<WorkerResponse> MemoryAppend(JsonElement parameters)
    {
        var scope = GetScope(parameters);
        var content = GetString(parameters, "content") ?? "";
        var title = GetString(parameters, "title");
        var priorityStr = GetString(parameters, "priority") ?? "standard";
        return RunAsync(() =>
        {
            var db = DbClient.GetClient();
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var entry = new MemoryEntryEntity
            {
                Scope = scope,
                Title = title ?? content[..Math.Min(80, content.Length)],
                Content = content,
                Priority = priorityStr.ToLowerInvariant(),
                Status = "active",
                CreatedAt = now,
                UpdatedAt = now
            };
            var id = db.Insertable(entry).ExecuteReturnIdentity();
            return Task.FromResult(WorkerResponse.Json(new { ok = true, id }));
        });
    }

    private static Task<WorkerResponse> MemoryUpdate(JsonElement parameters)
    {
        var id = GetLong(parameters, "id");
        var content = GetString(parameters, "content");
        var priority = GetString(parameters, "priority");
        var status = GetString(parameters, "status");
        return RunAsync(() =>
        {
            var db = DbClient.GetClient();
            var entry = db.Queryable<MemoryEntryEntity>().Where(e => e.Id == id).First();
            if (entry is null)
                return Task.FromResult(WorkerResponse.Json(new { ok = false, error = "Entry not found" }));

            if (content is not null) entry.Content = content;
            if (priority is not null) entry.Priority = priority.ToLowerInvariant();
            if (status is not null) entry.Status = status.ToLowerInvariant();
            entry.UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            db.Updateable(entry).ExecuteCommand();
            return Task.FromResult(WorkerResponse.Json(new { ok = true }));
        });
    }

    // ── Helpers ──

private static IMemorySearch GetSearch() =>
        ToolModuleState.MemorySearch ?? throw new InvalidOperationException("Memory search service not initialized");

    private static string GetScope(JsonElement parameters, bool allowNull = false)
    {
        var scope = GetString(parameters, "scope");
        if (!string.IsNullOrWhiteSpace(scope))
        {
            if (scope == "project")
            {
                var workingFolder = GetString(parameters, "workingFolder");
                return !string.IsNullOrWhiteSpace(workingFolder) ? $"project:{workingFolder}" : "global";
            }
            if (scope == "global")
                return "global";
            return scope;
        }
        var wf = GetString(parameters, "workingFolder");
        if (!string.IsNullOrWhiteSpace(wf))
            return $"project:{wf}";
        return allowNull ? "global" : "global";
    }

    private static string? GetString(JsonElement element, string name)
    {
        if (element.ValueKind == JsonValueKind.Object &&
            element.TryGetProperty(name, out var prop) &&
            prop.ValueKind == JsonValueKind.String)
        {
            return prop.GetString();
        }
        return null;
    }

    private static int GetInt(JsonElement element, string name, int defaultValue)
    {
        if (element.ValueKind == JsonValueKind.Object &&
            element.TryGetProperty(name, out var prop) &&
            prop.ValueKind == JsonValueKind.Number)
        {
            return prop.GetInt32();
        }
        return defaultValue;
    }

    private static long GetLong(JsonElement element, string name)
    {
        if (element.ValueKind == JsonValueKind.Object &&
            element.TryGetProperty(name, out var prop) &&
            prop.ValueKind == JsonValueKind.Number)
        {
            return prop.GetInt64();
        }
        return 0;
    }

    private static bool GetBool(JsonElement element, string name, bool defaultValue)
    {
        if (element.ValueKind == JsonValueKind.Object &&
            element.TryGetProperty(name, out var prop))
        {
            if (prop.ValueKind == JsonValueKind.True) return true;
            if (prop.ValueKind == JsonValueKind.False) return false;
        }
        return defaultValue;
    }

    private static async Task<WorkerResponse> RunAsync(Func<Task<WorkerResponse>> action)
    {
        try
        {
            return await action();
        }
        catch (Exception ex)
        {
            return WorkerResponse.Json(new { ok = false, error = ex.Message });
        }
    }
}
