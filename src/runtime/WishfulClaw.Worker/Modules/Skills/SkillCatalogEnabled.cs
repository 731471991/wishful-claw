using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.Modules.Skills;

/// <summary>
/// Skill enable/disable management — partial class of SkillCatalog.
/// Reads/writes ~/.agents/skills-config.json via SkillConfigStore.
/// </summary>
internal static partial class SkillCatalog
{
    public static WorkerResponse SetEnabled(JsonElement parameters)
    {
        var name = JsonHelpers.GetString(parameters, "name") ?? string.Empty;
        var enabled = true;
        if (parameters.ValueKind == JsonValueKind.Object &&
            parameters.TryGetProperty("enabled", out var enabledProp) &&
            enabledProp.ValueKind == JsonValueKind.False)
        {
            enabled = false;
        }

        lock (Sync)
        {
            try
            {
                var skillDir = ResolveInstalledSkillPath(name);
                if (!Directory.Exists(skillDir))
                {
                    return ToResponse(Mutation(false, $"Skill \"{name}\" not found"));
                }

                var config = SkillConfigStore.Load();
                if (enabled)
                {
                    config.DisabledSkills.Remove(name);
                }
                else
                {
                    config.DisabledSkills.Add(name);
                }
                SkillConfigStore.Save(config);
                WorkerLog.Debug($"skills set-enabled name={name} enabled={enabled}");
                return ToResponse(Mutation(true, null));
            }
            catch (Exception ex)
            {
                return ToResponse(Mutation(false, ex.Message));
            }
        }
    }
}
