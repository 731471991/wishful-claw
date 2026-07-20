using System.Text.Json;
using WishfulClaw.Contracts;

namespace WishfulClaw.Core.Protocol;

public sealed class WorkerModuleContext : IWorkerModuleContext
{
    private readonly WorkerDispatcher _dispatcher;

    public WorkerModuleContext(WorkerDispatcher dispatcher)
    {
        _dispatcher = dispatcher;
    }

    public void Register(string method, Func<JsonElement, Task<WorkerResponse>> handler)
    {
        _dispatcher.Register(method, handler);
    }

    public void Register(string method, Func<JsonElement, WorkerResponse> handler)
    {
        _dispatcher.Register(method, handler);
    }

    public void Register(string method, Func<JsonElement, IWorkerRequestContext, Task<WorkerResponse>> handler)
    {
        _dispatcher.Register(method, handler);
    }

    public void Register(string method, Func<JsonElement, IWorkerRequestContext, WorkerResponse> handler)
    {
        _dispatcher.Register(method, handler);
    }

    public string[] GetRegisteredMethods()
    {
        return _dispatcher.GetRegisteredMethods();
    }
}
