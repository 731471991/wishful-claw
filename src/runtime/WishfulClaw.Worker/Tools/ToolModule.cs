using System.Linq;
using System.Reflection;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Tools;
using WishfulClaw.Worker.Tools.FileTools;
using WishfulClaw.Worker.Tools.MemoryTools;
using WishfulClaw.Worker.Tools.SearchTools;
using WishfulClaw.Worker.Tools.ShellTools;
using WishfulClaw.Workspace.Memory;
using WishfulClaw.Worker.AgentRuntime;

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

        // Register the discover_tools meta-tool (always visible regardless of preset)
        registry.Register(new DiscoverToolsTool());

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

            var defs = registry.GetToolDefinitions(preset).ToList();

            // Ensure discover_tools is always included regardless of preset
            var allDefs = registry.GetToolDefinitions();
            var hasDiscover = defs.Any(d => d.Name == "discover_tools");
            if (!hasDiscover)
            {
                var discoverDef = allDefs.FirstOrDefault(d => d.Name == "discover_tools");
                if (discoverDef is not null)
                    defs.Add(discoverDef);
            }

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
        // File tools (category: "file" — included in chat/coding presets)
        registry.Register(new FileReadTool(), "file");
        registry.Register(new FileWriteTool(), "file");
        registry.Register(new FileEditTool(), "file");
        registry.Register(new FileListTool(), "file");

        // Search tools (category: "search" — included in chat/coding presets)
        registry.Register(new GlobTool(), "search");
        registry.Register(new GrepTool(), "search");

        // Shell tools (category: "shell" — included in chat/coding presets)
        registry.Register(new ShellExecuteTool(), "shell");

        // Sub-agent Task tool — load agent definitions from disk into registry first,
        // then construct TaskTool so its description/schema reflect available agent types.
        AgentRuntime.SubAgentRegistry.LoadFromDisk();
        registry.Register(new TaskTool());

        // Sub-agent status and detail query tools
        registry.Register(new SubAgentStatusTool());
        registry.Register(new SubAgentDetailTool());

        // Memory tools (category: "memory" — included in chat/coding presets)
        var memorySearch = new Memory.MemoryFtsService();
        registry.Register(new MemoryHotReadTool(), "memory");
        registry.Register(new MemoryHotWriteTool(), "memory");
        registry.Register(new MemoryAppendTool(), "memory");
        registry.Register(new MemoryUpdateTool(), "memory");
        registry.Register(new MemorySearchTool(memorySearch), "memory");

        // Expose shared instances for AgentLoop
        ToolModuleState.MemorySearch = memorySearch;
    }
}