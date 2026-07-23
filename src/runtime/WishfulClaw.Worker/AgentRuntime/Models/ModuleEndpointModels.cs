namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Result types for AgentRuntime module endpoints (run/cancel/stop/append).
/// </summary>
internal sealed record AgentRuntimeRunResult(bool Started, string RunId);

internal sealed record AgentRuntimeCancelResult(bool Cancelled, string? RunId);

internal sealed record AgentRuntimeStopResult(bool Stopped, string? RunId);

internal sealed record AgentRuntimeAppendMessagesResult(bool Appended, string? RunId, int Count);
