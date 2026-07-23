namespace WishfulClaw.Workspace.Memory;

/// <summary>
/// Parses YAML-like frontmatter from memory markdown files.
/// Handles the --- delimited header with fields like priority, status, created, tags, valid_until.
/// No external YAML library — simple line-by-line parsing.
/// Adapted from KodaClaw's MemoryFrontmatterParser.
/// </summary>
public static class MemoryFrontmatterParser
{
    public static MemoryFrontmatter Parse(string content)
    {
        var priority = MemoryPriority.Standard;
        var status = "active";
        string? created = null;
        string? title = null;
        string[] tags = [];
        string? validUntil = null;
        var bodyStartLine = 0;

        if (string.IsNullOrWhiteSpace(content))
            return BuildFrontmatter(priority, status, created, title, tags, validUntil, bodyStartLine);

        var lines = content.Split('\n');
        if (lines.Length < 2 || lines[0].Trim() != "---")
            return BuildFrontmatter(priority, status, created, title, tags, validUntil, bodyStartLine);

        for (var i = 1; i < lines.Length; i++)
        {
            var line = lines[i].Trim();
            if (line == "---")
            {
                bodyStartLine = i + 1;
                break;
            }

            var colonIdx = line.IndexOf(':');
            if (colonIdx <= 0) continue;

            var key = line[..colonIdx].Trim().ToLowerInvariant();
            var value = line[(colonIdx + 1)..].Trim();

            switch (key)
            {
                case "priority":
                    priority = NormalizePriority(value);
                    break;
                case "status":
                    status = value;
                    break;
                case "created":
                    created = value;
                    break;
                case "tags":
                    tags = ParseInlineList(value);
                    break;
                case "title":
                    title = value;
                    break;
                case "valid_until":
                    validUntil = value;
                    break;
            }
        }

        return BuildFrontmatter(priority, status, created, title, tags, validUntil, bodyStartLine);
    }

    private static MemoryFrontmatter BuildFrontmatter(
        MemoryPriority priority, string status, string? created,
        string? title, string[] tags, string? validUntil, int bodyStartLine) =>
        new()
        {
            Priority = priority,
            Status = status,
            Created = created,
            Title = title,
            Tags = tags,
            ValidUntil = validUntil,
            BodyStartLine = bodyStartLine
        };

    /// <summary>
    /// Serialize frontmatter to a YAML-like string block.
    /// </summary>
    public static string Serialize(MemoryFrontmatter fm)
    {
        var lines = new List<string> { "---" };
        lines.Add($"priority: {ToPriorityString(fm.Priority)}");
        lines.Add($"status: {fm.Status}");
        if (!string.IsNullOrWhiteSpace(fm.Created))
            lines.Add($"created: {fm.Created}");
        if (!string.IsNullOrWhiteSpace(fm.Title))
            lines.Add($"title: {fm.Title}");
        if (fm.Tags.Length > 0)
            lines.Add($"tags: [{string.Join(", ", fm.Tags)}]");
        if (!string.IsNullOrWhiteSpace(fm.ValidUntil))
            lines.Add($"valid_until: {fm.ValidUntil}");
        lines.Add("---");
        return string.Join('\n', lines);
    }

    /// <summary>
    /// Extract the body content (everything after frontmatter).
    /// </summary>
    public static string ExtractBody(string content)
    {
        var fm = Parse(content);
        if (fm.BodyStartLine <= 0)
            return content;

        var lines = content.Split('\n');
        if (fm.BodyStartLine >= lines.Length)
            return string.Empty;

        return string.Join('\n', lines[fm.BodyStartLine..]).Trim();
    }

    private static string ToPriorityString(MemoryPriority priority) => priority switch
    {
        MemoryPriority.Permanent => "permanent",
        MemoryPriority.Lasting => "lasting",
        MemoryPriority.Standard => "standard",
        MemoryPriority.Ephemeral => "ephemeral",
        _ => "standard"
    };

    private static MemoryPriority NormalizePriority(string value)
    {
        return value.Trim().ToLowerInvariant() switch
        {
            "0" or "p0" or "permanent" => MemoryPriority.Permanent,
            "1" or "p1" or "lasting" => MemoryPriority.Lasting,
            "2" or "p2" or "standard" => MemoryPriority.Standard,
            "3" or "p3" or "ephemeral" => MemoryPriority.Ephemeral,
            _ => MemoryPriority.Standard
        };
    }

    private static string[] ParseInlineList(string value)
    {
        var trimmed = value.Trim();
        if (trimmed.StartsWith('[') && trimmed.EndsWith(']'))
        {
            trimmed = trimmed[1..^1];
        }

        return trimmed
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(s => s.Length > 0)
            .ToArray();
    }
}
