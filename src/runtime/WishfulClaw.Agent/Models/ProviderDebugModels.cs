using System.Text.Json;

namespace WishfulClaw.Agent;

/// <summary>
/// Debug info emitted as request_debug event.
/// </summary>
public sealed record AgentRuntimeRequestDebugInfo(
    string Url,
    string Method,
    IReadOnlyDictionary<string, string> Headers,
    string? Body,
    long Timestamp,
    string? ProviderId = null,
    string? ProviderBuiltinId = null,
    string? Model = null,
    string ExecutionPath = "sidecar",
    string Transport = "http",
    string? BodyRef = null,
    long? BodyBytes = null);

/// <summary>
/// Token usage reported by the provider.
/// </summary>
public sealed record AgentRuntimeTokenUsage(
    int InputTokens,
    int OutputTokens,
    int? BillableInputTokens = null,
    int? CacheReadTokens = null,
    int? ReasoningTokens = null,
    int? ContextTokens = null,
    int? CacheCreationTokens = null,
    int? CacheCreation5mTokens = null,
    int? CacheCreation1hTokens = null,
    double? CacheReadRatio = null,
    // Session-cumulative cache tokens (filled by AgentLoop before emitting message_end)
    int? SessionCacheHitTokens = null,
    int? SessionCacheMissTokens = null,
    // Source of this usage: "executor", "subagent", "compaction", etc.
    string? UsageSource = null);

/// <summary>
/// Request timing metrics.
/// </summary>
public sealed record AgentRuntimeRequestTiming(
    long TotalMs,
    long? TtftMs = null,
    double? Tps = null);
