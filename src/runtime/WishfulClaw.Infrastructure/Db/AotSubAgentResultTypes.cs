using System.Text.Json;

namespace WishfulClaw.Infrastructure.Db;

/// <summary>
/// SubAgent result types for AOT-safe serialization.
/// </summary>
public sealed record SubAgentFindResult(bool Found, JsonElement? Data = null);
public sealed record SubAgentIndexResult(int Total, List<SubAgentSessionSummary> Sessions);
public sealed record SubAgentSessionSummary(string SessionId, int Count, long LatestStartedAt);
public sealed record SubAgentSimpleResult(bool Ok);
