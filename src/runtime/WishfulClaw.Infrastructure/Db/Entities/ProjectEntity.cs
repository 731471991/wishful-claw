using SqlSugar;

namespace WishfulClaw.Infrastructure.Db;

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

// ─── Project DTO ───

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

// ─── Project Result Records ───

public sealed record ProjectFindResult(bool Success, ProjectRow? Project, string? Error);
public sealed record ProjectDeleteResult(bool Success, bool Deleted, string? ProjectId, List<string> SessionIds, string? Error);
