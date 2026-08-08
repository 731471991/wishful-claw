using System.Text.Json;
using Microsoft.Data.Sqlite;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Infrastructure.Db;

namespace WishfulClaw.Infrastructure.Db;

public static class DbSshTools
{
    public static WorkerResponse List(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);
            var entities = db.Query(
                "SELECT * FROM ssh_connections ORDER BY sort_order ASC, updated_at DESC",
                EntityMappers.MapSshConnection);
            var rows = entities.Select(SshConnectionDbRow.FromEntity).ToList();
            return WorkerResponse.Json(rows);
        }
        catch (Exception ex) { WorkerLog.Error($"DbSshTools.List failed: {ex.Message}"); return WorkerResponse.Error(ex.Message); }
    }

    public static WorkerResponse Get(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);
            var id = parameters.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            if (string.IsNullOrEmpty(id))
                return WorkerResponse.Json(new SshConnectionFindResult(false, null, "id is required"));

            var entity = db.QueryFirstOrDefault(
                "SELECT * FROM ssh_connections WHERE id = @id", EntityMappers.MapSshConnection,
                new SqliteParameter("@id", id));
            var row = entity != null ? SshConnectionDbRow.FromEntity(entity) : null;
            return WorkerResponse.Json(new SshConnectionFindResult(true, row, null));
        }
        catch (Exception ex) { WorkerLog.Error($"DbSshTools.Get failed: {ex.Message}"); return WorkerResponse.Error(ex.Message); }
    }

    public static WorkerResponse Create(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);
            var entity = ParseCreateParameters(parameters);
            ExecuteInsertSsh(db, entity);
            return WorkerResponse.Json(new SshMutationResult(true, 1, null));
        }
        catch (Exception ex) { WorkerLog.Error($"DbSshTools.Create failed: {ex.Message}"); return WorkerResponse.Error(ex.Message); }
    }

    public static WorkerResponse Update(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);
            var id = parameters.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            if (string.IsNullOrEmpty(id))
                return WorkerResponse.Json(new SshMutationResult(false, 0, "id is required"));
            if (!parameters.TryGetProperty("patch", out var patchEl))
                return WorkerResponse.Json(new SshMutationResult(false, 0, "patch is required"));

            var entity = db.QueryFirstOrDefault(
                "SELECT * FROM ssh_connections WHERE id = @id", EntityMappers.MapSshConnection,
                new SqliteParameter("@id", id));
            if (entity == null)
                return WorkerResponse.Json(new SshMutationResult(false, 0, "Connection not found"));

            ApplyPatch(entity, patchEl);
            entity.UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            ExecuteUpdateSsh(db, entity);
            return WorkerResponse.Json(new SshMutationResult(true, 1, null));
        }
        catch (Exception ex) { WorkerLog.Error($"DbSshTools.Update failed: {ex.Message}"); return WorkerResponse.Error(ex.Message); }
    }

    public static WorkerResponse Delete(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);
            var id = parameters.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            if (string.IsNullOrEmpty(id))
                return WorkerResponse.Json(new SshMutationResult(false, 0, "id is required"));

            var changed = db.Execute("DELETE FROM ssh_connections WHERE id = @id", new SqliteParameter("@id", id));
            return WorkerResponse.Json(new SshMutationResult(true, changed, null));
        }
        catch (Exception ex) { WorkerLog.Error($"DbSshTools.Delete failed: {ex.Message}"); return WorkerResponse.Error(ex.Message); }
    }

    // ─── Helpers ───

    internal static void ExecuteInsertSsh(DbService db, SshConnectionEntity entity)
    {
        db.Execute(
            "INSERT INTO ssh_connections (id, group_id, name, host, port, username, auth_type, " +
            "encrypted_password, private_key_path, encrypted_passphrase, startup_command, " +
            "default_directory, keep_alive_interval, sort_order, last_connected_at, created_at, updated_at) " +
            "VALUES (@id, @gid, @name, @host, @port, @user, @auth, @ep, @pkp, @epa, @sc, @dd, @kai, @so, @lca, @ca, @ua)",
            new SqliteParameter("@id", entity.Id),
            new SqliteParameter("@gid", (object?)entity.GroupId ?? DBNull.Value),
            new SqliteParameter("@name", entity.Name),
            new SqliteParameter("@host", entity.Host),
            new SqliteParameter("@port", entity.Port),
            new SqliteParameter("@user", entity.Username),
            new SqliteParameter("@auth", entity.AuthType),
            new SqliteParameter("@ep", (object?)entity.EncryptedPassword ?? DBNull.Value),
            new SqliteParameter("@pkp", (object?)entity.PrivateKeyPath ?? DBNull.Value),
            new SqliteParameter("@epa", (object?)entity.EncryptedPassphrase ?? DBNull.Value),
            new SqliteParameter("@sc", (object?)entity.StartupCommand ?? DBNull.Value),
            new SqliteParameter("@dd", (object?)entity.DefaultDirectory ?? DBNull.Value),
            new SqliteParameter("@kai", entity.KeepAliveInterval),
            new SqliteParameter("@so", entity.SortOrder),
            new SqliteParameter("@lca", (object?)entity.LastConnectedAt ?? DBNull.Value),
            new SqliteParameter("@ca", entity.CreatedAt),
            new SqliteParameter("@ua", entity.UpdatedAt));
    }

    internal static void ExecuteUpdateSsh(DbService db, SshConnectionEntity entity)
    {
        db.Execute(
            "UPDATE ssh_connections SET group_id = @gid, name = @name, host = @host, port = @port, " +
            "username = @user, auth_type = @auth, encrypted_password = @ep, private_key_path = @pkp, " +
            "encrypted_passphrase = @epa, startup_command = @sc, default_directory = @dd, " +
            "keep_alive_interval = @kai, sort_order = @so, last_connected_at = @lca, updated_at = @ua WHERE id = @id",
            new SqliteParameter("@gid", (object?)entity.GroupId ?? DBNull.Value),
            new SqliteParameter("@name", entity.Name),
            new SqliteParameter("@host", entity.Host),
            new SqliteParameter("@port", entity.Port),
            new SqliteParameter("@user", entity.Username),
            new SqliteParameter("@auth", entity.AuthType),
            new SqliteParameter("@ep", (object?)entity.EncryptedPassword ?? DBNull.Value),
            new SqliteParameter("@pkp", (object?)entity.PrivateKeyPath ?? DBNull.Value),
            new SqliteParameter("@epa", (object?)entity.EncryptedPassphrase ?? DBNull.Value),
            new SqliteParameter("@sc", (object?)entity.StartupCommand ?? DBNull.Value),
            new SqliteParameter("@dd", (object?)entity.DefaultDirectory ?? DBNull.Value),
            new SqliteParameter("@kai", entity.KeepAliveInterval),
            new SqliteParameter("@so", entity.SortOrder),
            new SqliteParameter("@lca", (object?)entity.LastConnectedAt ?? DBNull.Value),
            new SqliteParameter("@ua", entity.UpdatedAt),
            new SqliteParameter("@id", entity.Id));
    }

    private static SshConnectionEntity ParseCreateParameters(JsonElement parameters)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var entity = new SshConnectionEntity
        {
            Id = JsonHelpers.GetString(parameters, "id") ?? Guid.NewGuid().ToString(),
            CreatedAt = now, UpdatedAt = now
        };
        if (parameters.TryGetProperty("groupId", out var groupEl) && groupEl.ValueKind == JsonValueKind.String)
            entity.GroupId = groupEl.GetString();
        entity.Name = JsonHelpers.GetString(parameters, "name") ?? "";
        entity.Host = JsonHelpers.GetString(parameters, "host") ?? "";
        entity.Username = JsonHelpers.GetString(parameters, "username") ?? "";
        entity.Port = parameters.TryGetProperty("port", out var portEl) && portEl.TryGetInt32(out var port) ? port : 22;
        entity.AuthType = JsonHelpers.GetString(parameters, "authType") ?? "password";
        entity.EncryptedPassword = JsonHelpers.GetString(parameters, "encryptedPassword");
        entity.PrivateKeyPath = JsonHelpers.GetString(parameters, "privateKeyPath");
        entity.EncryptedPassphrase = JsonHelpers.GetString(parameters, "encryptedPassphrase");
        entity.StartupCommand = JsonHelpers.GetString(parameters, "startupCommand");
        entity.DefaultDirectory = JsonHelpers.GetString(parameters, "defaultDirectory");
        entity.KeepAliveInterval = parameters.TryGetProperty("keepAliveInterval", out var kEl) && kEl.TryGetInt32(out var kai) ? kai : 60;
        if (parameters.TryGetProperty("sortOrder", out var sEl) && sEl.TryGetInt32(out var so))
            entity.SortOrder = so;
        return entity;
    }

    private static void ApplyPatch(SshConnectionEntity entity, JsonElement patch)
    {
        if (patch.TryGetProperty("groupId", out var groupEl))
            entity.GroupId = groupEl.ValueKind == JsonValueKind.String ? groupEl.GetString()
                : groupEl.ValueKind == JsonValueKind.Null ? null : entity.GroupId;
        if (patch.TryGetProperty("name", out var nameEl) && nameEl.ValueKind == JsonValueKind.String)
            entity.Name = nameEl.GetString() ?? entity.Name;
        if (patch.TryGetProperty("host", out var hostEl) && hostEl.ValueKind == JsonValueKind.String)
            entity.Host = hostEl.GetString() ?? entity.Host;
        if (patch.TryGetProperty("port", out var portEl) && portEl.TryGetInt32(out var port))
            entity.Port = port;
        if (patch.TryGetProperty("username", out var userEl) && userEl.ValueKind == JsonValueKind.String)
            entity.Username = userEl.GetString() ?? entity.Username;
        if (patch.TryGetProperty("authType", out var authEl) && authEl.ValueKind == JsonValueKind.String)
            entity.AuthType = authEl.GetString() ?? entity.AuthType;
        if (patch.TryGetProperty("encryptedPassword", out var pwEl))
            entity.EncryptedPassword = pwEl.ValueKind == JsonValueKind.String ? pwEl.GetString()
                : pwEl.ValueKind == JsonValueKind.Null ? null : entity.EncryptedPassword;
        if (patch.TryGetProperty("privateKeyPath", out var pkEl))
            entity.PrivateKeyPath = pkEl.ValueKind == JsonValueKind.String ? pkEl.GetString()
                : pkEl.ValueKind == JsonValueKind.Null ? null : entity.PrivateKeyPath;
        if (patch.TryGetProperty("encryptedPassphrase", out var ppEl))
            entity.EncryptedPassphrase = ppEl.ValueKind == JsonValueKind.String ? ppEl.GetString()
                : ppEl.ValueKind == JsonValueKind.Null ? null : entity.EncryptedPassphrase;
        if (patch.TryGetProperty("startupCommand", out var scEl))
            entity.StartupCommand = scEl.ValueKind == JsonValueKind.String ? scEl.GetString()
                : scEl.ValueKind == JsonValueKind.Null ? null : entity.StartupCommand;
        if (patch.TryGetProperty("defaultDirectory", out var ddEl))
            entity.DefaultDirectory = ddEl.ValueKind == JsonValueKind.String ? ddEl.GetString()
                : ddEl.ValueKind == JsonValueKind.Null ? null : entity.DefaultDirectory;
        if (patch.TryGetProperty("keepAliveInterval", out var kEl) && kEl.TryGetInt32(out var kai))
            entity.KeepAliveInterval = kai;
        if (patch.TryGetProperty("sortOrder", out var sEl) && sEl.TryGetInt32(out var so))
            entity.SortOrder = so;
        if (patch.TryGetProperty("lastConnectedAt", out var lEl))
            entity.LastConnectedAt = lEl.ValueKind == JsonValueKind.Number ? lEl.GetInt64()
                : lEl.ValueKind == JsonValueKind.Null ? null : entity.LastConnectedAt;
    }
}
