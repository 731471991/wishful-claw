using WishfulClaw.Core.Tools;
using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Worker.Tools;

/// <summary>
/// Static accessor for the tool registry and shared services, used by AgentLoop.
/// </summary>
internal static class ToolModuleState
{
    public static ToolRegistry? Registry { get; set; }
    public static IMemorySearch? MemorySearch { get; set; }
}
