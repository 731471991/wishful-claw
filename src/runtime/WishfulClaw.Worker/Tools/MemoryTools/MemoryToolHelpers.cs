using System.Text.Json;
using WishfulClaw.Core.Tools;
using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Worker.Tools.MemoryTools;

/// <summary>
/// Shared helpers for memory tool executors.
/// Extracted from MemoryAppendTool to avoid cross-tool coupling.
/// </summary>
internal static class MemoryToolHelpers
{
    /// <summary>
    /// Resolves the memory scope from tool input and execution context.
    /// Priority: explicit scope param → workingFolder from context → global.
    /// </summary>
    public static string ResolveScope(JsonElement input, ToolExecutionContext context)
    {
        var scope = GetString(input, "scope");
        if (!string.IsNullOrWhiteSpace(scope))
        {
            if (scope == "project" && !string.IsNullOrWhiteSpace(context.WorkingFolder))
                return $"project:{context.WorkingFolder}";
            if (scope == "global")
                return "global";
            return scope;
        }

        // Default: project scope if workingFolder available, otherwise global
        return !string.IsNullOrWhiteSpace(context.WorkingFolder)
            ? $"project:{context.WorkingFolder}"
            : "global";
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
}
