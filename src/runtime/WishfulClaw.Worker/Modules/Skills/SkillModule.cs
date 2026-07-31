using WishfulClaw.Contracts;

namespace WishfulClaw.Worker.Modules.Skills;

/// <summary>
/// Skill management module — IPC for listing, reading, editing,
/// deleting, installing, and scanning skills.
/// Ported from WishfulClaw, adapted for wishful-claw.
/// </summary>
internal sealed class SkillModule : IWorkerModule
{
    public string Name => "skills";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("skills/ensure-builtins", SkillCatalog.EnsureBuiltins);
        context.Register("skills/ensure-builtin", SkillCatalog.EnsureBuiltin);
        context.Register("skills/list", SkillCatalog.List);
        context.Register("skills/load", SkillCatalog.Load);
        context.Register("skills/read", SkillCatalog.Read);
        context.Register("skills/list-files", SkillCatalog.ListFiles);
        context.Register("skills/delete", SkillCatalog.Delete);
        context.Register("skills/resolve-path", SkillCatalog.ResolvePath);
        context.Register("skills/add-from-folder", SkillCatalog.AddFromFolder);
        context.Register("skills/save", SkillCatalog.Save);
        context.Register("skills/set-enabled", SkillCatalog.SetEnabled);
        context.Register("skills/scan", SkillCatalog.Scan);
        context.Register("skills/cleanup-temp", SkillCatalog.CleanupTemp);
    }
}
