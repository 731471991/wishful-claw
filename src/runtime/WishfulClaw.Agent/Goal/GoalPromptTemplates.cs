namespace WishfulClaw.Agent;

/// <summary>
/// Prompt templates for GoalOrchestrator.
/// Extracted from GoalOrchestratorLLM.cs for maintainability.
/// </summary>
public static class GoalPromptTemplates
{
    /// <summary>
    /// System prompt for goal decomposition sub-agent.
    /// </summary>
    public const string DecompositionSystemPrompt = @"You are a Goal Decomposition Agent. Your task is to break a high-level goal into a series of sequential, actionable plans that can be executed by sub-agents.

Rules:
- Break the goal into 2-6 plans, each a meaningful unit of work.
- Plans must be sequential (plan N depends on plan N-1 being done).
- Each plan title should be concise (3-8 words).
- Each plan description must be detailed enough for a sub-agent to execute without further context.
- Include verification criteria in the description (e.g., 'compile succeeds', 'tests pass').
- If the goal involves code changes, include exploration and verification plans.
- Do not create plans that are too small (single file edit) or too large (entire feature).

Return ONLY a JSON array. No markdown, no explanation.";

    /// <summary>
    /// Build the decomposition user prompt with goal text and optional project context.
    /// </summary>
    public static string BuildDecompositionUserPrompt(string goalText, string? workingFolder = null)
    {
        var context = !string.IsNullOrEmpty(workingFolder)
            ? $"\nProject working folder: {workingFolder}\n"
            : "\n";

        return $"Goal: {goalText}{context}\n" +
               "For each plan, provide:\n" +
               "- title: A short title for the plan (3-8 words)\n" +
               "- description: What the plan should accomplish, detailed enough for autonomous execution. Include verification criteria.\n\n" +
               "Return ONLY a JSON array. Example:\n" +
               "[\n" +
               "  {\"title\": \"Setup Dependencies\", \"description\": \"Install required packages and configure the build. Verify: dotnet build succeeds with zero errors.\"},\n" +
               "  {\"title\": \"Implement Core Feature\", \"description\": \"Implement the main feature logic. Verify: unit tests pass and code compiles.\"}\n" +
               "]";
    }

    /// <summary>
    /// System prompt for plan execution sub-agent in Goal mode.
    /// </summary>
    public const string ExecutionSystemPrompt = @"You are a Plan Execution Agent working in Goal mode (autonomous, no user confirmation needed).

Your role:
- Enter Plan Mode, explore the codebase, create a detailed plan, self-confirm it, and execute to completion.
- Work autonomously — do not wait for user input or confirmation.
- Use available tools to explore files, write code, run commands, and verify results.
- After execution, provide a clear summary of what was done and whether verification passed.

Execution steps:
1. Call EnterPlanMode to enter plan mode.
2. Explore the codebase relevant to this plan.
3. Write the plan file with specific, actionable steps.
4. Call SubmitPlanReview to self-confirm the plan (Goal mode — auto-confirmed, no user review).
5. Execute each step: call UpdatePlanStep + use Task tool to dispatch sub-agents.
6. Run verification (compile, test, type-check).
7. Call ExitPlanMode with result='completed' or result='failed'.

If a step fails, attempt to fix it before marking the plan as failed.
Report the final status clearly in your output.";

    /// <summary>
    /// Build the execution user prompt for a specific plan.
    /// </summary>
    public static string BuildExecutionUserPrompt(string title, string description)
    {
        return $"Plan: {title}\n\nDescription:\n{description}\n\n" +
               "Execute this plan autonomously. Enter Plan Mode, create a detailed plan, self-confirm it, execute all steps, and verify. " +
               "Report the final result (completed/failed) with a summary.";
    }

    /// <summary>
    /// System prompt for self-check evaluation sub-agent.
    /// </summary>
    public const string EvaluationSystemPrompt = @"You are a Goal Evaluation Agent. Your task is to evaluate whether a plan's execution result satisfies the plan's requirements.

Evaluation criteria:
- Did the sub-agent complete all described steps?
- Did verification pass (compile, tests, etc.)?
- Is the result aligned with the plan's description and the overall goal?

Return a JSON object with:
- satisfied: true/false — whether the plan's requirements are met
- reasoning: brief explanation of the evaluation
- nextAction: 'proceed' (satisfied), 'retry' (try again with same plan), or 'adjust' (modify plan description and retry)
- adjustedDescription: (only if nextAction='adjust') a revised plan description

Return ONLY a JSON object. No markdown, no explanation.";

    /// <summary>
    /// Build the evaluation user prompt.
    /// </summary>
    public static string BuildEvaluationUserPrompt(
        string goalText,
        string planTitle,
        string planDescription,
        string executionResult)
    {
        return $"Goal: {goalText}\n\n" +
               $"Plan: {planTitle}\n" +
               $"Plan Description: {planDescription}\n\n" +
               $"Execution Result:\n{executionResult}\n\n" +
               "Evaluate whether the plan's requirements are satisfied. " +
               "Return JSON: {\"satisfied\": bool, \"reasoning\": string, \"nextAction\": \"proceed\"|\"retry\"|\"adjust\", \"adjustedDescription\": string?}";
    }
}
