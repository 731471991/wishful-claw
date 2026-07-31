using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent.Modules.Extensions;

/// <summary>
/// Partial of ExtensionManifestStore — typed manifest reading
/// </summary>
public static partial class ExtensionManifestStore
{
    // ── Manifest reading (typed) ──

    private static NativeExtensionManifest ReadManifest(string extensionPath)
    {
        var manifestPath = Path.Combine(extensionPath, ExtensionManifestFileName);
        using var document = JsonDocument.Parse(File.ReadAllBytes(manifestPath));
        var root = document.RootElement;
        if (root.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidOperationException("extension.json must contain an object");
        }

        var schemaVersion = ReadInt(root, "schemaVersion", 0);
        if (schemaVersion != 1)
        {
            throw new InvalidOperationException("extension schemaVersion must be 1");
        }

        var id = NormalizeId(ReadString(root, "id"));
        if (!IsValidExtensionId(id))
        {
            throw new InvalidOperationException("extension id must be 2-64 chars using lowercase letters, numbers, _ or -");
        }

        var name = ReadString(root, "name").Trim();
        var version = ReadString(root, "version").Trim();
        if (name.Length == 0)
        {
            throw new InvalidOperationException("extension name is required");
        }
        if (version.Length == 0)
        {
            throw new InvalidOperationException("extension version is required");
        }

        var configSchema = ReadConfigSchema(root);
        var networkPermissions = ReadNetworkPermissions(root);
        var tools = ReadTools(root);
        if (tools.Count == 0)
        {
            throw new InvalidOperationException("extension must define at least one supported tool");
        }
        if (tools.Any(static tool => tool.Kind == "js") &&
            ReadString(root, "entry").Trim().Length == 0)
        {
            throw new InvalidOperationException("extension entry is required for js tools");
        }

        return new NativeExtensionManifest(
            schemaVersion,
            id,
            name,
            version,
            configSchema,
            networkPermissions,
            tools);
    }

    private static List<NativeExtensionConfigField> ReadConfigSchema(JsonElement root)
    {
        if (!root.TryGetProperty("configSchema", out var schema) || schema.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var fields = new List<NativeExtensionConfigField>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in schema.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var key = ReadString(item, "key").Trim();
            if (key.Length == 0)
            {
                continue;
            }
            if (!seen.Add(key))
            {
                throw new InvalidOperationException($"duplicate config key: {key}");
            }

            var type = ReadString(item, "type") == "secret" ? "secret" : "text";
            var defaultValue = item.TryGetProperty("defaultValue", out var defaultElement) &&
                defaultElement.ValueKind == JsonValueKind.String
                    ? defaultElement.GetString()
                    : null;
            fields.Add(new NativeExtensionConfigField(key, type, defaultValue));
        }

        return fields;
    }

    private static List<string> ReadNetworkPermissions(JsonElement root)
    {
        if (!root.TryGetProperty("permissions", out var permissions) ||
            permissions.ValueKind != JsonValueKind.Object ||
            !permissions.TryGetProperty("network", out var network) ||
            network.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var values = new List<string>();
        foreach (var item in network.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String &&
                item.GetString() is { } value &&
                value.Trim().Length > 0)
            {
                values.Add(value.Trim());
            }
        }
        return values;
    }

    private static List<NativeExtensionToolDefinition> ReadTools(JsonElement root)
    {
        if (!root.TryGetProperty("tools", out var toolsElement) || toolsElement.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException("extension must define at least one tool");
        }

        var tools = new List<NativeExtensionToolDefinition>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in toolsElement.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var name = ReadString(item, "name").Trim();
            if (!ToolNameRegex().IsMatch(name))
            {
                throw new InvalidOperationException("invalid extension tool name");
            }
            if (!seen.Add(name))
            {
                throw new InvalidOperationException($"duplicate tool name: {name}");
            }

            var kind = ReadString(item, "kind").Trim();
            if (kind == "js")
            {
                var handler = ReadString(item, "handler").Trim();
                if (handler.Length == 0)
                {
                    throw new InvalidOperationException($"js tool \"{name}\" requires handler");
                }
                tools.Add(new NativeExtensionToolDefinition(name, kind, null, handler));
                continue;
            }
            if (kind != "http")
            {
                throw new InvalidOperationException($"tool \"{name}\" kind must be \"http\" or \"js\"");
            }

            var http = ReadHttpDefinition(name, item);
            tools.Add(new NativeExtensionToolDefinition(name, kind, http, null));
        }

        return tools;
    }

    private static NativeExtensionHttpDefinition ReadHttpDefinition(string toolName, JsonElement tool)
    {
        if (!tool.TryGetProperty("http", out var http) || http.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidOperationException($"http tool \"{toolName}\" requires http.method and http.url");
        }

        var method = ReadString(http, "method").Trim().ToUpperInvariant();
        if (method.Length == 0)
        {
            method = "GET";
        }

        var url = ReadString(http, "url").Trim();
        if (url.Length == 0)
        {
            throw new InvalidOperationException($"http tool \"{toolName}\" requires http.method and http.url");
        }

        var headers = new Dictionary<string, string>(StringComparer.Ordinal);
        if (http.TryGetProperty("headers", out var headersElement) &&
            headersElement.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in headersElement.EnumerateObject())
            {
                if (property.Value.ValueKind == JsonValueKind.String)
                {
                    headers[property.Name] = property.Value.GetString() ?? string.Empty;
                }
            }
        }

        JsonElement? body = null;
        if (http.TryGetProperty("body", out var bodyElement))
        {
            body = bodyElement.Clone();
        }

        return new NativeExtensionHttpDefinition(method, url, headers, body);
    }

}
