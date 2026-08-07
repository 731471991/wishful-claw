using WishfulClaw.Core.Tools;

namespace WishfulClaw.Agent.Tools.Providers;

/// <summary>
/// Registers project management tools for the "global session" (project manager) mode.
/// Execution: ToolDispatchRouter -> AgentRuntimeProjectExecutor.
/// </summary>
internal sealed class ProjectToolsProvider : IToolProvider
{
    public string Category => "project";

    public void RegisterTools(ToolRegistry registry)
    {
        // list_projects: List all projects (id, name, path)
        registry.Register(new ToolDefinitionPlaceholder(
            "list_projects",
            "List all registered projects with their id, name, and working directory path. " +
            "Use this to discover what projects exist and find their project IDs for further operations.",
            ToolSchemaBuilder.Object(
                new Dictionary<string, System.Text.Json.JsonElement>
                {
                    ["filter"] = ToolSchemaBuilder.String(
                        "Optional search filter to narrow results by project name. " +
                        "Case-insensitive substring match. Leave empty to list all projects.")
                },
                [])));

        // get_project_details: Get project details including sessions and task status
        registry.Register(new ToolDefinitionPlaceholder(
            "get_project_details",
            "Get detailed information about a project, including its session list and task status. " +
            "Reads the project's .wishful-claw/project-status.md file for a clean summary of ongoing work. " +
            "If the status file does not exist, it will automatically trigger the project session to generate one " +
            "and wait for completion before returning.",
            ToolSchemaBuilder.Object(
                new Dictionary<string, System.Text.Json.JsonElement>
                {
                    ["projectId"] = ToolSchemaBuilder.String(
                        "The ID of the project to inspect. Use list_projects to find available project IDs.")
                },
                ["projectId"])));

        // create_session: Create a new session for a project
        registry.Register(new ToolDefinitionPlaceholder(
            "create_session",
            "Create a new conversation session for a specific project. " +
            "Use this when you need to start a new task or discussion for a project. " +
            "Returns the new session's ID which can be used with send_session_message.",
            ToolSchemaBuilder.Object(
                new Dictionary<string, System.Text.Json.JsonElement>
                {
                    ["projectId"] = ToolSchemaBuilder.String(
                        "The ID of the project to create a session for."),
                    ["sessionName"] = ToolSchemaBuilder.String(
                        "Optional name for the new session. If not provided, a default name will be generated " +
                        "based on current task/context.")
                },
                ["projectId"])));

        // send_session_message: Send a message to a session
        registry.Register(new ToolDefinitionPlaceholder(
            "send_session_message",
            "Send a message as the user to an existing project session. " +
            "The target session will receive the message and the agent will process it automatically. " +
            "Use this to dispatch tasks, assign work, or send instructions to a project session. " +
            "Returns the execution result after the target session completes its response.",
            ToolSchemaBuilder.Object(
                new Dictionary<string, System.Text.Json.JsonElement>
                {
                    ["sessionId"] = ToolSchemaBuilder.String(
                        "The ID of the target session to send the message to."),
                    ["content"] = ToolSchemaBuilder.String(
                        "The message content to send. This will appear as a user message in the target session."),
                    ["workingFolder"] = ToolSchemaBuilder.String(
                        "Optional working directory path for the target session. " +
                        "If not provided, the project's default working folder will be used."),
                    ["projectId"] = ToolSchemaBuilder.String(
                        "Optional project ID for the target session. " +
                        "If not provided, inferred from the session.")
                },
                ["sessionId", "content"])));
    }
}