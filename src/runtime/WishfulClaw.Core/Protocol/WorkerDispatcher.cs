using System.Text.Json;
using WishfulClaw.Contracts;

namespace WishfulClaw.Core.Protocol;

public delegate ValueTask<WorkerResponse> WorkerMethodHandler(
    JsonElement parameters,
    IWorkerRequestContext context);

public sealed class WorkerDispatcher
{
    private readonly Dictionary<string, WorkerMethodHandler> _handlers = new(StringComparer.Ordinal);

    public void Register(string method, Func<JsonElement, Task<WorkerResponse>> handler)
    {
        AddHandler(method, async (parameters, _) => await handler(parameters));
    }

    public void Register(string method, Func<JsonElement, WorkerResponse> handler)
    {
        AddHandler(method, (parameters, _) => ValueTask.FromResult(handler(parameters)));
    }

    public void Register(string method, Func<JsonElement, IWorkerRequestContext, Task<WorkerResponse>> handler)
    {
        AddHandler(method, async (parameters, context) => await handler(parameters, context));
    }

    public void Register(string method, Func<JsonElement, IWorkerRequestContext, WorkerResponse> handler)
    {
        AddHandler(method, (parameters, context) => ValueTask.FromResult(handler(parameters, context)));
    }

    public async ValueTask<WorkerResponse> DispatchAsync(
        string method,
        JsonElement parameters,
        IWorkerRequestContext context)
    {
        if (!_handlers.TryGetValue(method, out var handler))
        {
            return WorkerResponse.Error($"Unsupported method: {method}");
        }

        return await handler(parameters, context);
    }

    public string[] GetRegisteredMethods()
    {
        var methods = _handlers.Keys.ToArray();
        Array.Sort(methods, StringComparer.Ordinal);
        return methods;
    }

    private void AddHandler(string method, WorkerMethodHandler handler)
    {
        if (!_handlers.TryAdd(method, handler))
        {
            throw new InvalidOperationException($"Duplicate worker method: {method}");
        }
    }
}
