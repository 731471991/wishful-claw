using System.Text.Json;

namespace WishfulClaw.Agent;

/// <summary>
/// Tool use block (streamed tool call start).
/// </summary>
public sealed record AgentRuntimeToolUseBlock(
    string Id,
    string Name,
    JsonElement Input,
    JsonElement? ExtraContent = null);

/// <summary>
/// Tool result returned from tool execution.
/// </summary>
public sealed record AgentRuntimeToolResult(
    string ToolUseId,
    JsonElement Content,
    bool? IsError = null);

/// <summary>
/// Tool call state (reserved for iteration 4 — tool execution).
/// </summary>
public sealed record AgentRuntimeToolCallState(
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
public sealed record AgentRuntimeNativeToolCall(
    string Id,
    string Name,
    JsonElement Input,
    JsonElement? ExtraContent = null);

/// <summary>
/// Tool use as stored in conversation history (assistant message).
/// </summary>
public sealed record AgentRuntimeChatToolUse(
    string Id,
    string Name,
    JsonElement Input,
    JsonElement? ExtraContent = null);
