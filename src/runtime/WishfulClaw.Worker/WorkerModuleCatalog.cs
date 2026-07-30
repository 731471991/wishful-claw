using WishfulClaw.Contracts;
using WishfulClaw.Agent;
using WishfulClaw.Worker.Modules;
using WishfulClaw.Worker.Modules.Db;
using WishfulClaw.Worker.Modules.AgentChanges;
using WishfulClaw.Worker.Modules.Git;
using WishfulClaw.Worker.Modules.Channels;
using WishfulClaw.Worker.Modules.Media;
using WishfulClaw.Worker.Modules.OpenAIAudio;
using WishfulClaw.Worker.Modules.Extensions;
using WishfulClaw.Worker.Modules.Skills;
using WishfulClaw.Worker.Modules.Video;
using WishfulClaw.Persona;
using WishfulClaw.Worker.Tools;

namespace WishfulClaw.Worker;

public static class WorkerModuleCatalog
{
    public static IReadOnlyList<IWorkerModule> Default { get; } =
    [
        new SystemModule(),
        new ConfigModule(),
        new ProviderModule(),
        new ProviderTestModule(),
        new AgentRuntimeModule(),
        new ToolModule(),
        new DbModule(),
        new PersonaModule(),
        new MemoryModule(),
        new GitModule(),
        new MediaFileModule(),
        new AgentChangeModule(),
        new OpenAIAudioModule(),
        new ChannelConfigModule(),
        new SeedanceVideoModule(),
        new XaiVideoModule(),
        new ExtensionModule(),
        new SkillModule(),
        new WebFetchModule()
    ];
}
