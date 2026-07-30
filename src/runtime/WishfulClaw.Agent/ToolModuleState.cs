using WishfulClaw.Core.Tools;
using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Agent;

/// <summary>
/// Static accessor for the tool registry and shared services, used by AgentLoop.
/// </summary>
public static class ToolModuleState
{
    public static ToolRegistry? Registry { get; set; }
    public static IMemorySearch? MemorySearch { get; set; }
}
