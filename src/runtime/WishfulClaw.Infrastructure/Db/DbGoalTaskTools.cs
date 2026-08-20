/*
 * Wishful Claw 自研：Goal 编排每轮执行记录（goal_plan_tasks）读写工具。
 * 一行 = 一个计划的一轮执行（round = retry + 1）。
 */

using System.Text.Json;
using Microsoft.Data.Sqlite;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Infrastructure.Db;

public static partial class DbGoalTaskTools
{
    // ─── Worker 端点：查询 ───

    public static WorkerResponse ListPlanTasks(JsonElement parameters)
    {
        try
        {
            DbClient.EnsureInitialized(parameters);
            var db = DbClient.GetClient(parameters);
            var sessionId = GetString(parameters, "sessionId") ?? throw new InvalidOperationException("sessionId is required");
            var goalId = GetString(parameters, "goalId") ?? throw new InvalidOperationException("goalId is required");

            var entities = db.Query(
                "SELECT * FROM goal_plan_tasks WHERE session_id = @sid AND goal_id = @gid ORDER BY round ASC, id ASC",
                EntityMappers.MapGoalPlanTask,
                new SqliteParameter("@sid", sessionId),
                new SqliteParameter("@gid", goalId));

            var rows = entities.Select(GoalPlanTaskRow.FromEntity).ToList();
            return WorkerResponse.Json(rows, InfrastructureJsonContext.Default.ListGoalPlanTaskRow);
        }
        catch (Exception ex)
        {
            WorkerLog.Error($"DbGoalTaskTools.ListPlanTasks failed: {ex.Message}");
            return WorkerResponse.Error(ex.Message);
        }
    }

    // ─── Agent 编排层内部调用（非端点） ───

    /// <summary>
    /// Insert a new executing round. Called by the orchestrator before a sub-agent run.
    /// </summary>
    public static long InsertPlanTask(
        JsonElement parameters,
        string sessionId,
        string goalId,
        string planId,
        string? originalPlanId,
        string? planTitle,
        int round,
        string? description,
        List<string>? steps)
    {
        DbClient.EnsureInitialized(parameters);
        var db = DbClient.GetClient(parameters);
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        string? stepsJson = null;
        if (steps is { Count: > 0 })
        {
            using var buffer = new MemoryStream();
            using (var writer = new Utf8JsonWriter(buffer))
            {
                writer.WriteStartArray();
                foreach (var step in steps)
                    writer.WriteStringValue(step);
                writer.WriteEndArray();
            }
            stepsJson = System.Text.Encoding.UTF8.GetString(buffer.ToArray());
        }

        // Reuse an unfinished row for the same round (chain-root plan match) so a
        // paused/interrupted goal that resumes does not create a duplicate
        // "executing" entry for the same round. started_at is refreshed to now
        // because the round is being re-executed from scratch.
        var chainRoot = originalPlanId ?? planId;
        var existingId = db.QueryScalar<long?>(
            "SELECT id FROM goal_plan_tasks " +
            "WHERE session_id = @sid AND goal_id = @gid AND round = @round " +
            "AND status = 'executing' AND finished_at IS NULL " +
            "AND COALESCE(original_plan_id, plan_id) = @root " +
            "ORDER BY id DESC LIMIT 1",
            new SqliteParameter("@sid", sessionId),
            new SqliteParameter("@gid", goalId),
            new SqliteParameter("@round", round),
            new SqliteParameter("@root", chainRoot));
        if (existingId is > 0)
        {
            db.Execute(
                "UPDATE goal_plan_tasks SET started_at = @started, description = @desc, steps_json = @steps WHERE id = @id",
                new SqliteParameter("@started", now),
                new SqliteParameter("@desc", (object?)description ?? DBNull.Value),
                new SqliteParameter("@steps", (object?)stepsJson ?? DBNull.Value),
                new SqliteParameter("@id", existingId.Value));
            return existingId.Value;
        }

        db.Execute(
            "INSERT INTO goal_plan_tasks " +
            "(session_id, goal_id, plan_id, original_plan_id, plan_title, round, status, description, steps_json, started_at) " +
            "VALUES (@sid, @gid, @pid, @opid, @title, @round, 'executing', @desc, @steps, @started)",
            new SqliteParameter("@sid", sessionId),
            new SqliteParameter("@gid", goalId),
            new SqliteParameter("@pid", planId),
            new SqliteParameter("@opid", (object?)originalPlanId ?? DBNull.Value),
            new SqliteParameter("@title", (object?)planTitle ?? DBNull.Value),
            new SqliteParameter("@round", round),
            new SqliteParameter("@desc", (object?)description ?? DBNull.Value),
            new SqliteParameter("@steps", (object?)stepsJson ?? DBNull.Value),
            new SqliteParameter("@started", now));

        return db.QueryScalar<long>("SELECT last_insert_rowid()");
    }

    /// <summary>
    /// Mark the current round as completed/failed with execution summary + evaluation.
    /// </summary>
    public static void FinishPlanTask(
        JsonElement parameters,
        long taskId,
        string status,
        string? summary,
        string? evaluationReasoning,
        bool? evaluationSatisfied)
    {
        DbClient.EnsureInitialized(parameters);
        var db = DbClient.GetClient(parameters);
        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        db.Execute(
            "UPDATE goal_plan_tasks SET status = @status, summary = @summary, " +
            "evaluation_reasoning = @reasoning, evaluation_satisfied = @satisfied, finished_at = @finished " +
            "WHERE id = @id",
            new SqliteParameter("@status", status),
            new SqliteParameter("@summary", (object?)summary ?? DBNull.Value),
            new SqliteParameter("@reasoning", (object?)evaluationReasoning ?? DBNull.Value),
            new SqliteParameter("@satisfied", evaluationSatisfied is null ? DBNull.Value : (evaluationSatisfied.Value ? 1 : 0)),
            new SqliteParameter("@finished", now),
            new SqliteParameter("@id", taskId));
    }

    private static string? GetString(JsonElement parameters, string name)
    {
        if (parameters.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String)
            return value.GetString();
        return null;
    }
}
