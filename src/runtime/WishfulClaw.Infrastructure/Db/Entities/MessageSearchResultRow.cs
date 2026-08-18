namespace WishfulClaw.Infrastructure.Db;

/// <summary>
/// A single message content search result with a snippet around the matched keyword.
/// </summary>
public sealed class MessageSearchResultRow
{
    public string MessageId { get; set; } = string.Empty;

    public string SessionId { get; set; } = string.Empty;

    public string SessionTitle { get; set; } = string.Empty;

    public string Snippet { get; set; } = string.Empty;

    public long CreatedAt { get; set; }
}

public sealed record MessageSearchResult(bool Success, List<MessageSearchResultRow> Results, string? Error);
