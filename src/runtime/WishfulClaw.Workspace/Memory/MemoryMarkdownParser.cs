using System.Text.RegularExpressions;

namespace WishfulClaw.Workspace.Memory;

/// <summary>
/// Parses MEMORY.md section structure. Each section starts with a ## heading.
/// Adapted from KodaClaw's MemoryMarkdownParser.
/// </summary>
public static class MemoryMarkdownParser
{
    private static readonly Regex SectionHeadingRegex = new(
        @"^##\s+(.+)$",
        RegexOptions.Compiled | RegexOptions.Multiline);

    // Regex to detect ## headings that are glued to preceding content on the same line,
    // e.g. "# Long-Term Memory## 兄弟身份" — the ## is not at the start of a line.
    // We insert a newline before such ## to normalize the content before parsing.
    // Negative lookbehind (?<!#) ensures we don't split ### (h3) headings.
    // Negative lookahead (?!#) ensures we don't match ## that is part of ### or deeper.
    private static readonly Regex GluedHeadingRegex = new(
        @"([^\r\n#])##(?!#)\s",
        RegexOptions.Compiled);

    /// <summary>
    /// Normalize MEMORY.md content to fix common formatting issues:
    /// - Insert a newline before ## headings that are glued to preceding content
    ///   (e.g. "# Long-Term Memory## Section" → "# Long-Term Memory\n## Section")
    /// This ensures the section regex can correctly detect all headings.
    /// </summary>
    public static string NormalizeContent(string content)
    {
        if (string.IsNullOrEmpty(content))
            return content;

        return GluedHeadingRegex.Replace(content, "$1\n## ");
    }

    /// <summary>
    /// Parse MEMORY.md into a list of (title, body) sections.
    /// Each section starts with a ## heading.
    /// </summary>
    public static IReadOnlyList<MemorySection> ParseSections(string content)
    {
        content = NormalizeContent(content);

        var sections = new List<MemorySection>();
        var matches = SectionHeadingRegex.Matches(content);

        for (var i = 0; i < matches.Count; i++)
        {
            var match = matches[i];
            var title = match.Groups[1].Value.Trim();
            var bodyStart = match.Index + match.Length;
            var bodyEnd = i + 1 < matches.Count
                ? matches[i + 1].Index
                : content.Length;

            var body = content[bodyStart..bodyEnd].Trim();
            if (!string.IsNullOrWhiteSpace(title))
            {
                sections.Add(new MemorySection { Title = title, Body = body });
            }
        }

        return sections;
    }

    /// <summary>
    /// Find a section by title (case-insensitive).
    /// </summary>
    public static MemorySection? FindSection(string content, string title)
    {
        var sections = ParseSections(content);
        return sections.FirstOrDefault(s =>
            string.Equals(s.Title, title, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Replace or insert a section in MEMORY.md content.
    /// If the section exists, replace its body in place (no delete+recreate).
    /// Otherwise append a new section at the end.
    /// </summary>
    public static string UpsertSection(string content, string title, string body)
    {
        content = NormalizeContent(content);

        var matches = SectionHeadingRegex.Matches(content);
        var sectionIndex = -1;

        for (var i = 0; i < matches.Count; i++)
        {
            if (string.Equals(matches[i].Groups[1].Value.Trim(), title, StringComparison.OrdinalIgnoreCase))
            {
                sectionIndex = i;
                break;
            }
        }

        if (sectionIndex >= 0)
        {
            // Replace existing section body in place
            var match = matches[sectionIndex];
            var bodyStart = match.Index + match.Length;
            var bodyEnd = sectionIndex + 1 < matches.Count
                ? matches[sectionIndex + 1].Index
                : content.Length;

            return content[..bodyStart] + "\n" + body.Trim() + "\n" + content[bodyEnd..];
        }

        // Append new section
        var newSection = $"\n\n## {title}\n{body.Trim()}\n";
        return content.TrimEnd() + newSection;
    }

    /// <summary>
    /// Delete a section from MEMORY.md content by title.
    /// Returns the original content (normalized) if the section is not found.
    /// </summary>
    public static string DeleteSection(string content, string title)
    {
        content = NormalizeContent(content);

        var matches = SectionHeadingRegex.Matches(content);
        for (var i = 0; i < matches.Count; i++)
        {
            if (string.Equals(matches[i].Groups[1].Value.Trim(), title, StringComparison.OrdinalIgnoreCase))
            {
                var start = matches[i].Index;
                var end = i + 1 < matches.Count
                    ? matches[i + 1].Index
                    : content.Length;
                // Also remove preceding newlines
                while (start > 0 && (content[start - 1] == '\n' || content[start - 1] == '\r'))
                    start--;
                return content[..start] + content[end..];
            }
        }
        return content;
    }

    /// <summary>
    /// Normalize a section title to a key suitable for file naming or lookup.
    /// Lowercases, replaces spaces with hyphens, removes special chars, preserves CJK.
    /// </summary>
    public static string NormalizeKey(string title)
    {
        var key = title.ToLowerInvariant().Trim();
        key = Regex.Replace(key, @"\s+", "-");
        key = Regex.Replace(key, @"[^\w\u4e00-\u9fff\u3400-\u4dbf-]", "");
        key = Regex.Replace(key, @"-{2,}", "-");
        return key.Trim('-');
    }
}
