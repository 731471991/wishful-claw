using System.Text.Encodings.Web;
using System.Text.Json;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent;

/// <summary>
/// State file read/write for plan mode — .state.json persistence.
/// </summary>
public static partial class AgentRuntimePlanExecutor
{
    private static async Task<PlanState?> ReadStateFileAsync(string planFilePath, CancellationToken cancellationToken)
    {
        var stateFilePath = GetStateFilePath(planFilePath);
        if (!File.Exists(stateFilePath)) return null;
        try
        {
            var json = await File.ReadAllTextAsync(stateFilePath, cancellationToken);
            return JsonSerializer.Deserialize<PlanState>(json);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            WorkerLog.Warn($"Failed to read plan state file: {ex.Message}");
            return null;
        }
    }

    private static async Task WriteStateFileAsync(
        string planFilePath,
        string planId,
        string title,
        string status,
        List<PlanStep> steps,
        CancellationToken cancellationToken)
    {
        var stateFilePath = GetStateFilePath(planFilePath);
        var state = new PlanState
        {
            PlanId = planId,
            Title = title,
            Status = status,
            Steps = steps,
            UpdatedAt = Now()
        };
        var json = JsonSerializer.Serialize(state, new JsonSerializerOptions
        {
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            WriteIndented = true
        });

        // Retry up to 3 times to handle file lock contention from rapid UpdatePlanStep calls
        for (var attempt = 0; attempt < 3; attempt++)
        {
            try
            {
                await File.WriteAllTextAsync(stateFilePath, json, cancellationToken);
                return;
            }
            catch (IOException) when (attempt < 2 && !cancellationToken.IsCancellationRequested)
            {
                await Task.Delay(100 * (attempt + 1), cancellationToken);
            }
        }
        // Final attempt — let it throw if it fails
        await File.WriteAllTextAsync(stateFilePath, json, cancellationToken);
    }
}

// ── Plan State Model (for .state.json) ──

internal sealed class PlanState
{
    public string PlanId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = "drafting";
    public List<PlanStep> Steps { get; set; } = [];
    public long UpdatedAt { get; set; }
}

internal sealed class PlanStep
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public string? Result { get; set; }
}
