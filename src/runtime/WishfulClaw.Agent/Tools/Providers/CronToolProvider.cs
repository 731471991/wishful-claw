using WishfulClaw.Agent.Tools;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Agent.Tools.Providers;

/// <summary>
/// Registers cron/scheduled task tool definitions.
/// Execution: ToolDispatchRouter → AgentRuntimeCronExecutor (reverse-request to main process).
/// Available in normal and goal modes only (not sub-agent).
/// </summary>
public sealed class CronToolProvider : IToolProvider
{
    public string Category => "cron";

    public void RegisterTools(ToolRegistry registry)
    {
        var cronSchedule = ToolSchemaBuilder.String("Cron schedule (6-field: sec min hour day month weekday) or datetime for one-time task.");
        var cronPrompt = ToolSchemaBuilder.String("Task prompt — pure instruction without timing keywords.");
        var cronTitle = ToolSchemaBuilder.String("Task title for display.");

        registry.Register(new ToolDefinitionPlaceholder(
            "CronAdd",
            "Add a scheduled task (legacy alias for CronCreate).",
            ToolSchemaBuilder.Object(
                new() { ["schedule"] = cronSchedule, ["prompt"] = cronPrompt, ["title"] = cronTitle },
                ["schedule", "prompt"]),
            availableModes: ["normal", "goal", "global"]));

        registry.Register(new ToolDefinitionPlaceholder(
            "CronCreate",
            "Create a scheduled task that runs automatically at the specified time.",
            ToolSchemaBuilder.Object(
                new() { ["schedule"] = cronSchedule, ["prompt"] = cronPrompt, ["title"] = cronTitle },
                ["schedule", "prompt"]),
            availableModes: ["normal", "goal", "global"]));

        registry.Register(new ToolDefinitionPlaceholder(
            "CronUpdate",
            "Update an existing scheduled task.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["task_id"] = ToolSchemaBuilder.String("Task ID to update."),
                    ["schedule"] = cronSchedule,
                    ["prompt"] = cronPrompt,
                    ["title"] = cronTitle
                },
                ["task_id"]),
            availableModes: ["normal", "goal", "global"]));

        registry.Register(new ToolDefinitionPlaceholder(
            "CronRemove",
            "Remove a scheduled task (legacy alias for CronDelete).",
            ToolSchemaBuilder.Object(
                new() { ["task_id"] = ToolSchemaBuilder.String("Task ID to remove.") },
                ["task_id"]),
            availableModes: ["normal", "goal", "global"]));

        registry.Register(new ToolDefinitionPlaceholder(
            "CronDelete",
            "Delete a scheduled task.",
            ToolSchemaBuilder.Object(
                new() { ["task_id"] = ToolSchemaBuilder.String("Task ID to delete.") },
                ["task_id"]),
            availableModes: ["normal", "goal", "global"]));

        registry.Register(new ToolDefinitionPlaceholder(
            "CronList",
            "List all scheduled tasks.",
            ToolSchemaBuilder.Object(),
            availableModes: ["normal", "goal", "global"]));
    }
}