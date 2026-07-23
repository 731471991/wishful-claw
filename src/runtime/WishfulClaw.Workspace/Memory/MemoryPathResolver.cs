namespace WishfulClaw.Workspace.Memory;

/// <summary>
/// Resolves file paths for memory storage based on scope.
/// Global scope: ~/.wishful-claw/
/// Project scope: {workingFolder}/.wishful-claw/
/// </summary>
public static class MemoryPathResolver
{
    /// <summary>
    /// Global memory root: ~/.wishful-claw/
    /// </summary>
    public static string GlobalRoot =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".wishful-claw");

    /// <summary>
    /// Resolve the memory root path for a given scope.
    /// </summary>
    /// <param name="scope">"global" or "project:{workingFolder}"</param>
    public static string ResolveRoot(string? scope)
    {
        if (string.IsNullOrWhiteSpace(scope) || scope == "global")
            return GlobalRoot;

        // Project scope: "project:{workingFolder}"
        if (scope.StartsWith("project:", StringComparison.OrdinalIgnoreCase))
        {
            var workingFolder = scope["project:".Length..];
            return Path.Combine(workingFolder, ".wishful-claw");
        }

        return GlobalRoot;
    }

    /// <summary>
    /// Get the MEMORY.md file path for a scope.
    /// </summary>
    public static string GetMemoryFilePath(string? scope) =>
        Path.Combine(ResolveRoot(scope), "MEMORY.md");

    /// <summary>
    /// Get the memory directory path for a scope.
    /// </summary>
    public static string GetMemoryDir(string? scope) =>
        Path.Combine(ResolveRoot(scope), "memory");

    /// <summary>
    /// Get the daily memory log directory.
    /// </summary>
    public static string GetDailyDir(string? scope) =>
        Path.Combine(ResolveRoot(scope), "memory", "daily");

    /// <summary>
    /// Get the dormant memory directory.
    /// </summary>
    public static string GetDormantDir(string? scope) =>
        Path.Combine(ResolveRoot(scope), "memory", "dormant");

    /// <summary>
    /// Get the topics directory.
    /// </summary>
    public static string GetTopicsDir(string? scope) =>
        Path.Combine(ResolveRoot(scope), "memory", "topics");

    /// <summary>
    /// Get today's daily log file path.
    /// </summary>
    public static string GetDailyFilePath(string? scope, string? date = null)
    {
        var d = string.IsNullOrWhiteSpace(date)
            ? DateTimeOffset.Now.ToString("yyyy-MM-dd")
            : date;
        return Path.Combine(GetDailyDir(scope), $"{d}.md");
    }

    /// <summary>
    /// Get a dormant memory file path by key.
    /// </summary>
    public static string GetDormantFilePath(string? scope, string key) =>
        Path.Combine(GetDormantDir(scope), $"{key}.md");
}
