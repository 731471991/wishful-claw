using System.Text.Json;
using WishfulClaw.Agent;
using WishfulClaw.Contracts;
using WishfulClaw.Infrastructure.Db;

namespace WishfulClaw.GoalRegressionTests;

internal static partial class Program
{
    private static void RunLifecycleRegressionSuite(string dbPath)
    {
        var db = DbClient.GetClient();
        db.Execute(
            "INSERT INTO sessions (id, project_id, title, mode, created_at, updated_at) " +
            "VALUES ('session-lifecycle', 'project-a', 'Lifecycle', 'chat', 600, 600)");

        var runStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var releaseRun = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var runCount = 0;
        GoalOrchestrator.OwnedRunOverride = async (_, _, runtimeState, _) =>
        {
            Interlocked.Increment(ref runCount);
            runStarted.TrySetResult();
            await releaseRun.Task.WaitAsync(runtimeState.CancellationToken);
        };

        try
        {
            var confirmContext = new ReverseRequestContext(confirmed: true);
            var confirmedResult = ExecuteCreateGoal(
                dbPath,
                "session-lifecycle",
                "confirm lifecycle",
                confirmContext);
            var confirmedGoalId = confirmedResult
                .GetProperty("goal")
                .GetProperty("goalId")
                .GetString();
            Assert(!string.IsNullOrEmpty(confirmedGoalId),
                "pending confirmation returns the persisted goalId");
            AssertEqual(confirmedGoalId, confirmContext.GoalId,
                "pending confirmation keeps goalId unchanged");
            AssertEqual(GoalStatusValues.Active,
                DbGoalTools.GetByGoalId(confirmedGoalId!, "session-lifecycle")?.Status,
                "pending confirmation persists active");
            runStarted.Task.Wait(TimeSpan.FromSeconds(5));
            AssertEqual(1, Volatile.Read(ref runCount),
                "confirmed goal starts one owned loop");

            var pauseResult = GoalOrchestrator.Pause(confirmedGoalId!);
            Assert(pauseResult.Success && pauseResult.RunState == GoalRunStateValues.Paused,
                "pause keeps the owned loop and enters paused run state");
            var pausedResume = GoalOrchestrator.Resume(
                confirmedGoalId!,
                "session-lifecycle",
                SilentRequestContext.Instance);
            Assert(pausedResume.Success && pausedResume.Action == "resumed",
                "resume wakes the paused owned loop");
            AssertEqual(1, Volatile.Read(ref runCount),
                "pause and resume do not replace the owned loop");

            var duplicateResume = GoalOrchestrator.Resume(
                confirmedGoalId!,
                "session-lifecycle",
                SilentRequestContext.Instance);
            Assert(duplicateResume.Success && duplicateResume.Action == "already_running",
                "resume while running reuses the owned loop");
            AssertEqual(1, Volatile.Read(ref runCount),
                "duplicate resume does not start another loop");

            var abortTask = GoalOrchestrator.AbortAsync(
                confirmedGoalId!,
                SilentRequestContext.Instance);
            Assert(abortTask.Wait(TimeSpan.FromSeconds(5)),
                "active abort waits for the owned loop to exit");
            var abortResult = abortTask.GetAwaiter().GetResult();
            Assert(abortResult.Success && abortResult.Status == GoalStatusValues.Aborted,
                "running active goal cancels through orchestrator");
            Assert(GoalOrchestrator.GetContext(confirmedGoalId!) == null,
                "running cancellation removes runtime context");
            AssertEqual(GoalStatusValues.Aborted,
                DbGoalTools.GetByGoalId(confirmedGoalId!, "session-lifecycle")?.Status,
                "running cancellation persists aborted");

            var discardResult = ExecuteCreateGoal(
                dbPath,
                "session-lifecycle",
                "discard lifecycle",
                new ReverseRequestContext(confirmed: false));
            Assert(discardResult.TryGetProperty("error", out _),
                "pending discard returns a tool error result");
            var discarded = DbGoalTools.GetBySessionId("session-lifecycle");
            Assert(discarded == null,
                "pending discard leaves no current goal");
            AssertEqual(0, AgentRuntimeReverseRequests.PendingCount,
                "pending discard releases the reverse resolver");
            Assert(GoalOrchestrator.GetPendingGoalId("session-lifecycle") == null,
                "pending discard releases pending goal memory");

            var failingContext = new ReverseRequestContext(
                confirmed: true,
                failBackgroundContext: true);
            var failedResult = ExecuteCreateGoal(
                dbPath,
                "session-lifecycle",
                "startup failure",
                failingContext);
            Assert(failedResult.TryGetProperty("error", out _),
                "confirmation startup failure returns a tool error result");
            var failedGoalId = failingContext.GoalId;
            Assert(!string.IsNullOrEmpty(failedGoalId),
                "startup failure still identifies the pending goal");
            AssertEqual(GoalStatusValues.Failed,
                DbGoalTools.GetByGoalId(failedGoalId!, "session-lifecycle")?.Status,
                "confirmation startup failure persists failed");
            Assert(GoalOrchestrator.GetContext(failedGoalId!) == null,
                "confirmation startup failure leaves no active zombie");
            AssertEqual(0, AgentRuntimeReverseRequests.PendingCount,
                "confirmation startup failure releases the reverse resolver");
            Assert(GoalOrchestrator.GetPendingGoalId("session-lifecycle") == null,
                "confirmation startup failure releases pending goal memory");

            foreach (var terminalStatus in new[]
                     {
                         GoalStatusValues.Complete,
                         GoalStatusValues.Failed,
                         GoalStatusValues.Aborted
                     })
            {
                var terminalGoalId = $"goal-terminal-{terminalStatus}";
                DbGoalTools.CreateCurrentGoal(GoalParameters(
                    dbPath,
                    "session-lifecycle",
                    terminalGoalId,
                    $"terminal {terminalStatus}",
                    terminalStatus));
                Assert(!GoalOrchestrator.ResumeFromDb(terminalGoalId, "session-lifecycle")
                        .GetAwaiter()
                        .GetResult(),
                    $"worker restart does not restore {terminalStatus} goals");
                Assert(GoalOrchestrator.GetContext(terminalGoalId) == null,
                    $"{terminalStatus} goal remains outside runtime memory");
            }
        }
        finally
        {
            releaseRun.TrySetResult();
            GoalOrchestrator.OwnedRunOverride = null;
        }
    }

    private static JsonElement ExecuteCreateGoal(
        string dbPath,
        string sessionId,
        string objective,
        IWorkerRequestContext context)
    {
        var state = new AgentRuntimeRunState($"test-{Guid.NewGuid():N}", sessionId);
        state.ReplaceParameters(WorkerJsonHelper.BuildJsonElement(writer =>
        {
            writer.WriteStartObject();
            writer.WriteString("dbPath", dbPath);
            writer.WriteString("sessionId", sessionId);
            writer.WriteEndObject();
        }));
        var call = new AgentRuntimeNativeToolCall(
            $"call-{Guid.NewGuid():N}",
            "create_goal",
            WorkerJsonHelper.BuildJsonElement(writer =>
            {
                writer.WriteStartObject();
                writer.WriteString("objective", objective);
                writer.WriteEndObject();
            }));
        var json = AgentRuntimeGoalExecutor.ExecuteAsync(call, state, context)
            .GetAwaiter()
            .GetResult();
        state.Dispose();
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }
}
