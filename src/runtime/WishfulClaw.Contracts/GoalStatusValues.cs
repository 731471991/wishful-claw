namespace WishfulClaw.Contracts;

public static class GoalStatusValues
{
    public const string Pending = "pending";
    public const string Active = "active";
    public const string Complete = "complete";
    public const string Failed = "failed";
    public const string Aborted = "aborted";

    public static bool IsTerminal(string? status)
        => status is Complete or Failed or Aborted;
}

public static class GoalRunStateValues
{
    public const string Idle = "idle";
    public const string Running = "running";
    public const string Paused = "paused";
}

public static class GoalPlanStatusValues
{
    public const string Pending = "pending";
    public const string Executing = "executing";
    public const string Completed = "completed";
    public const string Failed = "failed";
}
