using System.Text.Json;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Infrastructure.Db;

namespace WishfulClaw.Agent;

/// <summary>
/// DB operations for plan mode — CRUD on plans table.
/// </summary>
public static partial class AgentRuntimePlanExecutor
{
    private static PlanEntity? LoadPlanBySession(JsonElement parameters, string sessionId)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);
            return db.Queryable<PlanEntity>()
                .Where(e => e.SessionId == sessionId)
                .OrderBy("updated_at DESC")
                .First();
        }
        catch (Exception ex)
        {
            WorkerLog.Warn($"LoadPlanBySession failed: {ex.Message}");
            return null;
        }
    }

    private static PlanEntity? LoadPlanById(JsonElement parameters, string planId)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);
            return db.Queryable<PlanEntity>()
                .Where(e => e.Id == planId)
                .First();
        }
        catch (Exception ex)
        {
            WorkerLog.Warn($"LoadPlanById failed: {ex.Message}");
            return null;
        }
    }

    private static void InsertPlan(JsonElement parameters, PlanEntity plan)
    {
        DbClient.EnsureInitialized(parameters);
        var db = DbClient.GetClient(parameters);
        db.Insertable(plan).ExecuteCommand();
    }

    private static void UpdatePlanForReview(JsonElement parameters, string planId, string title, long updatedAt)
    {
        UpdatePlanStatus(parameters, planId, title, "awaiting_review", updatedAt);
    }

    private static void UpdatePlanStatus(JsonElement parameters, string planId, string title, string status, long updatedAt)
    {
        DbClient.EnsureInitialized(parameters);
        var db = DbClient.GetClient(parameters);
        db.Updateable<PlanEntity>()
            .SetColumns(e => e.Title == title)
            .SetColumns(e => e.Status == status)
            .SetColumns(e => e.UpdatedAt == updatedAt)
            .Where(e => e.Id == planId)
            .ExecuteCommand();
    }

    private static void DeletePlan(JsonElement parameters, string planId)
    {
        DbClient.EnsureInitialized(parameters);
        var db = DbClient.GetClient(parameters);
        db.Deleteable<PlanEntity>()
            .Where(e => e.Id == planId)
            .ExecuteCommand();
    }
}
