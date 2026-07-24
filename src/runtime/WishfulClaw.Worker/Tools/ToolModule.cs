using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Tools;
using WishfulClaw.Worker.Tools.FileTools;
using WishfulClaw.Worker.Tools.MemoryTools;
using WishfulClaw.Worker.Tools.SearchTools;
using WishfulClaw.Worker.Tools.ShellTools;
using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Worker.Tools;

/// <summary>
/// Worker module that registers all tool executors.
/// </summary>
public sealed class ToolModule : IWorkerModule
{
    public string Name => "tools";

    public void Register(IWorkerModuleContext context)
    {
        var registry = new ToolRegistry();

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

        // Memory tools — shared store + search instances
        var memoryStore = new MemoryStore();
        var memorySearch = new Memory.MemoryFtsService();
        registry.Register(new MemoryHotReadTool(memoryStore));
        registry.Register(new MemoryHotWriteTool(memoryStore));
        registry.Register(new MemoryAppendTool());
        registry.Register(new MemoryUpdateTool());
        registry.Register(new MemorySearchTool(memorySearch));

        // Expose via shared state for AgentLoop to access
        ToolModuleState.Registry = registry;
        ToolModuleState.MemoryStore = memoryStore;
        ToolModuleState.MemorySearch = memorySearch;

        // Register IPC handler: tool/list — returns tool definitions for the LLM
        context.Register("tool/list", _ =>
        {
            var defs = registry.GetToolDefinitions();
            return Task.FromResult(WorkerResponse.FromWriter(writer =>
            {
                writer.WriteStartObject();
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
}

/// <summary>
/// Static accessor for the tool registry, used by AgentLoop.
/// </summary>
internal static class ToolModuleState
{
    public static ToolRegistry? Registry { get; set; }
    public static IMemoryStore? MemoryStore { get; set; }
    public static IMemorySearch? MemorySearch { get; set; }
}
