using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Workspace.Memory;
using WishfulClaw.Worker.Tools;

namespace WishfulClaw.Worker.Modules;

/// <summary>
/// Worker module for memory IPC endpoints.
/// Exposes memory CRUD, search, archive, and consolidation to the frontend.
/// </summary>
internal sealed class MemoryModule : IWorkerModule
{
    public string Name => "memory";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("memory/stats", MemoryStats);
        context.Register("memory/list", MemoryList);
        context.Register("memory/search", MemorySearch);
        context.Register("memory/read", MemoryRead);
        context.Register("memory/write", MemoryWrite);
        context.Register("memory/append", MemoryAppend);
        context.Register("memory/promote", MemoryPromote);
        context.Register("memory/archive", MemoryArchive);
        context.Register("memory/consolidate", MemoryConsolidate);
    }

    // ── Handlers ──

    private static Task<WorkerResponse> MemoryStats(JsonElement parameters)
    {
        var scope = GetScope(parameters);
        var store = GetStore();
        return RunAsync(async () =>
        {
            await store.EnsureMemoryLayoutAsync(scope);
            var stats = await store.GetStatsAsync(scope);
            return WorkerResponse.Json(stats);
        });
    }

    private static Task<WorkerResponse> MemoryList(JsonElement parameters)
    {
        var scope = GetScope(parameters);
        var store = GetStore();
        return RunAsync(async () =>
        {
            await store.EnsureMemoryLayoutAsync(scope);
            var target = GetString(parameters, "target") ?? "memory";

            if (target == "dormant")
            {
                var entries = await store.ListDormantAsync(scope);
                return WorkerResponse.Json(new { entries });
            }

            // Default: list MEMORY.md sections
            var sections = await store.ReadMemoryAsync(scope);
            return WorkerResponse.Json(new { sections });
        });
    }

    private static Task<WorkerResponse> MemorySearch(JsonElement parameters)
    {
        var query = GetString(parameters, "query") ?? "";
        var scope = GetScope(parameters, allowNull: true);
        var limit = GetInt(parameters, "limit", 10);
        var search = GetSearch();
        return RunAsync(async () =>
        {
            var hits = await search.SearchAsync(query, scope, limit);
            return WorkerResponse.Json(new { hits });
        });
    }

    private static Task<WorkerResponse> MemoryRead(JsonElement parameters)
    {
        var scope = GetScope(parameters);
        var target = GetString(parameters, "target") ?? "memory";
        var store = GetStore();
        return RunAsync(async () =>
        {
            await store.EnsureMemoryLayoutAsync(scope);

            if (target == "stats")
            {
                var stats = await store.GetStatsAsync(scope);
                return WorkerResponse.Json(stats);
            }

            if (target == "dormant")
            {
                var entries = await store.ListDormantAsync(scope);
                return WorkerResponse.Json(new { entries });
            }

            if (target.StartsWith("dormant:", StringComparison.OrdinalIgnoreCase))
            {
                var key = target["dormant:".Length..].Trim();
                var entry = await store.ReadDormantAsync(scope, key);
                return WorkerResponse.Json(new { entry });
            }

            // Default: read MEMORY.md
            var sections = await store.ReadMemoryAsync(scope);
            return WorkerResponse.Json(new { sections });
        });
    }

    private static Task<WorkerResponse> MemoryWrite(JsonElement parameters)
    {
        var scope = GetScope(parameters);
        var section = GetString(parameters, "section") ?? "";
        var content = GetString(parameters, "content") ?? "";
        var store = GetStore();
        var search = GetSearch();
        return RunAsync(async () =>
        {
            await store.EnsureMemoryLayoutAsync(scope);
            await store.UpsertSectionAsync(scope, section, content);

            // Update FTS index
            var key = MemoryMarkdownParser.NormalizeKey(section);
            await search.IndexAsync(scope, key, section, content);

            return WorkerResponse.Json(new { ok = true, key });
        });
    }

    private static Task<WorkerResponse> MemoryAppend(JsonElement parameters)
    {
        var scope = GetScope(parameters);
        var content = GetString(parameters, "content") ?? "";
        var priorityStr = GetString(parameters, "priority") ?? "standard";
        var priority = priorityStr.ToLowerInvariant() switch
        {
            "permanent" or "p0" => MemoryPriority.Permanent,
            "lasting" or "p1" => MemoryPriority.Lasting,
            "ephemeral" or "p3" => MemoryPriority.Ephemeral,
            _ => MemoryPriority.Standard
        };
        var store = GetStore();
        var search = GetSearch();
        return RunAsync(async () =>
        {
            await store.EnsureMemoryLayoutAsync(scope);
            await store.AppendDailyAsync(scope, content, priority);

            // Index in FTS
            var date = DateTimeOffset.Now.ToString("yyyy-MM-dd");
            await search.IndexAsync(scope, $"daily-{date}", $"Daily Memory {date}", content);

            return WorkerResponse.Json(new { ok = true, date });
        });
    }

    private static Task<WorkerResponse> MemoryPromote(JsonElement parameters)
    {
        var scope = GetScope(parameters);
        var key = GetString(parameters, "key") ?? "";
        var store = GetStore();
        return RunAsync(async () =>
        {
            var promoted = await store.PromoteDormantAsync(scope, key);
            return WorkerResponse.Json(new { ok = promoted });
        });
    }

    private static Task<WorkerResponse> MemoryArchive(JsonElement parameters)
    {
        var scope = GetScope(parameters);
        var key = GetString(parameters, "key") ?? "";
        var store = GetStore();
        var search = GetSearch();
        return RunAsync(async () =>
        {
            var entry = await store.ReadDormantAsync(scope, key);
            if (entry is null)
                return WorkerResponse.Json(new { ok = false, error = "Entry not found" });

            await search.ArchiveToColdAsync(scope, key, entry.Title, entry.Content, entry.Priority);
            await store.DeleteDormantAsync(scope, key);

            return WorkerResponse.Json(new { ok = true });
        });
    }

    private static Task<WorkerResponse> MemoryConsolidate(JsonElement parameters)
    {
        var scope = GetScope(parameters);
        var store = GetStore();
        return RunAsync(async () =>
        {
            await store.EnsureMemoryLayoutAsync(scope);

            // Simple consolidation: re-index all MEMORY.md sections into FTS
            var sections = await store.ReadMemoryAsync(scope);
            var search = GetSearch();
            foreach (var s in sections)
            {
                var key = MemoryMarkdownParser.NormalizeKey(s.Title);
                await search.IndexAsync(scope, key, s.Title, s.Body);
            }

            // Re-index dormant entries
            var dormant = await store.ListDormantAsync(scope);
            foreach (var d in dormant)
            {
                await search.IndexAsync(scope, d.Key, d.Title, d.Content);
            }

            return WorkerResponse.Json(new { ok = true, indexedCount = sections.Count + dormant.Count });
        });
    }

    // ── Helpers ──

    private static IMemoryStore GetStore() =>
        ToolModuleState.MemoryStore ?? new MemoryStore();

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
