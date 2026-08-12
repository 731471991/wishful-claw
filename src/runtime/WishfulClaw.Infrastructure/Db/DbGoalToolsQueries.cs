using System.Text.Json;
using Microsoft.Data.Sqlite;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Infrastructure.Db;

public static partial class DbGoalTools
{
    public static WorkerResponse List(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);
            var hasProjectFilter = parameters.TryGetProperty("projectId", out var projectValue);
            var projectId = hasProjectFilter && projectValue.ValueKind == JsonValueKind.String
                ? projectValue.GetString()
                : null;
            List<GoalEntity> entities;
            if (!hasProjectFilter)
            {
                entities = db.Query(HistoryListSql, EntityMappers.MapGoal);
            }
            else if (projectId == null)
            {
                entities = db.Query(
                    "SELECT * FROM goals WHERE project_id IS NULL " + HistoryOrderSql,
                    EntityMappers.MapGoal);
            }
            else
            {
                entities = db.Query(
                    "SELECT * FROM goals WHERE project_id = @projectId " + HistoryOrderSql,
                    EntityMappers.MapGoal,
                    new SqliteParameter("@projectId", projectId));
            }

            return WorkerResponse.Json(
                entities.Select(GoalRow.FromEntity).ToList(),
                InfrastructureJsonContext.Default.ListGoalRow);
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbGoalTools.List failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    public static WorkerResponse Get(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var sessionId = GetString(parameters, "sessionId");
            if (string.IsNullOrEmpty(sessionId))
            {
                return WorkerResponse.Json(
                    new GoalFindResult(false, null, "sessionId is required"),
                    InfrastructureJsonContext.Default.GoalFindResult);
            }

            var row = GetBySessionId(sessionId);
            return row != null
                ? WorkerResponse.Json(row, InfrastructureJsonContext.Default.GoalRow)
                : WorkerResponse.Json(
                    new GoalFindResult(false, null, null),
                    InfrastructureJsonContext.Default.GoalFindResult);
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbGoalTools.Get failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    public static WorkerResponse ListActive(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            return WorkerResponse.Json(
                ListActiveGoals(),
                InfrastructureJsonContext.Default.ListGoalRow);
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbGoalTools.ListActive failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    public static GoalRow? GetBySessionId(string sessionId)
    {
        var entity = DbClient.GetClient().QueryFirstOrDefault(
            "SELECT * FROM goals WHERE session_id = @sid " +
            "AND status IN ('pending', 'active') " +
            "ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1",
            EntityMappers.MapGoal,
            new SqliteParameter("@sid", sessionId));
        return entity == null ? null : GoalRow.FromEntity(entity);
    }

    public static GoalRow? GetByGoalId(string goalId, string sessionId)
    {
        var entity = DbClient.GetClient().QueryFirstOrDefault(
            "SELECT * FROM goals WHERE goal_id = @gid AND session_id = @sid LIMIT 1",
            EntityMappers.MapGoal,
            new SqliteParameter("@gid", goalId),
            new SqliteParameter("@sid", sessionId));
        return entity == null ? null : GoalRow.FromEntity(entity);
    }

    public static List<GoalRow> ListActiveGoals()
    {
        return DbClient.GetClient()
            .Query(
                "SELECT * FROM goals WHERE status = 'active' ORDER BY updated_at DESC",
                EntityMappers.MapGoal)
            .Select(GoalRow.FromEntity)
            .ToList();
    }

    private const string HistoryOrderSql =
        "ORDER BY CASE WHEN status IN ('pending', 'active') THEN 0 ELSE 1 END, updated_at DESC";
    private const string HistoryListSql = "SELECT * FROM goals " + HistoryOrderSql;
}
