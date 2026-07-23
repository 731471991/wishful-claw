using SqlSugar;

namespace WishfulClaw.Worker.Modules.Db;

// ─── Project Entity ───

[SugarTable("projects")]
public class ProjectEntity
{
    [SugarColumn(IsPrimaryKey = true, ColumnName = "id")]
    public string Id { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "name")]
    public string Name { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "working_folder", IsNullable = true)]
    public string? WorkingFolder { get; set; }

    [SugarColumn(ColumnName = "ssh_connection_id", IsNullable = true)]
    public string? SshConnectionId { get; set; }

    [SugarColumn(ColumnName = "plugin_id", IsNullable = true)]
    public string? PluginId { get; set; }

    [SugarColumn(ColumnName = "pinned")]
    public int Pinned { get; set; }

    [SugarColumn(ColumnName = "created_at")]
    public long CreatedAt { get; set; }

    [SugarColumn(ColumnName = "updated_at")]
    public long UpdatedAt { get; set; }
}

// ─── Session Entity ───

[SugarTable("sessions")]
public class SessionEntity
{
    [SugarColumn(IsPrimaryKey = true, ColumnName = "id")]
    public string Id { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "title")]
    public string Title { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "icon", IsNullable = true)]
    public string? Icon { get; set; }

    [SugarColumn(ColumnName = "mode")]
    public string Mode { get; set; } = "chat";

    [SugarColumn(ColumnName = "created_at")]
    public long CreatedAt { get; set; }

    [SugarColumn(ColumnName = "updated_at")]
    public long UpdatedAt { get; set; }

    [SugarColumn(ColumnName = "message_count")]
    public int MessageCount { get; set; }

    [SugarColumn(ColumnName = "project_id", IsNullable = true)]
    public string? ProjectId { get; set; }

    [SugarColumn(ColumnName = "working_folder", IsNullable = true)]
    public string? WorkingFolder { get; set; }

    [SugarColumn(ColumnName = "ssh_connection_id", IsNullable = true)]
    public string? SshConnectionId { get; set; }

    [SugarColumn(ColumnName = "plan_id", IsNullable = true)]
    public string? PlanId { get; set; }

    [SugarColumn(ColumnName = "pinned")]
    public int Pinned { get; set; }

    [SugarColumn(ColumnName = "plugin_id", IsNullable = true)]
    public string? PluginId { get; set; }

    [SugarColumn(ColumnName = "external_chat_id", IsNullable = true)]
    public string? ExternalChatId { get; set; }

    [SugarColumn(ColumnName = "provider_id", IsNullable = true)]
    public string? ProviderId { get; set; }

    [SugarColumn(ColumnName = "model_id", IsNullable = true)]
    public string? ModelId { get; set; }

    [SugarColumn(ColumnName = "model_selection_mode")]
    public string ModelSelectionMode { get; set; } = "inherit";
}

// ─── Message Entity ───

[SugarTable("messages")]
public class MessageEntity
{
    [SugarColumn(IsPrimaryKey = true, ColumnName = "id")]
    public string Id { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "session_id")]
    public string SessionId { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "role")]
    public string Role { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "content")]
    public string Content { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "meta", IsNullable = true)]
    public string? Meta { get; set; }

    [SugarColumn(ColumnName = "created_at")]
    public long CreatedAt { get; set; }

    [SugarColumn(ColumnName = "usage", IsNullable = true)]
    public string? Usage { get; set; }

    [SugarColumn(ColumnName = "sort_order")]
    public int SortOrder { get; set; }
}

// ─── DTOs (JSON-friendly, camelCase for IPC) ───

public sealed class ProjectRow
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? WorkingFolder { get; set; }
    public string? SshConnectionId { get; set; }
    public string? PluginId { get; set; }
    public bool Pinned { get; set; }
    public long CreatedAt { get; set; }
    public long UpdatedAt { get; set; }
    public int SessionCount { get; set; }

    public static ProjectRow FromEntity(ProjectEntity e, int sessionCount = 0) => new()
    {
        Id = e.Id,
        Name = e.Name,
        WorkingFolder = e.WorkingFolder,
        SshConnectionId = e.SshConnectionId,
        PluginId = e.PluginId,
        Pinned = e.Pinned != 0,
        CreatedAt = e.CreatedAt,
        UpdatedAt = e.UpdatedAt,
        SessionCount = sessionCount
    };
}

public sealed class SessionRow
{
    public string Id { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Icon { get; set; }
    public string Mode { get; set; } = "chat";
    public long CreatedAt { get; set; }
    public long UpdatedAt { get; set; }
    public int MessageCount { get; set; }
    public string? ProjectId { get; set; }
    public string? WorkingFolder { get; set; }
    public string? SshConnectionId { get; set; }
    public string? PlanId { get; set; }
    public bool Pinned { get; set; }
    public string? PluginId { get; set; }
    public string? ExternalChatId { get; set; }
    public string? ProviderId { get; set; }
    public string? ModelId { get; set; }
    public string? ModelSelectionMode { get; set; }

    public static SessionRow FromEntity(SessionEntity e) => new()
    {
        Id = e.Id,
        Title = e.Title,
        Icon = e.Icon,
        Mode = e.Mode,
        CreatedAt = e.CreatedAt,
        UpdatedAt = e.UpdatedAt,
        MessageCount = e.MessageCount,
        ProjectId = e.ProjectId,
        WorkingFolder = e.WorkingFolder,
        SshConnectionId = e.SshConnectionId,
        PlanId = e.PlanId,
        Pinned = e.Pinned != 0,
        PluginId = e.PluginId,
        ExternalChatId = e.ExternalChatId,
        ProviderId = e.ProviderId,
        ModelId = e.ModelId,
        ModelSelectionMode = e.ModelSelectionMode
    };
}

public sealed class MessageRow
{
    public string Id { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? Meta { get; set; }
    public long CreatedAt { get; set; }
    public string? Usage { get; set; }
    public int SortOrder { get; set; }

    public static MessageRow FromEntity(MessageEntity e) => new()
    {
        Id = e.Id,
        SessionId = e.SessionId,
        Role = e.Role,
        Content = e.Content,
        Meta = e.Meta,
        CreatedAt = e.CreatedAt,
        Usage = e.Usage,
        SortOrder = e.SortOrder
    };
}

// ─── Result Records ───

public sealed record ProjectFindResult(bool Success, ProjectRow? Project, string? Error);
public sealed record ProjectDeleteResult(bool Success, bool Deleted, string? ProjectId, List<string> SessionIds, string? Error);
public sealed record SessionFindResult(bool Success, SessionRow? Session, string? Error);
public sealed record SessionMutationResult(bool Success, int Changed, string? Error);
public sealed record SessionClearAllResult(bool Success, List<string> SessionIds, int DeletedMessages, int DeletedSessions, string? Error);
public sealed record MessageMutationResult(bool Success, int Changed, string? Error);
public sealed record MessageDeleteResult(bool Success, bool Deleted, string? Error);
public sealed record MessageCountResult(bool Success, int Count, string? Error);
public sealed record MessageDeleteLastResult(bool Success, MessageRow? Message, string? Error);
public sealed record DbInitializeResult(bool Success, string DbPath, string? Error);
