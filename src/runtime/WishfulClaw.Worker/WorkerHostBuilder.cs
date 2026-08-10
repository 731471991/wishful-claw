using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Infrastructure.Db;

namespace WishfulClaw.Worker;

public sealed class WorkerHostBuilder
{
    private readonly List<IWorkerModule> modules = [];
    private readonly HashSet<string> moduleNames = new(StringComparer.Ordinal);
    private WorkerEndpoint? endpoint;

    public WorkerHostBuilder UseDefaultModules()
    {
        foreach (var module in WorkerModuleCatalog.Default)
        {
            AddModule(module);
        }
        return this;
    }

    public WorkerHostBuilder AddModule(IWorkerModule module)
    {
        if (!moduleNames.Add(module.Name))
        {
            throw new InvalidOperationException($"Duplicate worker module: {module.Name}");
        }

        modules.Add(module);
        return this;
    }

    public WorkerHostBuilder UseEndpoint(WorkerEndpoint workerEndpoint)
    {
        endpoint = workerEndpoint;
        return this;
    }

    public WorkerHost Build()
    {
        if (endpoint is null)
        {
            throw new InvalidOperationException("Native worker IPC endpoint is required.");
        }

        var dispatcher = new WorkerDispatcher();
        var context = new WorkerModuleContext(dispatcher);

        foreach (var module in modules)
        {
            module.Register(context);
        }

        // Initialize all modules (async, fire-and-forget — modules that need
        // startup initialization, like Goal recovery, run here)
        var initTask = InitializeModulesAsync();
        // Intentionally not awaited — initialization runs in background;
        // the server starts accepting requests immediately.
        _ = initTask;

        return new WorkerHost(new LocalIpcWorkerServer(dispatcher, endpoint));
    }

    private async Task InitializeModulesAsync()
    {
        try
        {
            // Initialize DB first so modules can read from it
            DbClient.GetClient();

            foreach (var module in modules)
            {
                try
                {
                    await module.InitializeAsync();
                }
                catch (Exception ex)
                {
                    WorkerLog.Warn($"Module {module.Name} InitializeAsync failed: {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            WorkerLog.Warn($"DB initialization for module init failed: {ex.Message}");
        }
    }
}
