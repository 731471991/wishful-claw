using Microsoft.Data.Sqlite;

namespace WishfulClaw.Infrastructure.Db;

public static partial class DbClient
{
    private static void EnsureGoalHistorySchema()
    {
        _db!.ExecuteInTransaction((connection, transaction) =>
        {
            _db.Execute(
                connection,
                transaction,
                "DROP INDEX IF EXISTS ux_goals_session_id");
            _db.Execute(
                connection,
                transaction,
                "UPDATE goals SET project_id = (" +
                "SELECT sessions.project_id FROM sessions WHERE sessions.id = goals.session_id) " +
                "WHERE project_id IS NULL AND EXISTS (" +
                "SELECT 1 FROM sessions WHERE sessions.id = goals.session_id)");

            ArchiveConflictingCurrentGoals(connection, transaction);

            _db.Execute(
                connection,
                transaction,
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_goals_session_current " +
                "ON goals(session_id) WHERE status IN ('pending', 'active')");
            _db.Execute(
                connection,
                transaction,
                "CREATE INDEX IF NOT EXISTS ix_goals_project_updated_goal " +
                "ON goals(project_id, updated_at DESC, goal_id DESC)");
            _db.Execute(
                connection,
                transaction,
                "CREATE INDEX IF NOT EXISTS ix_goals_session_updated_goal " +
                "ON goals(session_id, updated_at DESC, goal_id DESC)");
            _db.Execute(
                connection,
                transaction,
                "CREATE INDEX IF NOT EXISTS ix_goal_events_goal_created_id " +
                "ON goal_events(goal_id, created_at DESC, id DESC)");
        });
    }

    private static void ArchiveConflictingCurrentGoals(
        SqliteConnection connection,
        SqliteTransaction transaction)
    {
        var conflicts = new List<GoalMigrationConflict>();
        using (var command = connection.CreateCommand())
        {
            command.Transaction = transaction;
            command.CommandText =
                "SELECT goal_id, session_id FROM goals AS candidate " +
                "WHERE candidate.status IN ('pending', 'active') AND EXISTS (" +
                "SELECT 1 FROM goals AS newer " +
                "WHERE newer.session_id = candidate.session_id " +
                "AND newer.status IN ('pending', 'active') " +
                "AND (newer.updated_at > candidate.updated_at " +
                "OR (newer.updated_at = candidate.updated_at AND newer.created_at > candidate.created_at) " +
                "OR (newer.updated_at = candidate.updated_at AND newer.created_at = candidate.created_at " +
                "AND newer.rowid > candidate.rowid)))";
            using var reader = command.ExecuteReader();
            while (reader.Read())
            {
                conflicts.Add(new GoalMigrationConflict(
                    reader.GetString(0),
                    reader.GetString(1)));
            }
        }

        var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        foreach (var conflict in conflicts)
        {
            _db!.Execute(
                connection,
                transaction,
                "UPDATE goals SET status = 'aborted', updated_at = @updatedAt " +
                "WHERE goal_id = @goalId AND session_id = @sessionId " +
                "AND status IN ('pending', 'active')",
                new SqliteParameter("@updatedAt", now),
                new SqliteParameter("@goalId", conflict.GoalId),
                new SqliteParameter("@sessionId", conflict.SessionId));
            _db.Execute(
                connection,
                transaction,
                "INSERT INTO goal_events " +
                "(session_id, goal_id, event_type, message, metadata_json, created_at) " +
                "VALUES (@sessionId, @goalId, 'aborted', " +
                "'Goal archived during history migration because a newer current goal exists', NULL, @createdAt)",
                new SqliteParameter("@sessionId", conflict.SessionId),
                new SqliteParameter("@goalId", conflict.GoalId),
                new SqliteParameter("@createdAt", now));
        }
    }

    private sealed record GoalMigrationConflict(string GoalId, string SessionId);
}
