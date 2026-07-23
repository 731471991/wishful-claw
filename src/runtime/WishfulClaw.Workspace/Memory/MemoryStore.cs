using System.Text;

namespace WishfulClaw.Workspace.Memory;

/// <summary>
/// File-based memory store implementation.
/// Manages MEMORY.md (hot), dormant/ (warm), and daily logs.
/// Cold tier (SQLite) is handled separately by MemoryFtsService.
///
/// Design fused from:
/// - KodaClaw: MemoryFileService (file-driven, section parsing, promote mechanism)
/// - OpenClaw.net: IMemoryStore (read/write/list operations)
/// </summary>
public sealed class MemoryStore : IMemoryStore
{
    public Task EnsureMemoryLayoutAsync(string scope, CancellationToken ct = default)
    {
        var root = MemoryPathResolver.ResolveRoot(scope);
        Directory.CreateDirectory(root);
        Directory.CreateDirectory(MemoryPathResolver.GetDailyDir(scope));
        Directory.CreateDirectory(MemoryPathResolver.GetDormantDir(scope));
        Directory.CreateDirectory(MemoryPathResolver.GetTopicsDir(scope));

        var memoryFile = MemoryPathResolver.GetMemoryFilePath(scope);
        if (!File.Exists(memoryFile))
        {
            File.WriteAllText(memoryFile, "# Long-Term Memory\n");
        }

        return Task.CompletedTask;
    }

    public async Task<IReadOnlyList<MemorySection>> ReadMemoryAsync(string scope, CancellationToken ct = default)
    {
        var path = MemoryPathResolver.GetMemoryFilePath(scope);
        if (!File.Exists(path))
            return [];

        var content = await File.ReadAllTextAsync(path, ct);
        return MemoryMarkdownParser.ParseSections(content);
    }

    public async Task WriteMemoryAsync(string scope, string content, CancellationToken ct = default)
    {
        var path = MemoryPathResolver.GetMemoryFilePath(scope);
        await EnsureMemoryLayoutAsync(scope, ct);
        await File.WriteAllTextAsync(path, content, ct);
    }

    public async Task UpsertSectionAsync(string scope, string title, string body, CancellationToken ct = default)
    {
        var path = MemoryPathResolver.GetMemoryFilePath(scope);
        await EnsureMemoryLayoutAsync(scope, ct);

        var content = File.Exists(path)
            ? await File.ReadAllTextAsync(path, ct)
            : "# Long-Term Memory\n";

        var updated = MemoryMarkdownParser.UpsertSection(content, title, body);
        await File.WriteAllTextAsync(path, updated, ct);
    }

    public async Task AppendDailyAsync(string scope, string content, MemoryPriority priority = MemoryPriority.Standard, CancellationToken ct = default)
    {
        await EnsureMemoryLayoutAsync(scope, ct);

        var filePath = MemoryPathResolver.GetDailyFilePath(scope);
        var timestamp = DateTimeOffset.Now.ToString("HH:mm");
        var priorityStr = priority.ToString().ToLowerInvariant();

        var entry = $"\n<!-- {timestamp} | {priorityStr} -->\n{content.TrimEnd()}\n";
        await File.AppendAllTextAsync(filePath, entry, ct);
    }

    public Task<IReadOnlyList<MemoryEntry>> ListDormantAsync(string scope, CancellationToken ct = default)
    {
        var dir = MemoryPathResolver.GetDormantDir(scope);
        if (!Directory.Exists(dir))
            return Task.FromResult<IReadOnlyList<MemoryEntry>>([]);

        var files = Directory.GetFiles(dir, "*.md");
        var entries = new List<MemoryEntry>(files.Length);

        foreach (var file in files)
        {
            ct.ThrowIfCancellationRequested();
            var content = File.ReadAllText(file);
            var fm = MemoryFrontmatterParser.Parse(content);
            var fileName = Path.GetFileNameWithoutExtension(file);

            entries.Add(new MemoryEntry
            {
                Key = fileName,
                Title = fm.Title ?? fileName,
                Content = content,
                Priority = fm.Priority,
                Tier = MemoryTier.Warm,
                Scope = scope ?? "global",
                Created = fm.Created,
                Tags = fm.Tags,
                SourcePath = $"memory/dormant/{Path.GetFileName(file)}"
            });
        }

        return Task.FromResult<IReadOnlyList<MemoryEntry>>(entries);
    }

    public async Task<MemoryEntry?> ReadDormantAsync(string scope, string key, CancellationToken ct = default)
    {
        var path = MemoryPathResolver.GetDormantFilePath(scope, key);
        if (!File.Exists(path))
            return null;

        var content = await File.ReadAllTextAsync(path, ct);
        var fm = MemoryFrontmatterParser.Parse(content);

        return new MemoryEntry
        {
            Key = key,
            Title = fm.Title ?? key,
            Content = content,
            Priority = fm.Priority,
            Tier = MemoryTier.Warm,
            Scope = scope ?? "global",
            Created = fm.Created,
            Tags = fm.Tags,
            SourcePath = $"memory/dormant/{key}.md"
        };
    }

    public async Task WriteDormantAsync(string scope, string key, string title, string content, MemoryFrontmatter frontmatter, CancellationToken ct = default)
    {
        await EnsureMemoryLayoutAsync(scope, ct);

        var path = MemoryPathResolver.GetDormantFilePath(scope, key);
        var fmWithTitle = frontmatter with { Title = title };
        var fmBlock = MemoryFrontmatterParser.Serialize(fmWithTitle);
        var fullContent = $"{fmBlock}\n\n{content.Trim()}\n";

        await File.WriteAllTextAsync(path, fullContent, ct);
    }

    public async Task<bool> PromoteDormantAsync(string scope, string key, CancellationToken ct = default)
    {
        var path = MemoryPathResolver.GetDormantFilePath(scope, key);
        if (!File.Exists(path))
            return false;

        var content = await File.ReadAllTextAsync(path, ct);
        var fm = MemoryFrontmatterParser.Parse(content);
        var title = fm.Title ?? key;
        var body = ExtractBody(content, fm);

        // Append to MEMORY.md as a new section
        await UpsertSectionAsync(scope, title, body, ct);

        // Remove dormant file
        File.Delete(path);
        return true;
    }

    public Task<bool> DeleteDormantAsync(string scope, string key, CancellationToken ct = default)
    {
        var path = MemoryPathResolver.GetDormantFilePath(scope, key);
        if (!File.Exists(path))
            return Task.FromResult(false);

        File.Delete(path);
        return Task.FromResult(true);
    }

    public Task<MemoryStats> GetStatsAsync(string scope, CancellationToken ct = default)
    {
        var memoryFile = MemoryPathResolver.GetMemoryFilePath(scope);
        var hotCount = 0;
        if (File.Exists(memoryFile))
        {
            var content = File.ReadAllText(memoryFile);
            hotCount = MemoryMarkdownParser.ParseSections(content).Count;
        }

        var dormantDir = MemoryPathResolver.GetDormantDir(scope);
        var warmCount = Directory.Exists(dormantDir)
            ? Directory.GetFiles(dormantDir, "*.md").Length
            : 0;

        var topicsDir = MemoryPathResolver.GetTopicsDir(scope);
        var topicsCount = Directory.Exists(topicsDir)
            ? Directory.GetFiles(topicsDir, "*.md").Length
            : 0;

        var dailyDir = MemoryPathResolver.GetDailyDir(scope);
        var dailyCount = Directory.Exists(dailyDir)
            ? Directory.GetFiles(dailyDir, "*.md").Length
            : 0;

        return Task.FromResult(new MemoryStats
        {
            HotCount = hotCount,
            WarmCount = warmCount,
            ColdCount = 0, // Cold count from DB, filled by MemoryFtsService
            TopicsCount = topicsCount,
            DailyCount = dailyCount
        });
    }

    private static string ExtractBody(string content, MemoryFrontmatter fm)
    {
        if (fm.BodyStartLine <= 0)
            return content;

        var lines = content.Split('\n');
        if (fm.BodyStartLine >= lines.Length)
            return string.Empty;

        return string.Join('\n', lines[fm.BodyStartLine..]).Trim();
    }
}
