using System.Text.Json;

namespace WishfulClaw.Worker.AgentRuntime;

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
/// Native tool call returned by a provider (LLM-generated).
/// </summary>
internal sealed record AgentRuntimeNativeToolCall(
    string Id,
    string Name,
    JsonElement Input,
    JsonElement? ExtraContent = null);

/// <summary>
/// Tool use as stored in conversation history (assistant message).
/// </summary>
internal sealed record AgentRuntimeChatToolUse(
    string Id,
    string Name,
    JsonElement Input,
    JsonElement? ExtraContent = null);
