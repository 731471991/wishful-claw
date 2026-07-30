using System.Text.Json;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Agent;

/// <summary>
/// JSON encoding and helper methods for AgentRuntimeUseCapabilityExecutor.
/// Split from the main file for maintainability (AGENTS.md: 200~500 lines per file).
/// </summary>
internal static partial class AgentRuntimeUseCapabilityExecutor
{
    // ── helpers ──

    private static (string? ServerId, string ToolName) ParseMcpToolId(string capabilityId)
    {
        // mcp-tool:serverName/toolName
        var rest = capabilityId["mcp-tool:".Length..];
        var slashIdx = rest.IndexOf('/');
        if (slashIdx <= 0 || slashIdx + 1 >= rest.Length)
        {
            return (null, string.Empty);
        }
        return (rest[..slashIdx], rest[(slashIdx + 1)..]);
    }

    private static JsonElement CreateEmptyObject()
    {
        using var doc = JsonDocument.Parse("{}");
        return doc.RootElement.Clone();
    }

    private static JsonElement CreateInspectRequest(string serverId, string toolName)
    {
        var json = JsonSerializer.Serialize(new { serverId, toolName });
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    private static JsonElement CreateSkillInput(string skillName)
    {
        var json = JsonSerializer.Serialize(new { SkillName = skillName });
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    private static JsonElement? FindServer(JsonElement listResult, string serverName)
    {
        if (listResult.ValueKind != JsonValueKind.Object) return null;
        if (!listResult.TryGetProperty("servers", out var servers) || servers.ValueKind != JsonValueKind.Array) return null;
        foreach (var server in servers.EnumerateArray())
        {
            if (server.ValueKind == JsonValueKind.Object &&
                server.TryGetProperty("id", out var id) &&
                string.Equals(id.GetString(), serverName, StringComparison.OrdinalIgnoreCase))
            {
                return server;
            }
        }
        return null;
    }

    private static bool IsJsonError(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.TryGetProperty("error", out _);
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Collect built-in tools from the registry that belong to proxied categories.
    /// </summary>
    private static List<(string Name, string Description, string Category)> GetProxiedBuiltinTools(ToolRegistry? registry)
    {
        var result = new List<(string, string, string)>();
        if (registry is null) return result;

        foreach (var name in registry.GetToolNames())
        {
            var category = registry.GetCategory(name);
            if (category is null) continue;
            if (!ProxiedCategories.Contains(category)) continue;

            // Get description from the tool definition
            if (registry.TryGetExecutor(name, out var executor) && executor is not null)
            {
                result.Add((name, executor.Description, category));
            }
        }

        result.Sort((a, b) => string.Compare(a.Item1, b.Item1, StringComparison.Ordinal));
        return result;
    }

    // ── encoding ──

    private static string EncodeListResponse(JsonElement listResult, ToolRegistry? registry)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            writer.WritePropertyName("capabilities");
            writer.WriteStartArray();

            // MCP servers
            if (listResult.ValueKind == JsonValueKind.Object &&
                listResult.TryGetProperty("servers", out var servers) &&
                servers.ValueKind == JsonValueKind.Array)
            {
                foreach (var server in servers.EnumerateArray())
                {
                    if (server.ValueKind != JsonValueKind.Object) continue;
                    var id = JsonHelpers.GetString(server, "id") ?? "";
                    var name = JsonHelpers.GetString(server, "name") ?? id;
                    var status = JsonHelpers.GetString(server, "status") ?? "configured";

                    writer.WriteStartObject();
                    writer.WriteString("capability_id", $"mcp-server:{id}");
                    writer.WriteString("type", "mcp-server");
                    writer.WriteString("name", name);
                    writer.WriteString("status", status);
                    writer.WritePropertyName("tools");
                    writer.WriteStartArray();
                    if (server.TryGetProperty("tools", out var tools) && tools.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var tool in tools.EnumerateArray())
                        {
                            if (tool.ValueKind != JsonValueKind.Object) continue;
                            var toolName = JsonHelpers.GetString(tool, "name") ?? "";
                            var toolDesc = JsonHelpers.GetString(tool, "description") ?? "";
                            writer.WriteStartObject();
                            writer.WriteString("capability_id", $"mcp-tool:{id}/{toolName}");
                            writer.WriteString("name", toolName);
                            writer.WriteString("description", toolDesc);
                            writer.WriteEndObject();
                        }
                    }
                    writer.WriteEndArray();
                    writer.WriteEndObject();
                }
            }

            // Skills
            if (listResult.ValueKind == JsonValueKind.Object &&
                listResult.TryGetProperty("skills", out var skills) &&
                skills.ValueKind == JsonValueKind.Array)
            {
                foreach (var skill in skills.EnumerateArray())
                {
                    if (skill.ValueKind != JsonValueKind.Object) continue;
                    var name = JsonHelpers.GetString(skill, "name") ?? "";
                    var desc = JsonHelpers.GetString(skill, "description") ?? "";
                    writer.WriteStartObject();
                    writer.WriteString("capability_id", $"skill:{name}");
                    writer.WriteString("type", "skill");
                    writer.WriteString("name", name);
                    writer.WriteString("description", desc);
                    writer.WriteEndObject();
                }
            }

            // Built-in proxied tools
            var builtinTools = GetProxiedBuiltinTools(registry);
            if (builtinTools.Count > 0)
            {
                // Group by category for readability
                foreach (var group in builtinTools.GroupBy(t => t.Category))
                {
                    writer.WriteStartObject();
                    writer.WriteString("capability_id", $"builtin-group:{group.Key}");
                    writer.WriteString("type", "builtin-group");
                    writer.WriteString("name", group.Key);
                    writer.WriteString("description", $"Built-in tools: {group.Key}");
                    writer.WritePropertyName("tools");
                    writer.WriteStartArray();
                    foreach (var (name, desc, _) in group)
                    {
                        writer.WriteStartObject();
                        writer.WriteString("capability_id", $"builtin:{name}");
                        writer.WriteString("name", name);
                        writer.WriteString("description", desc);
                        writer.WriteEndObject();
                    }
                    writer.WriteEndArray();
                    writer.WriteEndObject();
                }
            }

            writer.WriteEndArray();
            writer.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }

    private static string EncodeInspectResponse(string capabilityId, JsonElement detail)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            writer.WriteString("capability_id", capabilityId);
            writer.WritePropertyName("detail");
            detail.WriteTo(writer);
            writer.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }

    private static string EncodeSkillInspectResponse(string skillName)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            writer.WriteString("capability_id", $"skill:{skillName}");
            writer.WriteString("type", "skill");
            writer.WriteString("name", skillName);
            writer.WriteString("description", $"Skill: {skillName}. Use action=call to load the full SKILL.md content.");
            writer.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }

    private static string EncodeBuiltinInspectResponse(ToolRegistry? registry, string toolName)
    {
        if (registry is null || !registry.TryGetExecutor(toolName, out var executor) || executor is null)
        {
            return EncodeError($"Built-in tool not found: {toolName}");
        }

        var category = registry.GetCategory(toolName);
        if (category is null || !ProxiedCategories.Contains(category))
        {
            return EncodeError($"Tool '{toolName}' is not a proxied capability.");
        }

        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            writer.WriteString("capability_id", $"builtin:{toolName}");
            writer.WriteString("type", "builtin");
            writer.WriteString("name", toolName);
            writer.WriteString("category", category);
            writer.WriteString("description", executor.Description);
            writer.WritePropertyName("input_schema");
            executor.InputSchema.WriteTo(writer);
            writer.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }

    private static string EncodeError(string message)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            writer.WriteString("error", message);
            writer.WriteEndObject();
        }
        return System.Text.Encoding.UTF8.GetString(stream.ToArray());
    }
}
