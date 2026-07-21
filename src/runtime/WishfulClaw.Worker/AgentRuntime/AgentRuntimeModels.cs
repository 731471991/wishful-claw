using System.Text.Json;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Stream envelope sent to the renderer via MessagePack.
/// </summary>
internal sealed record AgentRuntimeStreamEnvelope(
    int V,
    string RunId,
    string SessionId,
    long Seq,
    AgentRuntimeStreamEvent[] Events);

/// <summary>
/// Flat event record. Field names are camelCase to match the frontend codec.
/// Only fields relevant to iteration 3 are included; additional fields can be
/// added later without breaking the protocol (the MessagePack encoder skips nulls).
/// </summary>
internal sealed record AgentRuntimeStreamEvent(
    string Type,
    int? Iteration = null,
    string? Reason = null,
    string? StopReason = null,
    string? Text = null,
    string? Thinking = null,
    string? Message = null,
    string? Content = null,
    string? Provider = null,
    string? ErrorType = null,
    string? Details = null,
    string? StackTrace = null,
    string? ToolCallId = null,
    string? ToolName = null,
    JsonElement? PartialInput = null,
    AgentRuntimeToolUseBlock? ToolUseBlock = null,
    AgentRuntimeToolCallState? ToolCall = null,
    AgentRuntimeToolResult[]? ToolResults = null,
    AgentRuntimeRequestDebugInfo? DebugInfo = null,
    AgentRuntimeTokenUsage? Usage = null,
    AgentRuntimeRequestTiming? Timing = null,
    string? ProviderResponseId = null,
    int? OriginalCount = null,
    int? NewCount = null,
    int? KeptMessageCount = null,
    JsonElement[]? Messages = null,
    JsonElement[]? CompactArtifacts = null,
    string? ToolUseId = null);

/// <summary>
/// Tool use block (streamed tool call start).
/// </summary>
internal sealed record AgentRuntimeToolUseBlock(
    string Id,
    string Name,
    JsonElement Input,
    JsonElement? ExtraContent = null);

/// <summary>
/// Tool result returned from tool execution.
/// </summary>
internal sealed record AgentRuntimeToolResult(
    string ToolUseId,
    JsonElement Content,
    bool? IsError = null);

/// <summary>
/// Tool call state (reserved for iteration 4 — tool execution).
/// </summary>
internal sealed record AgentRuntimeToolCallState(
    string Id,
    string Name,
    JsonElement Input,
    string Status,
    JsonElement? Output = null,
    string? Error = null,
    bool RequiresApproval = false,
    long? StartedAt = null,
    long? CompletedAt = null);

/// <summary>
/// Debug info emitted as request_debug event.
/// </summary>
internal sealed record AgentRuntimeRequestDebugInfo(
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
internal sealed record AgentRuntimeTokenUsage(
    int InputTokens,
    int OutputTokens,
    int? BillableInputTokens = null,
    int? CacheReadTokens = null,
    int? ReasoningTokens = null,
    int? ContextTokens = null,
    int? CacheCreationTokens = null,
    int? CacheCreation5mTokens = null,
    int? CacheCreation1hTokens = null,
    double? CacheReadRatio = null);

/// <summary>
/// Request timing metrics.
/// </summary>
internal sealed record AgentRuntimeRequestTiming(
    long TotalMs,
    long? TtftMs = null,
    double? Tps = null);

// ── Provider turn models ──

internal sealed record AgentRuntimeProviderTurnResult(
    AgentRuntimeChatMessage AssistantMessage,
    List<AgentRuntimeNativeToolCall> ToolCalls,
    string StopReason,
    AgentRuntimeTokenUsage? Usage = null);

internal sealed record AgentRuntimeNativeToolCall(
    string Id,
    string Name,
    JsonElement Input,
    JsonElement? ExtraContent = null);

internal sealed record AgentRuntimeChatToolUse(
    string Id,
    string Name,
    JsonElement Input,
    JsonElement? ExtraContent = null);

internal sealed record AgentRuntimeChatMessage(
    string Role,
    string Text,
    List<AgentRuntimeChatToolUse> ToolUses,
    List<AgentRuntimeToolResult> ToolResults,
    string? ProviderResponseId = null,
    List<JsonElement>? ContentBlocks = null)
{
    public static AgentRuntimeChatMessage UserToolResults(List<AgentRuntimeToolResult> toolResults)
    {
        return new AgentRuntimeChatMessage("user", string.Empty, [], toolResults);
    }
}

// ── Module endpoint result types ──

internal sealed record AgentRuntimeRunResult(bool Started, string RunId);

internal sealed record AgentRuntimeCancelResult(bool Cancelled, string? RunId);

internal sealed record AgentRuntimeStopResult(bool Stopped, string? RunId);

internal sealed record AgentRuntimeAppendMessagesResult(bool Appended, string? RunId, int Count);
