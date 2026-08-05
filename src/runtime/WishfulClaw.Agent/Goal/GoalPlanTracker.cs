using System.Text;

namespace WishfulClaw.Agent;

/// <summary>
/// Lightweight plan tracker for Goal mode sub-agents.
/// Manages plan files as archive records — no user confirmation, no heavy state machine.
/// 
/// File layout:
///   .wishful-claw/goals/{goalId}/plans/{planId}.md  — plan archive (Markdown)
///   
/// Status flow: pending → executing → completed | failed
/// 
/// This is separate from AgentRuntimePlanExecutor (plan mode for human-in-the-loop).
/// </summary>
public static class GoalPlanTracker
{
    private const string GoalDirectoryName = ".wishful-claw/goals";

    // ─── Path Helpers ───

    public static string GetPlanDir(string workingFolder, string goalId)
    {
        return Path.Combine(workingFolder, GoalDirectoryName, goalId, "plans");
    }

    public static string GetPlanFilePath(string workingFolder, string goalId, string planId)
    {
        return Path.Combine(GetPlanDir(workingFolder, goalId), $"{planId}.md");
    }

    // ─── Plan Lifecycle ───

    /// <summary>
    /// Create a plan file when execution starts.
    /// Called by the orchestrator before spawning a sub-agent.
    /// </summary>
    public static void StartPlan(
        string workingFolder,
        string goalId,
        GoalPlanItem plan,
        List<string>? steps = null)
    {
        if (string.IsNullOrEmpty(workingFolder)) return;

        var dir = GetPlanDir(workingFolder, goalId);
        Directory.CreateDirectory(dir);
        var filePath = GetPlanFilePath(workingFolder, goalId, plan.PlanId);

        var sb = new StringBuilder();
        sb.AppendLine($"# Plan: {plan.Title}");
        sb.AppendLine();
        sb.AppendLine($"- **Plan ID**: {plan.PlanId}");
        sb.AppendLine($"- **Goal ID**: {goalId}");
        sb.AppendLine($"- **Status**: executing");
        sb.AppendLine($"- **Started**: {DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm:ss} UTC");
        if (plan.RetryCount > 0)
            sb.AppendLine($"- **Retry**: {plan.RetryCount}");
        sb.AppendLine();
        sb.AppendLine("## Description");
        sb.AppendLine();
        sb.AppendLine(plan.Description);
        sb.AppendLine();

        if (steps != null && steps.Count > 0)
        {
            sb.AppendLine("## Steps");
            sb.AppendLine();
            for (int i = 0; i < steps.Count; i++)
            {
                sb.AppendLine($"{i + 1}. [ ] {steps[i]}");
            }
            sb.AppendLine();
        }

        sb.AppendLine("## Execution Log");
        sb.AppendLine();
        sb.AppendLine($"<!-- Sub-agent: document your work below. Use regular write tool to append. -->");
        sb.AppendLine();

        File.WriteAllText(filePath, sb.ToString());
    }

    /// <summary>
    /// Update a plan file's status and result.
    /// Called by the orchestrator after sub-agent execution + evaluation.
    /// </summary>
    public static void FinishPlan(
        string workingFolder,
        string goalId,
        GoalPlanItem plan)
    {
        if (string.IsNullOrEmpty(workingFolder)) return;

        var filePath = GetPlanFilePath(workingFolder, goalId, plan.PlanId);
        if (!File.Exists(filePath))
        {
            // Plan file wasn't created (StartPlan not called), create it now
            StartPlan(workingFolder, goalId, plan);
        }

        var content = File.ReadAllText(filePath);

        // Update status line
        content = UpdateField(content, "**Status**:", plan.Status);
        // Update result if available
        if (!string.IsNullOrEmpty(plan.ResultSummary))
        {
            content = UpdateField(content, "**Result**:", plan.ResultSummary);
        }

        // Append completion footer
        var sb = new StringBuilder(content);
        sb.AppendLine();
        sb.AppendLine("---");
        sb.AppendLine($"- **Finished**: {DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm:ss} UTC");
        sb.AppendLine($"- **Final Status**: {plan.Status}");
        if (!string.IsNullOrEmpty(plan.ResultSummary))
            sb.AppendLine($"- **Result**: {plan.ResultSummary}");
        if (plan.RetryCount > 0)
            sb.AppendLine($"- **Total Retries**: {plan.RetryCount}");

        File.WriteAllText(filePath, sb.ToString());
    }

    /// <summary>
    /// Append a log entry to the plan file.
    /// Can be called by the orchestrator during execution (e.g., backoff events, retries).
    /// </summary>
    public static void AppendLog(
        string workingFolder,
        string goalId,
        string planId,
        string message)
    {
        if (string.IsNullOrEmpty(workingFolder)) return;

        var filePath = GetPlanFilePath(workingFolder, goalId, planId);
        if (!File.Exists(filePath)) return;

        var timestamp = DateTimeOffset.UtcNow.ToString("HH:mm:ss");
        var logLine = $"- [{timestamp}] {message}";
        File.AppendAllText(filePath, logLine + Environment.NewLine);
    }

    // ─── Helpers ───

    private static string UpdateField(string content, string fieldMarker, string newValue)
    {
        var lines = content.Split('\n');
        for (int i = 0; i < lines.Length; i++)
        {
            if (lines[i].TrimStart().StartsWith(fieldMarker))
            {
                lines[i] = $"- {fieldMarker} {newValue}";
                break;
            }
        }
        return string.Join('\n', lines);
    }
}
