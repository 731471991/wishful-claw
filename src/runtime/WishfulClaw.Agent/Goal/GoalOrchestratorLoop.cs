using System.Diagnostics;
using System.Text.Json;
using WishfulClaw.Contracts;

namespace WishfulClaw.Agent;

/// <summary>
/// Orchestration loop for GoalOrchestrator.
/// Manages the serial execution of plans via sub-agents.
/// </summary>
public static partial class GoalOrchestrator
{
    /// <summary>
    /// Main orchestration loop. Runs until goal is completed or aborted.
    /// </summary>
    private static async Task RunAsync(
        GoalContext goal,
        JsonElement parameters,
        AgentRuntimeRunState parentState,
        IWorkerRequestContext context)
    {
        var ct = goal.CancellationTokenSource.Token;

        // 1. Decompose goal into plans
        var decomposition = await DecomposeGoalAsync(
            goal.GoalText, parameters, parentState, context, ct);

        if (!decomposition.Success || decomposition.Plans.Count == 0)
        {
            goal.Status = "failed";
            await EmitGoalEventAsync(goal, GoalEventType.GoalCompleted,
                $"Goal failed: {decomposition.Error ?? "No plans generated"}", context);
            return;
        }

        goal.Plans = decomposition.Plans;
        await EmitGoalEventAsync(goal, GoalEventType.GoalStarted,
            $"Goal started: {goal.GoalText}. {goal.Plans.Count} plans generated.", context);

        // Write initial goal state file
        if (!string.IsNullOrEmpty(goal.WorkingFolder))
        {
            GoalFileTools.WriteGoalFile(goal.WorkingFolder, goal.GoalId, goal.GoalText, goal.Plans);
            GoalFileTools.WriteGoalState(goal.WorkingFolder, goal.GoalId, new GoalState
            {
                GoalId = goal.GoalId,
                GoalText = goal.GoalText,
                Status = "active",
                CurrentPlanIndex = -1,
                Plans = goal.Plans,
                CreatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            });
        }

        // 2. Serial execution loop
        for (int i = 0; i < goal.Plans.Count; i++)
        {
            if (ct.IsCancellationRequested)
            {
                goal.Status = "aborted";
                await EmitGoalEventAsync(goal, GoalEventType.GoalAborted, "Goal aborted by user", context);
                break;
            }

            goal.CurrentPlanIndex = i;
            var plan = goal.Plans[i];

            // Execute plan via sub-agent
            var result = await ExecutePlanAsync(
                goal, plan, parameters, parentState, context, ct);

            // Update plan in goal state
            plan.Status = result.Status;
            plan.ResultSummary = result.Summary;
            plan.RetryCount = result.RetryCount;

            if (!string.IsNullOrEmpty(goal.WorkingFolder))
            {
                GoalFileTools.UpdatePlanInState(goal.WorkingFolder, goal.GoalId, plan);
            }

            if (result.Status == "completed")
            {
                await EmitGoalEventAsync(goal, GoalEventType.PlanCompleted,
                    $"Plan {i + 1} completed: {plan.Title}. {result.Summary}", context);
            }
            else
            {
                await EmitGoalEventAsync(goal, GoalEventType.PlanFailed,
                    $"Plan {i + 1} failed: {plan.Title}. {result.Error}", context);
                // For now (Plan 3 basic): skip failed plans and continue
                // Plan 4 will add self-check evaluation and retry logic
            }
        }

        // 3. Goal completion check
        if (goal.Status != "aborted")
        {
            var allCompleted = goal.Plans.All(p => p.Status == "completed");
            if (allCompleted)
            {
                goal.Status = "completed";
                await EmitGoalEventAsync(goal, GoalEventType.GoalCompleted,
                    "All plans completed successfully", context);
            }
            else
            {
                // Some plans failed but we continued — mark as completed with warnings
                goal.Status = "completed";
                var failedCount = goal.Plans.Count(p => p.Status != "completed");
                await EmitGoalEventAsync(goal, GoalEventType.GoalCompleted,
                    $"Goal completed with {failedCount} failed plan(s)", context);
            }
        }

        // Write final goal state
        if (!string.IsNullOrEmpty(goal.WorkingFolder))
        {
            var finalState = GoalFileTools.ReadGoalState(goal.WorkingFolder, goal.GoalId);
            if (finalState != null)
            {
                finalState.Status = goal.Status;
                finalState.CurrentPlanIndex = goal.CurrentPlanIndex;
                finalState.Plans = goal.Plans;
                finalState.UpdatedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                GoalFileTools.WriteGoalState(goal.WorkingFolder, goal.GoalId, finalState);
            }
        }
    }

    /// <summary>
    /// Execute a single plan via sub-agent.
    /// </summary>
    private static async Task<PlanExecutionResult> ExecutePlanAsync(
        GoalContext goal,
        GoalPlanItem plan,
        JsonElement parameters,
        AgentRuntimeRunState parentState,
        IWorkerRequestContext context,
        CancellationToken ct)
    {
        var stopwatch = Stopwatch.StartNew();
        await EmitGoalEventAsync(goal, GoalEventType.PlanStarted,
            $"Plan started: {plan.Title}", context);

        // Build prompt for the sub-agent
        var prompt = BuildPlanExecutionPrompt(plan.Title, plan.Description);

        var input = CreateTaskInput(prompt, $"Plan: {plan.Title}");
        var toolCallId = $"goal-plan-{plan.PlanId}-{Guid.NewGuid():N}";

        // Add goalMode=true to parameters for the sub-agent
        var goalParameters = AddGoalModeToParameters(parameters);

        try
        {
            var result = await SubAgentExecutor.ExecuteAsync(
                input, goalParameters, parentState, context, toolCallId);

            stopwatch.Stop();

            var output = result.Content?.Trim() ?? string.Empty;

            // Check if the output indicates 429 error
            if (output.Contains("429") || output.Contains("Too Many Requests", StringComparison.OrdinalIgnoreCase))
            {
                return new PlanExecutionResult
                {
                    PlanId = plan.PlanId,
                    Title = plan.Title,
                    Status = "failed",
                    Error = output,
                    Is429 = true,
                    RetryCount = plan.RetryCount,
                    ElapsedMs = stopwatch.ElapsedMilliseconds
                };
            }

            // Determine status from output
            var isCompleted = output.Contains("completed", StringComparison.OrdinalIgnoreCase) ||
                              output.Contains("success", StringComparison.OrdinalIgnoreCase);

            return new PlanExecutionResult
            {
                PlanId = plan.PlanId,
                Title = plan.Title,
                Status = isCompleted ? "completed" : "completed", // Default to completed (Plan 4 will add real evaluation)
                Summary = output.Length > 500 ? output.Substring(0, 500) + "..." : output,
                RetryCount = plan.RetryCount,
                ElapsedMs = stopwatch.ElapsedMilliseconds
            };
        }
        catch (OperationCanceledException)
        {
            stopwatch.Stop();
            return new PlanExecutionResult
            {
                PlanId = plan.PlanId,
                Title = plan.Title,
                Status = "failed",
                Error = "Cancelled",
                RetryCount = plan.RetryCount,
                ElapsedMs = stopwatch.ElapsedMilliseconds
            };
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            return new PlanExecutionResult
            {
                PlanId = plan.PlanId,
                Title = plan.Title,
                Status = "failed",
                Error = ex.Message,
                Is429 = ex.Message.Contains("429") || ex.Message.Contains("Too Many Requests", StringComparison.OrdinalIgnoreCase),
                RetryCount = plan.RetryCount,
                ElapsedMs = stopwatch.ElapsedMilliseconds
            };
        }
    }

    /// <summary>
    /// Add goalMode=true to the parameters JSON for sub-agent execution.
    /// </summary>
    private static JsonElement AddGoalModeToParameters(JsonElement parameters)
    {
        // Parse parameters to a mutable JSON, add goalMode, re-serialize
        var json = parameters.GetRawText();
        // Simple string injection — parameters is a JSON object
        if (json.StartsWith("{"))
        {
            // Insert goalMode after the opening brace
            json = "{\"goalMode\":true," + json.Substring(1);
        }
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }
}
