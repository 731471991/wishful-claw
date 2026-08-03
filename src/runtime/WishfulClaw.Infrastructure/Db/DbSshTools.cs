using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Infrastructure.Db;

namespace WishfulClaw.Infrastructure.Db;

public static class DbSshTools
{
    // ─── List ───

    public static WorkerResponse List(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var entities = db.Queryable<SshConnectionEntity>()
                .OrderBy("sort_order ASC")
                .OrderBy("updated_at DESC")
                .ToList();

            var rows = entities.Select(SshConnectionDbRow.FromEntity).ToList();
            return WorkerResponse.Json(rows);
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbSshTools.List failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Get ───

    public static WorkerResponse Get(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var id = parameters.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            if (string.IsNullOrEmpty(id))
                return WorkerResponse.Json(new SshConnectionFindResult(false, null, "id is required"));

            var entity = db.Queryable<SshConnectionEntity>()
                .Where(e => e.Id == id)
                .First();

            var row = entity != null ? SshConnectionDbRow.FromEntity(entity) : null;
            return WorkerResponse.Json(new SshConnectionFindResult(true, row, null));
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbSshTools.Get failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Create ───

    public static WorkerResponse Create(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var entity = ParseCreateParameters(parameters);
            db.Insertable(entity).ExecuteCommand();

            return WorkerResponse.Json(new SshMutationResult(true, 1, null));
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbSshTools.Create failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Update ───

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

            var entity = db.Queryable<SshConnectionEntity>()
                .Where(e => e.Id == id)
                .First();

            if (entity == null)
                return WorkerResponse.Json(new SshMutationResult(false, 0, "Connection not found"));

            ApplyPatch(entity, patchEl);
            entity.UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

            db.Updateable(entity).ExecuteCommand();

            return WorkerResponse.Json(new SshMutationResult(true, 1, null));
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbSshTools.Update failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Delete ───

    public static WorkerResponse Delete(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);

            var id = parameters.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
            if (string.IsNullOrEmpty(id))
                return WorkerResponse.Json(new SshMutationResult(false, 0, "id is required"));

            var changed = db.Deleteable<SshConnectionEntity>()
                .Where(e => e.Id == id)
                .ExecuteCommand();

            return WorkerResponse.Json(new SshMutationResult(true, changed, null));
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbSshTools.Delete failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Helpers ───

    private static SshConnectionEntity ParseCreateParameters(JsonElement parameters)
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        var entity = new SshConnectionEntity
        {
            Id = JsonHelpers.GetString(parameters, "id") ?? Guid.NewGuid().ToString(),
            CreatedAt = now,
            UpdatedAt = now
        };

        if (parameters.TryGetProperty("groupId", out var groupEl) && groupEl.ValueKind == JsonValueKind.String)
            entity.GroupId = groupEl.GetString();

        entity.Name = JsonHelpers.GetString(parameters, "name") ?? "";
        entity.Host = JsonHelpers.GetString(parameters, "host") ?? "";
        entity.Username = JsonHelpers.GetString(parameters, "username") ?? "";

        if (parameters.TryGetProperty("port", out var portEl) && portEl.TryGetInt32(out var port))
            entity.Port = port;
        else
            entity.Port = 22;

        entity.AuthType = JsonHelpers.GetString(parameters, "authType") ?? "password";
        entity.EncryptedPassword = JsonHelpers.GetString(parameters, "encryptedPassword");
        entity.PrivateKeyPath = JsonHelpers.GetString(parameters, "privateKeyPath");
        entity.EncryptedPassphrase = JsonHelpers.GetString(parameters, "encryptedPassphrase");
        entity.StartupCommand = JsonHelpers.GetString(parameters, "startupCommand");
        entity.DefaultDirectory = JsonHelpers.GetString(parameters, "defaultDirectory");

        if (parameters.TryGetProperty("keepAliveInterval", out var kEl) && kEl.TryGetInt32(out var kai))
            entity.KeepAliveInterval = kai;
        else
            entity.KeepAliveInterval = 60;

        if (parameters.TryGetProperty("sortOrder", out var sEl) && sEl.TryGetInt32(out var so))
            entity.SortOrder = so;

        return entity;
    }

    private static void ApplyPatch(SshConnectionEntity entity, JsonElement patch)
    {
        if (patch.TryGetProperty("groupId", out var groupEl))
        {
            entity.GroupId = groupEl.ValueKind == JsonValueKind.String
                ? groupEl.GetString()
                : groupEl.ValueKind == JsonValueKind.Null
                    ? null
                    : entity.GroupId;
        }

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
            entity.EncryptedPassword = pwEl.ValueKind == JsonValueKind.String
                ? pwEl.GetString()
                : pwEl.ValueKind == JsonValueKind.Null
                    ? null
                    : entity.EncryptedPassword;

        if (patch.TryGetProperty("privateKeyPath", out var pkEl))
            entity.PrivateKeyPath = pkEl.ValueKind == JsonValueKind.String
                ? pkEl.GetString()
                : pkEl.ValueKind == JsonValueKind.Null
                    ? null
                    : entity.PrivateKeyPath;

        if (patch.TryGetProperty("encryptedPassphrase", out var ppEl))
            entity.EncryptedPassphrase = ppEl.ValueKind == JsonValueKind.String
                ? ppEl.GetString()
                : ppEl.ValueKind == JsonValueKind.Null
                    ? null
                    : entity.EncryptedPassphrase;

        if (patch.TryGetProperty("startupCommand", out var scEl))
            entity.StartupCommand = scEl.ValueKind == JsonValueKind.String
                ? scEl.GetString()
                : scEl.ValueKind == JsonValueKind.Null
                    ? null
                    : entity.StartupCommand;

        if (patch.TryGetProperty("defaultDirectory", out var ddEl))
            entity.DefaultDirectory = ddEl.ValueKind == JsonValueKind.String
                ? ddEl.GetString()
                : ddEl.ValueKind == JsonValueKind.Null
                    ? null
                    : entity.DefaultDirectory;

        if (patch.TryGetProperty("keepAliveInterval", out var kEl) && kEl.TryGetInt32(out var kai))
            entity.KeepAliveInterval = kai;

        if (patch.TryGetProperty("sortOrder", out var sEl) && sEl.TryGetInt32(out var so))
            entity.SortOrder = so;

        if (patch.TryGetProperty("lastConnectedAt", out var lEl))
            entity.LastConnectedAt = lEl.ValueKind == JsonValueKind.Number
                ? lEl.GetInt64()
                : lEl.ValueKind == JsonValueKind.Null
                    ? null
                    : entity.LastConnectedAt;
    }
}
