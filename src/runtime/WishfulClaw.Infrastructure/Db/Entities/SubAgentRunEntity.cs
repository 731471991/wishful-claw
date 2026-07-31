using SqlSugar;

namespace WishfulClaw.Infrastructure.Db;

/// <summary>
/// Persisted sub-agent run record.
/// The full SubAgentState (toolCalls, transcript, report, usage, etc.) is stored
/// as JSON in the Data column, indexed by session_id for fast session-scoped retrieval.
/// </summary>
[SugarTable("sub_agent_runs")]
public class SubAgentRunEntity
{
    [SugarColumn(IsPrimaryKey = true, ColumnName = "tool_use_id")]
    public string ToolUseId { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "session_id")]
    public string SessionId { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "agent_name")]
    public string AgentName { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "data")]
    public string Data { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "started_at")]
    public long StartedAt { get; set; }

    [SugarColumn(ColumnName = "completed_at", IsNullable = true)]
    public long? CompletedAt { get; set; }

    [SugarColumn(ColumnName = "success", IsNullable = true)]
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
