using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker;

internal sealed class ProviderTestModule : IWorkerModule
{
    public string Name => "provider-test";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("provider/test", ProviderTestService.TestAsync);
        context.Register("provider/fetch-models", ProviderTestService.FetchModelsAsync);
    }
}
