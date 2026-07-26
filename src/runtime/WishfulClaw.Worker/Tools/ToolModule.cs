using System.Reflection;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Tools;
using WishfulClaw.Worker.Tools.FileTools;
using WishfulClaw.Worker.Tools.MemoryTools;
using WishfulClaw.Worker.Tools.SearchTools;
using WishfulClaw.Worker.Tools.ShellTools;
using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Worker.Tools;

/// <summary>
/// Worker module that registers all tool executors and definitions.
/// 
/// Registration modes:
/// 1. Direct registration — tools with real IToolExecutor implementations (File, Memory, Search, Shell, Task).
/// 2. Auto-discovered providers — IToolProvider implementations found via reflection scanning.
///    Each provider registers tool definitions for its category (Desktop, Web, Browser, Plugin, etc.).
///    Execution of these tools is intercepted by ToolDispatchRouter.
/// </summary>
public sealed class ToolModule : IWorkerModule
{
    public string Name => "tools";

    public void Register(IWorkerModuleContext context)
    {
        var registry = new ToolRegistry();

        // ── Mode 1: Direct registration (tools with real executors) ──
        RegisterDirectExecutors(registry);

        // ── Mode 2: Auto-discover all IToolProvider implementations ──
        // Scans the Worker assembly for IToolProvider classes and calls RegisterTools on each.
        // Adding a new category = add a new file in Tools/Providers/, no edits needed here.
        ToolProviderDiscovery.DiscoverAndRegister(registry, typeof(ToolModule).Assembly);

        // Expose via shared state for AgentLoop to access
        ToolModuleState.Registry = registry;

        // Register IPC handler: tool/list — returns tool definitions for the LLM
        // Optional "preset" parameter filters tools by scenario (chat/coding/channel/automation/minimal/full).
        context.Register("tool/list", args =>
        {
            var presetId = args.TryGetProperty("preset", out var presetEl)
                ? presetEl.GetString() ?? "full"
                : "full";

            var preset = ToolPreset.BuiltIn.TryGetValue(presetId, out var p)
                ? p
                : ToolPreset.BuiltIn["full"];

            var defs = registry.GetToolDefinitions(preset);
            return Task.FromResult(WorkerResponse.FromWriter(writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("preset", preset.Id);
                writer.WriteNumber("count", defs.Count);
                writer.WritePropertyName("tools");
                writer.WriteStartArray();
                foreach (var def in defs)
                {
                    writer.WriteStartObject();
                    writer.WriteString("name", def.Name);
                    writer.WriteString("description", def.Description);
                    writer.WritePropertyName("inputSchema");
                    def.InputSchema.WriteTo(writer);
                    writer.WriteEndObject();
                }
                writer.WriteEndArray();
                writer.WriteEndObject();
            }));
        });
    }

    /// <summary>
    /// Register tools that have real IToolExecutor implementations.
    /// These tools execute directly in the Worker process.
    /// </summary>
    private static void RegisterDirectExecutors(ToolRegistry registry)
    {
        // File tools
        registry.Register(new FileReadTool());
        registry.Register(new FileWriteTool());
        registry.Register(new FileEditTool());
        registry.Register(new FileListTool());

        // Search tools
        registry.Register(new GlobTool());
        registry.Register(new GrepTool());

        // Shell tools
        registry.Register(new ShellExecuteTool());

        // Sub-agent Task tool (definition only — execution intercepted by ToolCallProcessor)
        registry.Register(new TaskTool());

        // Memory tools — shared store + search instances
        var memoryStore = new MemoryStore();
        var memorySearch = new Memory.MemoryFtsService();
        registry.Register(new MemoryHotReadTool(memoryStore));
        registry.Register(new MemoryHotWriteTool(memoryStore));
        registry.Register(new MemoryAppendTool());
        registry.Register(new MemoryUpdateTool());
        registry.Register(new MemorySearchTool(memorySearch));

        // Expose shared instances for AgentLoop
        ToolModuleState.MemoryStore = memoryStore;
        ToolModuleState.MemorySearch = memorySearch;
    }
}
