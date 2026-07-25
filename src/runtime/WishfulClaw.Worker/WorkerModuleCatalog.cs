using WishfulClaw.Contracts;
using WishfulClaw.Worker.AgentRuntime;
using WishfulClaw.Worker.Modules;
using WishfulClaw.Worker.Modules.Db;
using WishfulClaw.Worker.Modules.AgentChanges;
using WishfulClaw.Worker.Modules.Git;
using WishfulClaw.Worker.Modules.Media;
using WishfulClaw.Worker.Modules.OpenAIAudio;
using WishfulClaw.Worker.Persona;
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
        new OpenAIAudioModule()
    ];
}
