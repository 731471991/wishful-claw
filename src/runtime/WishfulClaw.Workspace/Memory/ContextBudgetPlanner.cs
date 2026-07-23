namespace WishfulClaw.Workspace.Memory;

/// <summary>
/// Context budget planner — limits memory injection size.
/// Takes the minimum of token-based and char-based limits.
/// Adapted from OpenClaw.net's ContextBudgetPlanner.
/// </summary>
public sealed class ContextBudgetPlanner : IContextBudgetPlanner
{
    private const int TokenCharEstimate = 4;

    public int PlanBudget(int maxTokens, int maxChars)
    {
        var tokenBased = Math.Max(1, maxTokens) * TokenCharEstimate;
        return Math.Min(tokenBased, Math.Max(1, maxChars));
    }
}
