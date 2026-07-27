using System.Text.Json;

namespace WishfulClaw.Worker.Modules.Git;

/// <summary>
/// Scans the file system for git repositories within a root directory.
/// SSH remote scanning removed — local only.
/// </summary>
internal static class GitScanTools
{
    private const int DefaultScanDepth = 3;

    private static readonly HashSet<string> ExcludedDirs = new(StringComparer.OrdinalIgnoreCase)
    {
        "node_modules", ".git", "dist", "out", "build", ".next", ".nuxt", "target", "coverage",
        "tmp", "cache", "obj", "bin"
    };

    public static async Task<List<GitRepositorySummary>> ScanRepositoriesAsync(
        JsonElement parameters, string cwd)
    {
        var rawRootPath = GitExecutor.GetString(parameters, "rootPath") ?? cwd;
        var rootPath = Path.GetFullPath(rawRootPath);
        var maxDepth = GitExecutor.GetInt(parameters, "maxDepth", DefaultScanDepth);

        var excluded = new HashSet<string>(ExcludedDirs, StringComparer.OrdinalIgnoreCase);
        foreach (var dir in GetExcludedDirs(parameters))
        {
            excluded.Add(dir);
        }

        var repositories = new List<GitRepositorySummary>();
        var queue = new Queue<(string CurrentPath, int Depth)>();
        queue.Enqueue((rootPath, 0));

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();

            if (await IsGitRepositoryAsync(current.CurrentPath))
            {
                repositories.Add(new GitRepositorySummary(
                    Path.GetFileName(current.CurrentPath),
                    current.CurrentPath,
                    current.CurrentPath == rootPath
                        ? "."
                        : NormalizeSeparators(Path.GetRelativePath(rootPath, current.CurrentPath)),
                    await GetCurrentBranchAsync(current.CurrentPath),
                    current.CurrentPath == rootPath));
                continue;
            }

            if (current.Depth >= maxDepth) continue;

            IEnumerable<string> directories;
            try
            {
                directories = Directory.EnumerateDirectories(current.CurrentPath);
            }
            catch
            {
                continue;
            }

            foreach (var directory in directories)
            {
                var name = Path.GetFileName(directory);
                if (excluded.Contains(name)) continue;
                queue.Enqueue((directory, current.Depth + 1));
            }
        }

        repositories.Sort((left, right) =>
            string.Compare(left.RelativePath, right.RelativePath, StringComparison.OrdinalIgnoreCase));
        return repositories;
    }

    private static async Task<bool> IsGitRepositoryAsync(string cwd)
    {
        var result = await GitExecutor.ExecAsync(
            new[] { "rev-parse", "--is-inside-work-tree" }, cwd);
        return result.Success && result.Stdout.Trim() == "true";
    }

    private static async Task<string> GetCurrentBranchAsync(string cwd)
    {
        var result = await GitExecutor.ExecAsync(
            new[] { "rev-parse", "--abbrev-ref", "HEAD" }, cwd);
        return result.Success ? result.Stdout.Trim() : "HEAD";
    }

    private static string[] GetExcludedDirs(JsonElement parameters)
    {
        if (parameters.ValueKind != JsonValueKind.Object ||
            !parameters.TryGetProperty("excludeDirs", out var prop) ||
            prop.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<string>();
        }

        var result = new List<string>();
        foreach (var item in prop.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String && item.GetString() is { } value)
            {
                result.Add(value);
            }
        }
        return result.ToArray();
    }

    private static string NormalizeSeparators(string value)
    {
        return value.Replace('\\', '/');
    }
}
