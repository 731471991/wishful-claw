using WishfulClaw.Contracts;
using WishfulClaw.Worker.AgentRuntime;
using WishfulClaw.Worker.Modules;

namespace WishfulClaw.Worker;

public static class WorkerModuleCatalog
{
    public static IReadOnlyList<IWorkerModule> Default { get; } =
    [
        new SystemModule(),
        new ConfigModule(),
        new ProviderModule(),
        new ProviderTestModule(),
        new AgentRuntimeModule()
    ];
}
