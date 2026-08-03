using WishfulClaw.Agent.Tools;
using System.Text.Json;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Agent.Tools.Providers;

/// <summary>
/// Registers task management tool definitions (TaskCreate/Get/Update/List).
/// Execution: ToolDispatchRouter → AgentRuntimeTaskExecutor (in-memory).
/// Note: The SubAgent "Task" tool is a separate IToolExecutor (TaskTool.cs) registered directly.
/// </summary>
internal sealed class TaskToolProvider : IToolProvider
{
    public string Category => "task";

    public void RegisterTools(ToolRegistry registry)
    {
        var taskProps = new Dictionary<string, JsonElement>
        {
            ["title"] = ToolSchemaBuilder.String("Task title."),
            ["status"] = ToolSchemaBuilder.String("Task status.", ["pending", "in_progress", "completed", "cancelled"]),
            ["content"] = ToolSchemaBuilder.String("Task content or description.")
        };

        registry.Register(new ToolDefinitionPlaceholder(
            "TaskCreate",
            "Create a new task in the task list.",
            ToolSchemaBuilder.Object(taskProps, ["title"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "TaskGet",
            "Get a task by ID.",
            ToolSchemaBuilder.Object(
                new() { ["id"] = ToolSchemaBuilder.String("The task ID.") },
                ["id"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "TaskUpdate",
            "Update an existing task.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["id"] = ToolSchemaBuilder.String("The task ID."),
                    ["title"] = ToolSchemaBuilder.String("Updated title."),
                    ["status"] = ToolSchemaBuilder.String("Updated status.", ["pending", "in_progress", "completed", "cancelled"]),
                    ["content"] = ToolSchemaBuilder.String("Updated content.")
                },
                ["id"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "TaskList",
            "List all tasks in the current session.",
            ToolSchemaBuilder.Object()));
    }
}
