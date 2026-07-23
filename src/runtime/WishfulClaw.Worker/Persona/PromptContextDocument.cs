namespace WishfulClaw.Worker.Persona;

/// <summary>
/// A context document injected into the system prompt as raw Markdown.
/// Mirrors KodaClaw's PromptContextDocument pattern.
/// </summary>
public sealed record PromptContextDocument(
    string Label,
    string Content)
{
    /// <summary>
    /// Renders the document with a header for the system prompt.
    /// </summary>
    public string Render()
    {
        if (string.IsNullOrWhiteSpace(Content))
            return string.Empty;

        return $"""
```md:title={Label}
{Content.Trim()}
```
""";
    }
}
