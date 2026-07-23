using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.Modules.Db;

internal sealed class DbModule : IWorkerModule
{
    public string Name => "db";

    public void Register(IWorkerModuleContext context)
    {
        // ── Initialize ──
        context.Register("db/initialize", DbInitialize);

        // ── Projects ──
        context.Register("db/projects-list", DbProjectTools.List);
        context.Register("db/projects-get", DbProjectTools.Get);
        context.Register("db/projects-create", DbProjectTools.Create);
        context.Register("db/projects-update", DbProjectTools.Update);
        context.Register("db/projects-delete", DbProjectTools.Delete);
        context.Register("db/projects-ensure-default", DbProjectTools.EnsureDefault);

        // ── Sessions ──
        context.Register("db/sessions-list", DbSessionTools.List);
        context.Register("db/sessions-get", DbSessionTools.Get);
        context.Register("db/sessions-create", DbSessionTools.Create);
        context.Register("db/sessions-update", DbSessionTools.Update);
        context.Register("db/sessions-delete", DbSessionTools.Delete);
        context.Register("db/sessions-clear-all", DbSessionTools.ClearAll);

        // ── Messages ──
        context.Register("db/messages-list", DbMessageTools.List);
        context.Register("db/messages-list-page", DbMessageTools.ListPage);
        context.Register("db/messages-add", DbMessageTools.Add);
        context.Register("db/messages-add-batch", DbMessageTools.AddBatch);
        context.Register("db/messages-upsert", DbMessageTools.Upsert);
        context.Register("db/messages-update", DbMessageTools.Update);
        context.Register("db/messages-clear", DbMessageTools.Clear);
        context.Register("db/messages-delete", DbMessageTools.Delete);
        context.Register("db/messages-count", DbMessageTools.Count);
        context.Register("db/messages-delete-last", DbMessageTools.DeleteLast);
        context.Register("db/messages-truncate-from", DbMessageTools.TruncateFrom);
    }

    private static WorkerResponse DbInitialize(JsonElement parameters)
    {
        var dbPath = DbClient.ResolveDbPath(parameters);
        var result = DbClient.Initialize(dbPath);
        return WorkerResponse.Json(result);
    }
}
