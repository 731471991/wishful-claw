const fs = require('fs');
const path = 'D:/claw/wishful-claw/src/runtime/WishfulClaw.Agent/Goal/GoalOrchestratorLoop.cs';
let content = fs.readFileSync(path, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// Replace the EvaluateResultAsync method with LLM-based evaluation
const oldMethod = `    private static async Task<EvaluationResult> EvaluateResultAsync(
        GoalContext goal,
        GoalPlanItem plan,
        PlanExecutionResult result,
        JsonElement parameters,
        AgentRuntimeRunState parentState,
        IWorkerRequestContext context,
        CancellationToken ct)
    {
        // For Plan 3/4 basic: if the plan completed without 429, consider it satisfied
        // Plan 8 (integration) will add real LLM evaluation
        if (result.Status == "completed" && !string.IsNullOrEmpty(result.Summary))
        {
            return new EvaluationResult
            {
                Satisfied = true,
                Reasoning = "Plan executed successfully",
                NextAction = "proceed"
            };
        }

        // If failed, not satisfied
        return new EvaluationResult
        {
            Satisfied = false,
            Reasoning = result.Error ?? "Plan execution did not complete",
            NextAction = "retry"
        };
    }`;

const newMethod = `    private static async Task<EvaluationResult> EvaluateResultAsync(
        GoalContext goal,
        GoalPlanItem plan,
        PlanExecutionResult result,
        JsonElement parameters,
        AgentRuntimeRunState parentState,
        IWorkerRequestContext context,
        CancellationToken ct)
    {
        // Use LLM-based evaluation via sub-agent
        var executionResultText = !string.IsNullOrEmpty(result.Summary)
            ? result.Summary
            : result.Error ?? "No output";

        return await EvaluateViaLlmAsync(
            goal.GoalText,
            plan.Title,
            plan.Description,
            executionResultText,
            parameters,
            parentState,
            context,
            ct);
    }`;

if (content.includes(oldMethod)) {
  content = content.replace(oldMethod, newMethod);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Done - EvaluateResultAsync updated to use LLM evaluation');
} else {
  console.error('Old method not found');
  // Debug
  const idx = content.indexOf('EvaluateResultAsync');
  console.log('Found at index:', idx);
  if (idx >= 0) {
    console.log('Context:', JSON.stringify(content.substring(idx, idx + 300)));
  }
  process.exit(1);
}
