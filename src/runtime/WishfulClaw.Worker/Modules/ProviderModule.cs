using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Infrastructure.Storage;

namespace WishfulClaw.Worker;

internal sealed class ProviderModule : IWorkerModule
{
    public string Name => "provider";

    public void Register(IWorkerModuleContext context)
    {
        context.Register("provider/list", ProviderStore.List);
        context.Register("provider/get", ProviderStore.Get);
        context.Register("provider/save", ProviderStore.Save);
        context.Register("provider/delete", ProviderStore.Delete);
    }
}
