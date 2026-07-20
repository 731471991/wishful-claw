using WishfulClaw.Contracts;
using WishfulClaw.Worker.Modules;

namespace WishfulClaw.Worker;

public static class WorkerModuleCatalog
{
    public static IReadOnlyList<IWorkerModule> Default { get; } =
    [
        new SystemModule()
    ];
}
