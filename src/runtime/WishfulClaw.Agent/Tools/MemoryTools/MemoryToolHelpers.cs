using System.IO;
using WishfulClaw.Core.Tools;
using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Agent.Tools.MemoryTools;

/// <summary>
/// Shared helpers for memory tool executors.
/// Extracted from MemoryAppendTool to avoid cross-tool coupling.
/// </summary>
internal static class MemoryToolHelpers
{
    /// <summary>
    /// Resolves the memory scope from execution context only.
    /// The Agent cannot choose scope — it is determined by the project binding.
    /// SSH project → project:ssh:{projectId}, local project → project:{workingFolder}, otherwise global.
    /// </summary>
    public static string ResolveScope(ToolExecutionContext context)
    {
        // SSH project: has projectId but workingFolder is a remote path
        if (!string.IsNullOrWhiteSpace(context.ProjectId)
            && !string.IsNullOrWhiteSpace(context.WorkingFolder)
            && !Directory.Exists(context.WorkingFolder))
        {
            return $"project:ssh:{context.ProjectId}";
        }

        // Local project: workingFolder exists on local filesystem
        if (!string.IsNullOrWhiteSpace(context.WorkingFolder))
        {
            return $"project:{context.WorkingFolder}";
        }

        return "global";
    }

    /// <summary>
    /// Normalizes a priority string to MemoryPriority enum.
    /// Accepts both names (permanent/lasting/standard/ephemeral) and codes (p0~p3).
    /// </summary>
    public static MemoryPriority NormalizePriority(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return MemoryPriority.Standard;

        return value.Trim().ToLowerInvariant() switch
        {
            "permanent" or "p0" => MemoryPriority.Permanent,
            "lasting" or "p1" => MemoryPriority.Lasting,
            "standard" or "p2" => MemoryPriority.Standard,
            "ephemeral" or "p3" => MemoryPriority.Ephemeral,
            _ => MemoryPriority.Standard
        };
    }

}
