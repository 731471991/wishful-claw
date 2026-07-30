using System.Text.Json;
using WishfulClaw.Contracts;

namespace WishfulClaw.Agent;

/// <summary>
/// Executes skill management tools (list_installed_skills, search_skill_market, install_skill)
/// by routing to the renderer via reverse-request.
/// </summary>
public static class AgentRuntimeSkillManagementExecutor
{
    private static readonly HashSet<string> SkillManagementTools = new(StringComparer.Ordinal)
    {
        "list_installed_skills",
        "search_skill_market",
        "install_skill"
    };

    public static bool IsSkillManagementTool(string toolName)
    {
        return SkillManagementTools.Contains(toolName);
    }

    public static async Task<string> ExecuteAsync(
        AgentRuntimeNativeToolCall call,
        IWorkerRequestContext context,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await AgentRuntimeReverseRequests.RequestAsync(
                context,
                "skill-management:execute",
                CreateRequestPayload(call),
                cancellationToken);

            return result.ValueKind == JsonValueKind.String
                ? result.GetString() ?? string.Empty
                : result.ToString();
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            return $$"""{"error":"Skill management tool execution failed: {{ex.Message}}"}""";
        }
    }

    private static JsonElement CreateRequestPayload(AgentRuntimeNativeToolCall call)
    {
        var json = JsonSerializer.Serialize(new
        {
            toolName = call.Name,
            input = call.Input
        });
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }
}
