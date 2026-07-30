using System.Text.Json;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Worker.Tools.Providers;

/// <summary>
/// Registers placeholder tool definitions for skill management tools.
/// These tools execute in the renderer process via reverse-request.
/// Category "skill-management" is proxied via use_capability in normal chat/coding,
/// but directly visible to the skill-installer sub-agent preset.
/// </summary>
internal sealed class SkillManagementToolProvider : IToolProvider
{
    public string Category => "skill-management";

    public void RegisterTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "list_installed_skills",
            "List all skills currently installed in the local skills directory. Returns each skill's name, description, and enabled status.",
            ToolSchemaBuilder.Object()), Category);

        registry.Register(new ToolDefinitionPlaceholder(
            "search_skill_market",
            "Search the skill marketplace for available skills. Returns matching skills with name, description, download URL, and install command.",
            ToolSchemaBuilder.Object(
                new() { ["query"] = ToolSchemaBuilder.String("Search query for finding skills") },
                new[] { "query" })), Category);

        registry.Register(new ToolDefinitionPlaceholder(
            "install_skill",
            "Install a skill from the marketplace by its slug or download URL. Downloads and extracts the skill to the local skills directory.",
            ToolSchemaBuilder.Object(
                new() {
                    ["slug"] = ToolSchemaBuilder.String("Skill slug from marketplace search results"),
                    ["url"] = ToolSchemaBuilder.String("Direct download URL for the skill")
                })), Category);
    }
}
