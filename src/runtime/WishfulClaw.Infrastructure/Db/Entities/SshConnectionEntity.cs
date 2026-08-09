
using System.Text.Json.Serialization;

namespace WishfulClaw.Infrastructure.Db;

// ─── SSH Connection Entity ───

public class SshConnectionEntity
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
}

// ─── SSH Connection DTO ───

public sealed class SshConnectionDbRow
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;
    [JsonPropertyName("group_id")]
    public string? GroupId { get; set; }
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
    [JsonPropertyName("host")]
    public string Host { get; set; } = string.Empty;
    [JsonPropertyName("port")]
    public int Port { get; set; } = 22;
    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;
    [JsonPropertyName("auth_type")]
    public string AuthType { get; set; } = "password";
    [JsonPropertyName("encrypted_password")]
    public string? EncryptedPassword { get; set; }
    [JsonPropertyName("private_key_path")]
    public string? PrivateKeyPath { get; set; }
    [JsonPropertyName("encrypted_passphrase")]
    public string? EncryptedPassphrase { get; set; }
    [JsonPropertyName("startup_command")]
    public string? StartupCommand { get; set; }
    [JsonPropertyName("default_directory")]
    public string? DefaultDirectory { get; set; }
    [JsonPropertyName("keep_alive_interval")]
    public int KeepAliveInterval { get; set; } = 60;
    [JsonPropertyName("sort_order")]
    public int SortOrder { get; set; }
    [JsonPropertyName("last_connected_at")]
    public long? LastConnectedAt { get; set; }
    [JsonPropertyName("created_at")]
    public long CreatedAt { get; set; }
    [JsonPropertyName("updated_at")]
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
