
namespace WishfulClaw.Infrastructure.Db;

/// <summary>
/// Persisted sub-agent run record.
/// The full SubAgentState (toolCalls, transcript, report, usage, etc.) is stored
/// as JSON in the Data column, indexed by session_id for fast session-scoped retrieval.
/// </summary>
public class SubAgentRunEntity
{
    public string ToolUseId { get; set; } = string.Empty;

    public string SessionId { get; set; } = string.Empty;

    public string AgentName { get; set; } = string.Empty;

    public string Data { get; set; } = string.Empty;

    public long StartedAt { get; set; }

    public long? CompletedAt { get; set; }

    public int? Success { get; set; }
}

public sealed record SubAgentRunRow(
    string ToolUseId,
    string SessionId,
    string AgentName,
    string Data,
    long StartedAt,
    long? CompletedAt,
    bool? Success)
{
    public static SubAgentRunRow FromEntity(SubAgentRunEntity e) => new(
    e.ToolUseId,
    e.SessionId,
    e.AgentName,
    e.Data,
    e.StartedAt,
    e.CompletedAt,
    e.Success.HasValue ? e.Success.Value != 0 : null);
}
