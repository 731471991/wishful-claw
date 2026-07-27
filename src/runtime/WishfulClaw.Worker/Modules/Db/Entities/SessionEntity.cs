using SqlSugar;

namespace WishfulClaw.Worker.Modules.Db;

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

    [SugarColumn(ColumnName = "persona_id", IsNullable = true)]
    public string? PersonaId { get; set; }
}

// ─── Session DTO ───

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
    public string? PersonaId { get; set; }

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
        ModelSelectionMode = e.ModelSelectionMode,
        PersonaId = e.PersonaId
    };
}

// ─── Session Result Records ───

public sealed record SessionFindResult(bool Success, SessionRow? Session, string? Error);
public sealed record SessionMutationResult(bool Success, int Changed, string? Error);
public sealed record SessionClearAllResult(bool Success, List<string> SessionIds, int DeletedMessages, int DeletedSessions, string? Error);
public sealed record SessionResetResult(bool Success, int DeletedMessages, long UpdatedAt, string? Error);
public sealed record SessionStatusResult(bool Success, bool Found, string? Title, long? CreatedAt, long? UpdatedAt, int MessageCount, string? Error);
