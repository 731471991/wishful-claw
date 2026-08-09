namespace WishfulClaw.Agent;

// AOT-safe record types for AgentRuntimeProjectExecutor results.
// All properties use PascalCase; JsonOptions with CamelCase naming policy
// serializes them as camelCase to match previous anonymous-type behavior.

public record ProjectListRow(
    string Id,
    string Name,
    string? WorkingFolder,
    int SessionCount,
    int ActiveSessionCount);

public record ProjectListResult(
    List<ProjectListRow> Projects,
    int Total);

public record SessionListRow(
    string Id,
    string Title,
    string Mode,
    int MessageCount,
    long CreatedAt,
    long UpdatedAt);

public record ProjectDetailResult(
    string Id,
    string Name,
    string? WorkingFolder,
    List<SessionListRow> Sessions,
    string TaskStatus,
    bool HasTaskStatus,
    bool StatusFileNeedsUpdate,
    string StatusUpdateTemplate,
    string SuggestedSessionId);

public record CreateSessionResult(
    string SessionId,
    string Title,
    string? ProjectId,
    long CreatedAt);
