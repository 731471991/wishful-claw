using WishfulClaw.Worker.Tools;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Worker.Tools.Providers;

/// <summary>
/// Registers skill tool definitions.
/// Execution: ToolDispatchRouter → AgentRuntimeSkillExecutor (reads SKILL.md from disk).
/// </summary>
internal sealed class SkillToolProvider : IToolProvider
{
    public string Category => "skill";

    public void RegisterTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "Skill",
            "Invoke a registered skill (reusable prompt template). Skills are predefined workflows that can be triggered by name.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["SkillName"] = ToolSchemaBuilder.String("The name of the skill to invoke."),
                    ["input"] = ToolSchemaBuilder.String("Optional input parameters for the skill (JSON string).")
                },
                ["SkillName"])));
    }
}
