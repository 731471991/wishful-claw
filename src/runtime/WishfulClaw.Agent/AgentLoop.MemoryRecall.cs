using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;
using WishfulClaw.Workspace.Memory;

namespace WishfulClaw.Agent;

/// <summary>
/// Memory recall injection — runs on iteration 1 to search memories
/// and inject relevant results as an untrusted user message.
/// </summary>
internal static partial class AgentLoop
{
    /// <summary>
    /// Searches memory for relevant entries based on the latest user message
    /// and injects them into the conversation as untrusted reference data.
    /// </summary>
    private static async Task TryInjectMemoryRecallAsync(
        JsonElement parameters,
        List<AgentRuntimeChatMessage> conversation,
        AgentRuntimeRunState state,
        IWorkerRequestContext context)
    {
        try
        {
            var memorySearch = ToolModuleState.MemorySearch;
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

            var recall = new MemoryRecallService(
                memorySearch,
                new ContextBudgetPlanner());

            var injected = await recall.TryInjectRecallAsync(
                userMessage, scope, maxChars: 4000,
                state.CancellationToken);

            if (!string.IsNullOrWhiteSpace(injected))
            {
                // Inject as prefix to the last user message (same pattern as
                // InjectTimestampPrefix) to preserve prefix cache stability.
                // Inserting at index 1 would shift the entire conversation and
                // break DeepSeek/Anthropic prompt caching when recall changes.
                var recallBlock = $"\n\n<memory-recall>\n{injected}\n</memory-recall>";
                for (var i = conversation.Count - 1; i >= 0; i--)
                {
                    if (conversation[i].Role == "user" && conversation[i].ToolResults.Count == 0)
                    {
                        conversation[i] = conversation[i] with { Text = conversation[i].Text + recallBlock };
                        break;
                    }
                }
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
}
