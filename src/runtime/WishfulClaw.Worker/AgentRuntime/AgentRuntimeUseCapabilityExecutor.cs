using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Unified capability executor — handles use_capability tool calls.
///
/// Actions:
///   list    — returns all available MCP servers, their tools, Skills, and proxied built-in tools
///   inspect — returns the input schema for a specific capability
///   call    — executes an MCP tool, Skill, or built-in tool by capability_id
///
/// Capability ID formats:
///   mcp-server:name      — MCP server (inspect only)
///   mcp-tool:server/tool — MCP tool (inspect, call)
///   skill:name           — Skill (inspect, call)
///   builtin:ToolName     — Built-in Worker tool in a proxied category (inspect, call)
///
/// Inspired by Reasonix's UseCapabilityTool.
/// </summary>
internal static class AgentRuntimeUseCapabilityExecutor
{
    private const string ToolName = "use_capability";

    /// <summary>
    /// Tool categories that are NOT directly registered in chat/coding presets.
    /// Tools in these categories are accessible only via use_capability.
    /// </summary>
    private static readonly HashSet<string> ProxiedCategories = new(StringComparer.OrdinalIgnoreCase)
    {
        "desktop", "cron", "notify", "image-generate",
        "notebook", "widget", "team",
        "channel-plugin", "plugin", "ssh"
    };

    public static bool IsUseCapabilityTool(string toolName)
    {
        return string.Equals(toolName, ToolName, StringComparison.Ordinal);
    }

    public static async Task<string> ExecuteAsync(
        AgentRuntimeNativeToolCall call,
        AgentRuntimeRunState state,
        IWorkerRequestContext context,
        ToolRegistry? registry,
        string? workingFolder,
        CancellationToken cancellationToken)
    {
        var action = (JsonHelpers.GetString(call.Input, "action") ?? "list").Trim().ToLowerInvariant();
        var capabilityId = (JsonHelpers.GetString(call.Input, "capability_id") ?? string.Empty).Trim();

        return action switch
        {
            "list" => await ListCapabilitiesAsync(context, registry, cancellationToken),
            "inspect" => await InspectCapabilityAsync(context, registry, capabilityId, cancellationToken),
            "call" => await CallCapabilityAsync(call, state, context, registry, workingFolder, capabilityId, cancellationToken),
            _ => EncodeError($"Unknown action: {action}. Use list, inspect, or call.")
        };
    }

    // ── list ──

    private static async Task<string> ListCapabilitiesAsync(
        IWorkerRequestContext context,
        ToolRegistry? registry,
        CancellationToken cancellationToken)
    {
        try
        {
            // Ask renderer for MCP server/tool metadata
            var mcpResult = await AgentRuntimeReverseRequests.RequestAsync(
                context,
                "mcp:capability-list",
                CreateEmptyObject(),
                cancellationToken);

            return EncodeListResponse(mcpResult, registry);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return EncodeError($"Failed to list capabilities: {ex.Message}");
        }
    }

    // ── inspect ──

    private static async Task<string> InspectCapabilityAsync(
        IWorkerRequestContext context,
        ToolRegistry? registry,
        string capabilityId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(capabilityId))
        {
            return EncodeError("capability_id is required for action=inspect");
        }

        // MCP tool: mcp-tool:server/toolName
        if (capabilityId.StartsWith("mcp-tool:", StringComparison.Ordinal))
        {
            var (serverId, toolName) = ParseMcpToolId(capabilityId);
            if (serverId is null)
            {
                return EncodeError($"Invalid MCP tool capability_id: {capabilityId}");
            }

            try
            {
                var result = await AgentRuntimeReverseRequests.RequestAsync(
                    context,
                    "mcp:capability-inspect",
                    CreateInspectRequest(serverId, toolName),
                    cancellationToken);

                return EncodeInspectResponse(capabilityId, result);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                return EncodeError($"Failed to inspect MCP tool: {ex.Message}");
            }
        }

        // MCP server: mcp-server:name
        if (capabilityId.StartsWith("mcp-server:", StringComparison.Ordinal))
        {
            var serverName = capabilityId["mcp-server:".Length..];
            try
            {
                var result = await AgentRuntimeReverseRequests.RequestAsync(
                    context,
                    "mcp:capability-list",
                    CreateEmptyObject(),
                    cancellationToken);

                var serverInfo = FindServer(result, serverName);
                if (serverInfo is null)
                {
                    return EncodeError($"MCP server not found: {serverName}");
                }
                return EncodeInspectResponse(capabilityId, serverInfo.Value);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                return EncodeError($"Failed to inspect MCP server: {ex.Message}");
            }
        }

        // Skill: skill:name
        if (capabilityId.StartsWith("skill:", StringComparison.Ordinal))
        {
            var skillName = capabilityId["skill:".Length..];
            return EncodeSkillInspectResponse(skillName);
        }

        // Built-in tool: builtin:ToolName
        if (capabilityId.StartsWith("builtin:", StringComparison.Ordinal))
        {
            var toolName = capabilityId["builtin:".Length..];
            return EncodeBuiltinInspectResponse(registry, toolName);
        }

        return EncodeError($"Unknown capability_id format: {capabilityId}");
    }

    // ── call ──

    private static async Task<string> CallCapabilityAsync(
        AgentRuntimeNativeToolCall call,
        AgentRuntimeRunState state,
        IWorkerRequestContext context,
        ToolRegistry? registry,
        string? workingFolder,
        string capabilityId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(capabilityId))
        {
            return EncodeError("capability_id is required for action=call");
        }

        // Extract arguments
        var arguments = call.Input.TryGetProperty("arguments", out var argsEl) && argsEl.ValueKind == JsonValueKind.Object
            ? argsEl
            : CreateEmptyObject();

        // MCP tool: mcp-tool:server/toolName → mcp__server__toolName
        if (capabilityId.StartsWith("mcp-tool:", StringComparison.Ordinal))
        {
            var (serverId, toolName) = ParseMcpToolId(capabilityId);
            if (serverId is null)
            {
                return EncodeError($"Invalid MCP tool capability_id: {capabilityId}");
            }

            var mcpToolCall = new AgentRuntimeNativeToolCall(
                call.Id,
                $"mcp__{serverId}__{toolName}",
                arguments);

            return await AgentRuntimeMcpExecutor.ExecuteAsync(mcpToolCall, context, cancellationToken);
        }

        // Skill: skill:name → Skill tool with SkillName
        if (capabilityId.StartsWith("skill:", StringComparison.Ordinal))
        {
            var skillName = capabilityId["skill:".Length..];
            var skillCall = new AgentRuntimeNativeToolCall(
                call.Id,
                "Skill",
                CreateSkillInput(skillName));

            return await AgentRuntimeSkillExecutor.ExecuteAsync(skillCall, cancellationToken);
        }

        // Built-in tool: builtin:ToolName → dispatch via ToolDispatchRouter
        if (capabilityId.StartsWith("builtin:", StringComparison.Ordinal))
        {
            var toolName = capabilityId["builtin:".Length..];
            if (registry is null || !registry.IsRegistered(toolName))
            {
                return EncodeError($"Built-in tool not found: {toolName}");
            }

            // Verify the tool is in a proxied category (not a core tool that should be called directly)
            var category = registry.GetCategory(toolName);
            if (category is null || !ProxiedCategories.Contains(category))
            {
                return EncodeError($"Tool '{toolName}' is not a proxied capability. Call it directly.");
            }

            var builtinCall = new AgentRuntimeNativeToolCall(
                call.Id,
                toolName,
                arguments);

            var (output, isError) = await ToolDispatchRouter.DispatchAsync(
                builtinCall, state, context, registry, workingFolder);

            return isError && IsJsonError(output) ? output : output;
        }

        return EncodeError($"Unknown capability_id format for call: {capabilityId}");
    }

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
