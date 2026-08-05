using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent;

/// <summary>
/// LLM-related operations for GoalOrchestrator.
/// Uses sub-agents to perform LLM calls (goal decomposition, self-evaluation).
/// </summary>
public static partial class GoalOrchestrator
{
    /// <summary>
    /// Decompose a goal into plans using a sub-agent LLM call.
    /// The sub-agent receives the goal text and returns a JSON array of plans.
    /// </summary>
    private static async Task<GoalDecompositionResult> DecomposeGoalAsync(
        string goalText,
        JsonElement parameters,
        AgentRuntimeRunState parentState,
        IWorkerRequestContext context,
        CancellationToken cancellationToken)
    {
        var prompt = BuildDecompositionPrompt(goalText);

        var input = CreateTaskInput(prompt, "Goal Decomposition");
        var toolCallId = $"goal-decompose-{Guid.NewGuid():N}";

        var result = await SubAgentExecutor.ExecuteAsync(
            input, parameters, parentState, context, toolCallId);

        var output = result.Content?.Trim() ?? string.Empty;

        // Parse JSON array from output
        try
        {
            // Strip markdown code fences if present
            if (output.StartsWith("```"))
            {
                var firstNewline = output.IndexOf('\n');
                if (firstNewline >= 0)
                    output = output.Substring(firstNewline + 1);
                if (output.EndsWith("```"))
                    output = output.Substring(0, output.Length - 3);
                output = output.Trim();
            }

            var plans = new List<GoalPlanItem>();
            using var doc = JsonDocument.Parse(output);
            foreach (var element in doc.RootElement.EnumerateArray())
            {
                var planId = $"plan-{Guid.NewGuid():N}".Substring(0, 16);
                plans.Add(new GoalPlanItem
                {
                    PlanId = planId,
                    Title = element.TryGetProperty("title", out var t) ? t.GetString() ?? "Untitled" : "Untitled",
                    Description = element.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "",
                    Status = "pending"
                });
            }

            return new GoalDecompositionResult
            {
                Success = plans.Count > 0,
                Plans = plans,
                Error = plans.Count == 0 ? "No plans generated" : null
            };
        }
        catch (Exception ex)
        {
            return new GoalDecompositionResult
            {
                Success = false,
                Error = $"Failed to parse decomposition result: {ex.Message}. Raw output: {output.Substring(0, Math.Min(500, output.Length))}"
            };
        }
    }

    internal static string BuildPlanExecutionPrompt(string title, string description)
    {
        return "You are a Plan Execution Agent working in Goal mode (autonomous, no user confirmation).\n\n" +
               "Plan: " + title + "\n" +
               "Description: " + description + "\n\n" +
               "Enter Plan Mode to explore the codebase, create a plan, self-confirm it, and execute it to completion.\n" +
               "Steps:\n" +
               "1. Call EnterPlanMode to enter plan mode.\n" +
               "2. Explore the codebase relevant to this plan.\n" +
               "3. Write the plan file with specific steps.\n" +
               "4. Call SubmitPlanReview to self-confirm the plan (Goal mode — no user confirmation needed).\n" +
               "5. Execute each step: call UpdatePlanStep + use Task tool to dispatch sub-agents.\n" +
               "6. Run verification (compile, test).\n" +
               "7. Call ExitPlanMode with result='completed' or result='failed'.\n\n" +
               "Work autonomously. Do not wait for user input. Complete the plan and report results.";
    }

    private static string BuildDecompositionPrompt(string goalText)
    {
        return "You are a Goal Decomposition Agent. Break the following goal into a series of sequential plans.\n\n" +
               "Goal: " + goalText + "\n\n" +
               "For each plan, provide:\n" +
               "- title: A short title for the plan\n" +
               "- description: What the plan should accomplish (detailed enough for a sub-agent to execute)\n\n" +
               "Return ONLY a JSON array (no markdown, no explanation). Example:\n" +
               "[\n" +
               "  {\"title\": \"Setup\", \"description\": \"Initialize project structure and dependencies\"},\n" +
               "  {\"title\": \"Implementation\", \"description\": \"Implement core features\"}\n" +
               "]\n\n" +
               "Break the goal into 2-6 plans. Each plan should be a meaningful unit of work.";
    }

    /// <summary>
    /// Create a Task tool input JSON for spawning a sub-agent.
    /// </summary>
    private static JsonElement CreateTaskInput(string prompt, string description)
    {
        var promptJson = JsonSerializer.Serialize(prompt);
        var descJson = JsonSerializer.Serialize(description);
        var json = "{\"subagent_type\":\"custom\",\"description\":" + descJson + ",\"prompt\":" + promptJson + ",\"background\":false}";
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }
}
