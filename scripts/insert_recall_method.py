import re

path = r"F:\claw\wishful-claw\src\runtime\WishfulClaw.Worker\AgentRuntime\AgentLoop.cs"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Find the marker "    // ── Provider dispatch ──" and insert before it
marker = "    // ── Provider dispatch ──"
method = '''
    // ── Memory recall injection ──

    private static async Task TryInjectMemoryRecallAsync(
        JsonElement parameters,
        List<AgentRuntimeChatMessage> conversation,
        AgentRuntimeRunState state,
        IWorkerRequestContext context)
    {
        try
        {
            var memorySearch = Tools.ToolModuleState.MemorySearch;
            if (memorySearch is null)
                return;

            var userMessage = conversation
                .Where(m => m.Role == "user")
                .Select(m => m.Text)
                .LastOrDefault();

            if (string.IsNullOrWhiteSpace(userMessage))
                return;

            var workingFolder = JsonHelpers.GetString(parameters, "workingFolder");
            var scope = !string.IsNullOrWhiteSpace(workingFolder)
                ? $"project:{workingFolder}"
                : "global";

            var recall = new Memory.MemoryRecallService(
                memorySearch,
                new Memory.ContextBudgetPlanner());

            var injected = await recall.TryInjectRecallAsync(
                userMessage, scope, maxChars: 4000,
                state.CancellationToken);

            if (!string.IsNullOrWhiteSpace(injected))
            {
                conversation.Insert(1, AgentRuntimeChatMessage.User(injected));
                WorkerLog.Info($"memory recall injected runId={state.RunId} length={injected.Length}");
            }
            else
            {
                WorkerLog.Debug($"memory recall: no relevant memories found runId={state.RunId}");
            }
        }
        catch (OperationCanceledException) when (state.CancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            WorkerLog.Warn($"memory recall injection failed runId={state.RunId} error={ex.GetType().Name}: {ex.Message}");
        }
    }

'''

content = content.replace(marker, method + marker, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Method inserted successfully")
