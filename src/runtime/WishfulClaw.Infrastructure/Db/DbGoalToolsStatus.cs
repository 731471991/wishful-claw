using Microsoft.Data.Sqlite;

namespace WishfulClaw.Infrastructure.Db;

public static partial class DbGoalTools
{
    public static GoalRow? SetStatusByGoalId(
        string goalId,
        string sessionId,
        string expectedStatus,
        string status,
        string eventMessage)
    {
        var db = DbClient.GetClient();
        var entity = db.ExecuteInTransaction((connection, transaction) =>
        {
            var current = db.QueryFirstOrDefault(
                connection,
                transaction,
                "SELECT * FROM goals WHERE goal_id = @goalId AND session_id = @sessionId LIMIT 1",
                EntityMappers.MapGoal,
                new SqliteParameter("@goalId", goalId),
                new SqliteParameter("@sessionId", sessionId));
            if (current == null || !string.Equals(current.Status, expectedStatus, StringComparison.Ordinal))
                return null;

            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var changed = db.Execute(
                connection,
                transaction,
                "UPDATE goals SET status = @status, updated_at = @updatedAt " +
                "WHERE goal_id = @goalId AND session_id = @sessionId AND status = @expectedStatus",
                new SqliteParameter("@status", status),
                new SqliteParameter("@updatedAt", now),
                new SqliteParameter("@goalId", goalId),
                new SqliteParameter("@sessionId", sessionId),
                new SqliteParameter("@expectedStatus", expectedStatus));
            if (changed != 1)
                return null;

            InsertEvent(
                db,
                connection,
                transaction,
                sessionId,
                goalId,
                StatusEventType(status),
                eventMessage,
                null,
                now);
            current.Status = status;
            current.UpdatedAt = now;
            return current;
        });

        return entity == null ? null : GoalRow.FromEntity(entity);
    }

    public static int AbortInterruptedPendingGoals()
    {
        var db = DbClient.GetClient();
        return db.ExecuteInTransaction((connection, transaction) =>
        {
            var pending = new List<GoalEntity>();
            using (var command = connection.CreateCommand())
            {
                command.Transaction = transaction;
                command.CommandText = "SELECT * FROM goals WHERE status = 'pending'";
                using var reader = command.ExecuteReader();
                while (reader.Read())
                    pending.Add(EntityMappers.MapGoal(reader));
            }

            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            foreach (var goal in pending)
            {
                db.Execute(
                    connection,
                    transaction,
                    "UPDATE goals SET status = 'aborted', updated_at = @updatedAt " +
                    "WHERE goal_id = @goalId AND session_id = @sessionId AND status = 'pending'",
                    new SqliteParameter("@updatedAt", now),
                    new SqliteParameter("@goalId", goal.GoalId),
                    new SqliteParameter("@sessionId", goal.SessionId));
                InsertEvent(
                    db,
                    connection,
                    transaction,
                    goal.SessionId,
                    goal.GoalId,
                    "aborted",
                    "Pending goal confirmation was interrupted by worker restart",
                    null,
                    now);
            }
            return pending.Count;
        });
    }

    private static string StatusEventType(string status)
        => status switch
        {
            "active" => "confirmed",
            "complete" => "completed",
            "failed" => "failed",
            "aborted" => "aborted",
            _ => "status_changed"
        };
}
