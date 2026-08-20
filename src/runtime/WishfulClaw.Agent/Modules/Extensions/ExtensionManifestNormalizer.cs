using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent.Modules.Extensions;

/// <summary>
/// Partial of ExtensionManifestStore — JsonNode manifest normalization
/// </summary>
public static partial class ExtensionManifestStore
{
    // ── Manifest normalization (JsonNode-based, for List/Install/Update) ──

    private static JsonObject ReadNormalizedManifestNode(string extensionDir)
    {
        var manifestPath = Path.Combine(extensionDir, ExtensionManifestFileName);
        using var document = JsonDocument.Parse(File.ReadAllBytes(manifestPath));
        return NormalizeManifestNode(document.RootElement);
    }

    private static JsonObject NormalizeManifestNode(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidOperationException("extension.json must contain an object");
        }

        if (ReadInt(root, "schemaVersion", 0) != 1)
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

        var tools = NormalizeTools(root);
        if (tools.Count == 0)
        {
            throw new InvalidOperationException("extension must define at least one tool");
        }
        var entry = ReadOptionalString(root, "entry");
        if (ToolsContainKind(tools, "js") && string.IsNullOrWhiteSpace(entry))
        {
            throw new InvalidOperationException("extension entry is required for js tools");
        }

        var manifest = new JsonObject
        {
            ["schemaVersion"] = 1,
            ["id"] = id,
            ["name"] = name,
            ["version"] = version,
            ["tools"] = tools
        };

        if (ReadOptionalString(root, "description") is { Length: > 0 } description)
        {
            manifest["description"] = description;
        }
        if (entry is { Length: > 0 })
        {
            manifest["entry"] = entry;
        }

        var configSchema = NormalizeConfigSchema(root);
        if (configSchema.Count > 0)
        {
            manifest["configSchema"] = configSchema;
        }

        var network = NormalizeNetworkPermissions(root);
        if (network.Count > 0)
        {
            manifest["permissions"] = new JsonObject { ["network"] = network };
        }

        var renderers = NormalizeRenderers(root);
        if (renderers.Count > 0)
        {
            manifest["renderers"] = renderers;
        }

        var components = NormalizeComponents(root);
        if (components.Count > 0)
        {
            manifest["components"] = components;
        }

        return manifest;
    }

    private static JsonArray NormalizeConfigSchema(JsonElement root)
    {
        var result = new JsonArray();
        if (!root.TryGetProperty("configSchema", out var schema) || schema.ValueKind != JsonValueKind.Array)
        {
            return result;
        }

        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in schema.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            var key = ReadString(item, "key").Trim();
            var label = ReadString(item, "label").Trim();
            if (label.Length == 0)
            {
                label = key;
            }
            if (key.Length == 0 || label.Length == 0)
            {
                continue;
            }
            if (!seen.Add(key))
            {
                throw new InvalidOperationException($"duplicate config key: {key}");
            }

            var field = new JsonObject
            {
                ["key"] = key,
                ["label"] = label,
                ["type"] = ReadString(item, "type") == "secret" ? "secret" : "text"
            };
            if (ReadBool(item, "required", false))
            {
                field["required"] = true;
            }
            AddOptionalString(field, item, "description");
            AddOptionalString(field, item, "placeholder");
            AddOptionalString(field, item, "defaultValue");
            result.Add((JsonNode?)field);
        }

        return result;
    }

    private static JsonArray NormalizeTools(JsonElement root)
    {
        if (!root.TryGetProperty("tools", out var toolsElement) || toolsElement.ValueKind != JsonValueKind.Array)
        {
            throw new InvalidOperationException("extension must define at least one tool");
        }

        var result = new JsonArray();
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
            JsonObject tool;
            if (kind == "js")
            {
                var handler = ReadString(item, "handler").Trim();
                if (handler.Length == 0)
                {
                    throw new InvalidOperationException($"js tool \"{name}\" requires handler");
                }

                tool = new JsonObject
                {
                    ["name"] = name,
                    ["description"] = ReadOptionalString(item, "description") ?? name,
                    ["inputSchema"] = item.TryGetProperty("inputSchema", out var jsInputSchema) &&
                        jsInputSchema.ValueKind == JsonValueKind.Object
                            ? CloneElement(jsInputSchema)
                            : new JsonObject { ["type"] = "object" },
                    ["kind"] = "js",
                    ["handler"] = handler
                };
            }
            else if (kind == "http")
            {
                tool = new JsonObject
                {
                    ["name"] = name,
                    ["description"] = ReadOptionalString(item, "description") ?? name,
                    ["inputSchema"] = item.TryGetProperty("inputSchema", out var inputSchema) &&
                        inputSchema.ValueKind == JsonValueKind.Object
                            ? CloneElement(inputSchema)
                            : new JsonObject { ["type"] = "object" },
                    ["kind"] = "http",
                    ["http"] = NormalizeHttpDefinition(name, item)
                };
            }
            else
            {
                throw new InvalidOperationException($"tool \"{name}\" kind must be \"http\" or \"js\"");
            }
            if (item.TryGetProperty("readOnly", out var readOnly) &&
                readOnly.ValueKind is JsonValueKind.True or JsonValueKind.False)
            {
                tool["readOnly"] = readOnly.GetBoolean();
            }
            result.Add((JsonNode?)tool);
        }

        return result;
    }

    private static JsonObject NormalizeHttpDefinition(string toolName, JsonElement tool)
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

        var result = new JsonObject
        {
            ["method"] = method,
            ["url"] = url
        };

        if (http.TryGetProperty("headers", out var headers) && headers.ValueKind == JsonValueKind.Object)
        {
            var headerObject = new JsonObject();
            foreach (var property in headers.EnumerateObject())
            {
                if (property.Value.ValueKind == JsonValueKind.String)
                {
                    headerObject[property.Name] = property.Value.GetString() ?? string.Empty;
                }
            }
            if (headerObject.Count > 0)
            {
                result["headers"] = headerObject;
            }
        }

        if (http.TryGetProperty("body", out var body))
        {
            result["body"] = CloneElement(body);
        }

        return result;
    }

    private static bool ToolsContainKind(JsonArray tools, string kind)
    {
        foreach (var item in tools)
        {
            if (item is JsonObject tool &&
                tool.TryGetPropertyValue("kind", out var kindNode) &&
                string.Equals(kindNode?.GetValue<string>(), kind, StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }

    private static JsonArray NormalizeNetworkPermissions(JsonElement root)
    {
        var result = new JsonArray();
        if (!root.TryGetProperty("permissions", out var permissions) ||
            permissions.ValueKind != JsonValueKind.Object ||
            !permissions.TryGetProperty("network", out var network) ||
            network.ValueKind != JsonValueKind.Array)
        {
            return result;
        }

        foreach (var item in network.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.String &&
                item.GetString() is { } value &&
                value.Trim().Length > 0)
            {
                result.Add((JsonNode?)JsonValue.Create(value.Trim()));
            }
        }
        return result;
    }

    private static JsonArray NormalizeRenderers(JsonElement root)
    {
        var result = new JsonArray();
        if (!root.TryGetProperty("renderers", out var renderers) || renderers.ValueKind != JsonValueKind.Array)
        {
            return result;
        }

        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in renderers.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object)
            {
                continue;
            }
            var name = ReadString(item, "name").Trim();
            var entry = ReadString(item, "entry").Trim();
            if (name.Length == 0 || entry.Length == 0)
            {
                continue;
            }
            if (!seen.Add(name))
            {
                throw new InvalidOperationException($"duplicate renderer name: {name}");
            }
            result.Add((JsonNode?)new JsonObject
            {
                ["name"] = name,
                ["type"] = "html",
                ["entry"] = entry
            });
        }
        return result;
    }

    private static JsonArray NormalizeComponents(JsonElement root)
    {
        var result = new JsonArray();
        if (!root.TryGetProperty("components", out var components) || components.ValueKind != JsonValueKind.Array)
        {
            return result;
        }

        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var item in components.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object)
            {
                continue;
            }
            var name = ReadString(item, "name").Trim();
            var entry = ReadString(item, "entry").Trim();
            if (name.Length == 0 || entry.Length == 0)
            {
                continue;
            }
            if (!seen.Add(name))
            {
                throw new InvalidOperationException($"duplicate component name: {name}");
            }
            var component = new JsonObject
            {
                ["name"] = name,
                ["type"] = "html",
                ["entry"] = entry
            };
            AddOptionalString(component, item, "title");
            AddOptionalString(component, item, "description");
            result.Add((JsonNode?)component);
        }
        return result;
    }

}
