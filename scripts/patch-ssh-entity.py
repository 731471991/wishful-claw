"""Fix SshConnectionDbRow to use snake_case JSON property names matching frontend expectations"""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\runtime\WishfulClaw.Infrastructure\Db\Entities\SshConnectionEntity.cs")
text = p.read_text(encoding="utf-8-sig")

# Add using
text = text.replace(
    "using SqlSugar;\r\n\r\nnamespace",
    "using SqlSugar;\r\nusing System.Text.Json.Serialization;\r\n\r\nnamespace"
) if "\r\n" in text else text.replace(
    "using SqlSugar;\n\nnamespace",
    "using SqlSugar;\nusing System.Text.Json.Serialization;\n\nnamespace"
)

# Replace the SshConnectionDbRow class with one that has [JsonPropertyName] attributes
old_row = """public sealed class SshConnectionDbRow
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
    public long UpdatedAt { get; set; }"""

new_row = """public sealed class SshConnectionDbRow
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
    public long UpdatedAt { get; set; }"""

# Handle both LF and CRLF
old_crlf = old_row.replace("\n", "\r\n")
new_crlf = new_row.replace("\n", "\r\n")

if old_row in text:
    text = text.replace(old_row, new_row)
    print("OK (LF)")
elif old_crlf in text:
    text = text.replace(old_crlf, new_crlf)
    print("OK (CRLF)")
else:
    print("NOT FOUND")
    import sys
    sys.exit(1)

p.write_text(text, encoding="utf-8-sig")
print("File written")
