using SqlSugar;

namespace WishfulClaw.Worker.Modules.Db;

// ─── SSH Connection Entity ───

[SugarTable("ssh_connections")]
public class SshConnectionEntity
{
    [SugarColumn(IsPrimaryKey = true, ColumnName = "id")]
    public string Id { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "group_id", IsNullable = true)]
    public string? GroupId { get; set; }

    [SugarColumn(ColumnName = "name")]
    public string Name { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "host")]
    public string Host { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "port")]
    public int Port { get; set; } = 22;

    [SugarColumn(ColumnName = "username")]
    public string Username { get; set; } = string.Empty;

    [SugarColumn(ColumnName = "auth_type")]
    public string AuthType { get; set; } = "password";

    [SugarColumn(ColumnName = "encrypted_password", IsNullable = true)]
    public string? EncryptedPassword { get; set; }

    [SugarColumn(ColumnName = "private_key_path", IsNullable = true)]
    public string? PrivateKeyPath { get; set; }

    [SugarColumn(ColumnName = "encrypted_passphrase", IsNullable = true)]
    public string? EncryptedPassphrase { get; set; }

    [SugarColumn(ColumnName = "startup_command", IsNullable = true)]
    public string? StartupCommand { get; set; }

    [SugarColumn(ColumnName = "default_directory", IsNullable = true)]
    public string? DefaultDirectory { get; set; }

    [SugarColumn(ColumnName = "keep_alive_interval")]
    public int KeepAliveInterval { get; set; } = 60;

    [SugarColumn(ColumnName = "sort_order")]
    public int SortOrder { get; set; }

    [SugarColumn(ColumnName = "last_connected_at", IsNullable = true)]
    public long? LastConnectedAt { get; set; }

    [SugarColumn(ColumnName = "created_at")]
    public long CreatedAt { get; set; }

    [SugarColumn(ColumnName = "updated_at")]
    public long UpdatedAt { get; set; }
}

// ─── SSH Connection DTO ───

public sealed class SshConnectionDbRow
{
    public string Id { get; set; } = string.Empty;
    public string? GroupId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 22;
    public string Username { get; set; } = string.Empty;
    public string AuthType { get; set; } = "password";
    public string? EncryptedPassword { get; set; }
    public string? PrivateKeyPath { get; set; }
    public string? EncryptedPassphrase { get; set; }
    public string? StartupCommand { get; set; }
    public string? DefaultDirectory { get; set; }
    public int KeepAliveInterval { get; set; } = 60;
    public int SortOrder { get; set; }
    public long? LastConnectedAt { get; set; }
    public long CreatedAt { get; set; }
    public long UpdatedAt { get; set; }

    public static SshConnectionDbRow FromEntity(SshConnectionEntity e) => new()
    {
        Id = e.Id,
        GroupId = e.GroupId,
        Name = e.Name,
        Host = e.Host,
        Port = e.Port,
        Username = e.Username,
        AuthType = e.AuthType,
        EncryptedPassword = e.EncryptedPassword,
        PrivateKeyPath = e.PrivateKeyPath,
        EncryptedPassphrase = e.EncryptedPassphrase,
        StartupCommand = e.StartupCommand,
        DefaultDirectory = e.DefaultDirectory,
        KeepAliveInterval = e.KeepAliveInterval,
        SortOrder = e.SortOrder,
        LastConnectedAt = e.LastConnectedAt,
        CreatedAt = e.CreatedAt,
        UpdatedAt = e.UpdatedAt
    };
}

// ─── Result Records ───

public sealed record SshConnectionFindResult(bool Success, SshConnectionDbRow? Connection, string? Error);
public sealed record SshMutationResult(bool Success, int Changed, string? Error);
