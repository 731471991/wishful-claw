using WishfulClaw.Core.Tools;

namespace WishfulClaw.Agent.Tools.Providers;

/// <summary>
/// Skill tool registration has moved to the unified use_capability proxy.
/// AgentRuntimeSkillExecutor is still used by use_capability for skill execution.
/// This provider is kept as a no-op so reflection discovery doesn't break.
/// </summary>
public sealed class SkillToolProvider : IToolProvider
{
    public string Category => "skill";

    public void RegisterTools(ToolRegistry registry)
    {
        // No-op: Skills are now accessed via use_capability(action="call", capability_id="skill:name")
        // AgentRuntimeSkillExecutor is still called by AgentRuntimeUseCapabilityExecutor.
    }
}
