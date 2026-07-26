using System.Text.Json;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Worker.Tools;

/// <summary>
/// Generic placeholder for tools whose definitions must appear in tool/list
/// but whose execution is intercepted by ToolDispatchRouter (reverse-request,
/// native executor, etc.). Registering the definition makes the tool visible
/// to the LLM; the ExecuteAsync here should never be reached.
/// </summary>
internal sealed class ToolDefinitionPlaceholder : IToolExecutor
{
    public string Name { get; }
    public string Description { get; }
    public JsonElement InputSchema { get; }

    public ToolDefinitionPlaceholder(string name, string description, JsonElement inputSchema)
    {
        Name = name;
        Description = description;
        InputSchema = inputSchema;
    }

    public Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        return Task.FromResult(new ToolResult(
            $"Tool '{Name}' should be executed via the ToolDispatchRouter, not the registry. " +
            "This is a bug in the tool routing logic.",
            IsError: true));
    }
}

/// <summary>
/// Helper to build JSON schemas for tool definitions.
/// </summary>
internal static class ToolSchemaBuilder
{
    public static JsonElement Object(
        Dictionary<string, JsonElement>? properties = null,
        string[]? required = null)
    {
        var obj = new Dictionary<string, object?>
        {
            ["type"] = "object"
        };
        if (properties is not null)
            obj["properties"] = properties;
        else
            obj["properties"] = new Dictionary<string, object>();
        obj["required"] = required ?? Array.Empty<string>();
        var json = JsonSerializer.Serialize(obj);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    public static JsonElement String(string description, string[]? enumValues = null)
    {
        var obj = new Dictionary<string, object?>
        {
            ["type"] = "string",
            ["description"] = description
        };
        if (enumValues is not null)
            obj["enum"] = enumValues;
        var json = JsonSerializer.Serialize(obj);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    public static JsonElement Number(string description)
    {
        var obj = new Dictionary<string, object?>
        {
            ["type"] = "number",
            ["description"] = description
        };
        var json = JsonSerializer.Serialize(obj);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    public static JsonElement Boolean(string description)
    {
        var obj = new Dictionary<string, object?>
        {
            ["type"] = "boolean",
            ["description"] = description
        };
        var json = JsonSerializer.Serialize(obj);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    public static JsonElement ArraySchema(string description, JsonElement? items = null)
    {
        var obj = new Dictionary<string, object?>
        {
            ["type"] = "array",
            ["description"] = description
        };
        if (items.HasValue)
            obj["items"] = items.Value;
        var json = JsonSerializer.Serialize(obj);
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }
}

/// <summary>
/// Registers all tool definitions that are executed via ToolDispatchRouter
/// (reverse-request executors, native executors, etc.).
/// These definitions make the tools visible to the LLM via tool/list.
/// </summary>
internal static class ToolDefinitionRegistration
{
    public static void RegisterAll(ToolRegistry registry)
    {
        RegisterAskUserTools(registry);
        RegisterDesktopTools(registry);
        RegisterWebTools(registry);
        RegisterWidgetTools(registry);
        RegisterSkillTools(registry);
        RegisterNotebookEditTools(registry);
        RegisterGoalTools(registry);
        RegisterTaskTools(registry);
        RegisterPlanTools(registry);
        RegisterNotifyTools(registry);
        RegisterImageGenerateTools(registry);
        RegisterTeamTools(registry);
        RegisterCronTools(registry);
        RegisterCodeCompatibleTools(registry);
        RegisterPluginTools(registry);
        RegisterChannelPluginTools(registry);
    }

    // ── AskUser ──
    private static void RegisterAskUserTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "AskUserQuestion",
            "Present structured choices to the user and wait for their selection. Use when you need the user to decide between options, confirm an action, or provide direction. Supports single-select and multi-select questions with option descriptions.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["header"] = ToolSchemaBuilder.String("Short label for the question card (max 12 characters)."),
                    ["questions"] = ToolSchemaBuilder.ArraySchema(
                        "List of 1-5 questions to present.",
                        ToolSchemaBuilder.Object(new()
                        {
                            ["question"] = ToolSchemaBuilder.String("The question text."),
                            ["multiSelect"] = ToolSchemaBuilder.Boolean("Whether multiple options can be selected."),
                            ["options"] = ToolSchemaBuilder.ArraySchema(
                                "2-4 options. First option is the recommended/default.",
                                ToolSchemaBuilder.Object(new()
                                {
                                    ["label"] = ToolSchemaBuilder.String("Short option label (max 20 characters)."),
                                    ["description"] = ToolSchemaBuilder.String("Supplementary explanation of the option.")
                                }))
                        }))
                },
                ["header", "questions"])));
    }

    // ── Desktop Control ──
    private static void RegisterDesktopTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "DesktopScreenshot",
            "Capture a full desktop screenshot and return it to the agent. Use before mouse or keyboard actions when screen state matters.",
            ToolSchemaBuilder.Object(
                new() { ["delayMs"] = ToolSchemaBuilder.Number("Optional delay in milliseconds before capturing.") })));

        registry.Register(new ToolDefinitionPlaceholder(
            "DesktopClick",
            "Click a desktop coordinate. Supports left/right/middle button with click, double_click, down, or up actions.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["x"] = ToolSchemaBuilder.Number("Absolute X coordinate."),
                    ["y"] = ToolSchemaBuilder.Number("Absolute Y coordinate."),
                    ["button"] = ToolSchemaBuilder.String("Mouse button: left, right, or middle."),
                    ["action"] = ToolSchemaBuilder.String("Mouse action: click, double_click, down, or up.")
                },
                ["x", "y"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "DesktopType",
            "Type text, press a special key, or send a keyboard shortcut. Modifiers: Control, Meta, Alt, Shift.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["text"] = ToolSchemaBuilder.String("Type a full text string."),
                    ["key"] = ToolSchemaBuilder.String("Press one special key (Enter, Tab, Escape, etc.)."),
                    ["hotkey"] = ToolSchemaBuilder.ArraySchema("Key chord like [\"Control\", \"L\"].", ToolSchemaBuilder.String("Key name."))
                })));

        registry.Register(new ToolDefinitionPlaceholder(
            "DesktopScroll",
            "Scroll on the desktop. Optionally move pointer to x/y first, then apply scrollX/scrollY deltas.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["x"] = ToolSchemaBuilder.Number("Optional X coordinate before scrolling."),
                    ["y"] = ToolSchemaBuilder.Number("Optional Y coordinate before scrolling."),
                    ["scrollX"] = ToolSchemaBuilder.Number("Horizontal scroll delta. Defaults to 0."),
                    ["scrollY"] = ToolSchemaBuilder.Number("Vertical scroll delta.")
                })));

        registry.Register(new ToolDefinitionPlaceholder(
            "DesktopWait",
            "Pause desktop automation for a short period before continuing.",
            ToolSchemaBuilder.Object(
                new() { ["delayMs"] = ToolSchemaBuilder.Number("Delay in milliseconds. Defaults to 2000.") })));
    }

    // ── Web Search & Fetch ──
    private static void RegisterWebTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "WebSearch",
            "Search the web for information. Returns titles, URLs, and snippets for relevant results.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["query"] = ToolSchemaBuilder.String("The search query."),
                    ["count"] = ToolSchemaBuilder.Number("Number of results to return. Defaults to 10.")
                },
                ["query"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "WebFetch",
            "Fetch and parse a web page. Returns the page content as markdown.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["url"] = ToolSchemaBuilder.String("The URL to fetch."),
                    ["maxTokens"] = ToolSchemaBuilder.Number("Maximum tokens to return. Defaults to 10000.")
                },
                ["url"])));
    }

    // ── Widget ──
    private static void RegisterWidgetTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "visualize_show_widget",
            "Display a UI widget (chart, table, HTML, or image) in the chat interface.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["type"] = ToolSchemaBuilder.String("Widget type: chart, table, html, or image.", ["chart", "table", "html", "image"]),
                    ["title"] = ToolSchemaBuilder.String("Widget title."),
                    ["data"] = ToolSchemaBuilder.String("Widget data (JSON string or HTML depending on type).")
                },
                ["type", "data"])));
    }

    // ── Skill ──
    private static void RegisterSkillTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "Skill",
            "Invoke a registered skill (reusable prompt template). Skills are predefined workflows that can be triggered by name.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["SkillName"] = ToolSchemaBuilder.String("The name of the skill to invoke."),
                    ["input"] = ToolSchemaBuilder.String("Optional input parameters for the skill (JSON string).")
                },
                ["SkillName"])));
    }

    // ── NotebookEdit ──
    private static void RegisterNotebookEditTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "NotebookEdit",
            "Edit a Jupyter Notebook cell. Supports replace, insert, and delete operations.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["notebook_path"] = ToolSchemaBuilder.String("Path to the .ipynb file."),
                    ["cell_id"] = ToolSchemaBuilder.String("The cell ID to edit."),
                    ["new_source"] = ToolSchemaBuilder.String("The new source code for the cell."),
                    ["cell_type"] = ToolSchemaBuilder.String("Cell type: code, markdown, or raw.", ["code", "markdown", "raw"]),
                    ["edit_mode"] = ToolSchemaBuilder.String("Edit mode: replace, insert, or delete.", ["replace", "insert", "delete"])
                },
                ["notebook_path", "cell_id", "new_source"])));
    }

    // ── Goal ──
    private static void RegisterGoalTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "get_goal",
            "Get the current goal for the agent session.",
            ToolSchemaBuilder.Object()));

        registry.Register(new ToolDefinitionPlaceholder(
            "create_goal",
            "Create a new goal for the agent session.",
            ToolSchemaBuilder.Object(
                new() { ["goal"] = ToolSchemaBuilder.String("The goal description.") },
                ["goal"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "update_goal",
            "Update the current goal's status or content.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["goal"] = ToolSchemaBuilder.String("Updated goal description."),
                    ["status"] = ToolSchemaBuilder.String("New status.", ["active", "completed", "failed"])
                })));
    }

    // ── Task (TaskExecutor) ──
    private static void RegisterTaskTools(ToolRegistry registry)
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

    // ── Plan ──
    private static void RegisterPlanTools(ToolRegistry registry)
    {
        var planProps = new Dictionary<string, JsonElement>
        {
            ["plan"] = ToolSchemaBuilder.String("The plan content (markdown).")
        };

        registry.Register(new ToolDefinitionPlaceholder(
            "EnterPlanMode",
            "Enter plan mode to create and present a plan to the user for review.",
            ToolSchemaBuilder.Object(planProps, ["plan"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "ExitPlanMode",
            "Exit plan mode after the plan has been reviewed and approved.",
            ToolSchemaBuilder.Object()));
    }

    // ── Notify ──
    private static void RegisterNotifyTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "Notify",
            "Send a desktop notification to the user.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["title"] = ToolSchemaBuilder.String("Notification title."),
                    ["body"] = ToolSchemaBuilder.String("Notification body text.")
                },
                ["title"])));
    }

    // ── Image Generate ──
    private static void RegisterImageGenerateTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "ImageGenerate",
            "Generate images when the user needs visual content. Use proactively whenever an image would help. count defaults to 1, max 4.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["prompt"] = ToolSchemaBuilder.String("Complete visual prompt: subject, style, composition, lighting/mood. Be specific and concrete."),
                    ["count"] = ToolSchemaBuilder.Number("How many images to generate. Defaults to 1, max 4."),
                    ["reference_images"] = ToolSchemaBuilder.ArraySchema("Optional local image paths as references.", ToolSchemaBuilder.String("Image path.")),
                    ["size"] = ToolSchemaBuilder.String("Image size.", ["auto", "1024x1024", "1024x1536", "1536x1024"]),
                    ["quality"] = ToolSchemaBuilder.String("Image quality.", ["auto", "low", "medium", "high"])
                },
                ["prompt"])));
    }

    // ── Team ──
    private static void RegisterTeamTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "TeamCreate",
            "Create a new agent team for multi-agent collaboration.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["name"] = ToolSchemaBuilder.String("Team name."),
                    ["members"] = ToolSchemaBuilder.ArraySchema("Team member configurations.", ToolSchemaBuilder.String("Member agent name."))
                },
                ["name"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "TeamStatus",
            "Get the status of an agent team.",
            ToolSchemaBuilder.Object(
                new() { ["name"] = ToolSchemaBuilder.String("Team name.") },
                ["name"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "TeamDelete",
            "Delete an agent team.",
            ToolSchemaBuilder.Object(
                new() { ["name"] = ToolSchemaBuilder.String("Team name.") },
                ["name"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "SendMessage",
            "Send a message to a team member.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["team"] = ToolSchemaBuilder.String("Team name."),
                    ["member"] = ToolSchemaBuilder.String("Member agent name."),
                    ["message"] = ToolSchemaBuilder.String("Message content.")
                },
                ["team", "member", "message"])));
    }

    // ── Cron ──
    private static void RegisterCronTools(ToolRegistry registry)
    {
        var cronSchedule = ToolSchemaBuilder.String("Cron schedule (6-field: sec min hour day month weekday) or datetime for one-time task.");
        var cronPrompt = ToolSchemaBuilder.String("Task prompt — pure instruction without timing keywords.");
        var cronTitle = ToolSchemaBuilder.String("Task title for display.");

        registry.Register(new ToolDefinitionPlaceholder(
            "CronAdd",
            "Add a scheduled task (legacy alias for CronCreate).",
            ToolSchemaBuilder.Object(
                new() { ["schedule"] = cronSchedule, ["prompt"] = cronPrompt, ["title"] = cronTitle },
                ["schedule", "prompt"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "CronCreate",
            "Create a scheduled task that runs automatically at the specified time.",
            ToolSchemaBuilder.Object(
                new() { ["schedule"] = cronSchedule, ["prompt"] = cronPrompt, ["title"] = cronTitle },
                ["schedule", "prompt"])));

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
                ["task_id"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "CronRemove",
            "Remove a scheduled task (legacy alias for CronDelete).",
            ToolSchemaBuilder.Object(
                new() { ["task_id"] = ToolSchemaBuilder.String("Task ID to remove.") },
                ["task_id"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "CronDelete",
            "Delete a scheduled task.",
            ToolSchemaBuilder.Object(
                new() { ["task_id"] = ToolSchemaBuilder.String("Task ID to delete.") },
                ["task_id"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "CronList",
            "List all scheduled tasks.",
            ToolSchemaBuilder.Object()));
    }

    // ── Code Compatible (PowerShell / Monitor) ──
    private static void RegisterCodeCompatibleTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "PowerShell",
            "Execute a PowerShell command on the local system.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["command"] = ToolSchemaBuilder.String("The PowerShell command to execute."),
                    ["cwd"] = ToolSchemaBuilder.String("Working directory. Defaults to the session's working folder.")
                },
                ["command"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "Monitor",
            "Monitor the output of a previously started long-running process.",
            ToolSchemaBuilder.Object(
                new() { ["session_id"] = ToolSchemaBuilder.String("The session ID to monitor.") },
                ["session_id"])));
    }

    // ── Plugin (channel-agnostic messaging) ──
    private static void RegisterPluginTools(ToolRegistry registry)
    {
        var chatId = ToolSchemaBuilder.String("Target chat ID.");
        var content = ToolSchemaBuilder.String("Message content to send.");

        registry.Register(new ToolDefinitionPlaceholder(
            "PluginSendMessage",
            "Send a text message through a messaging channel (Feishu, WeChat, etc.).",
            ToolSchemaBuilder.Object(
                new() { ["chatId"] = chatId, ["content"] = content },
                ["chatId", "content"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "PluginReplyMessage",
            "Reply to a specific message through a messaging channel.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["messageId"] = ToolSchemaBuilder.String("The message ID to reply to."),
                    ["content"] = content
                },
                ["messageId", "content"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "PluginGetGroupMessages",
            "Get recent messages from a group chat.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["chatId"] = chatId,
                    ["count"] = ToolSchemaBuilder.Number("Number of messages to retrieve. Defaults to 20.")
                },
                ["chatId"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "PluginListGroups",
            "List all groups/chats the channel bot is in.",
            ToolSchemaBuilder.Object()));

        registry.Register(new ToolDefinitionPlaceholder(
            "PluginSummarizeGroup",
            "Summarize recent messages in a group chat.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["chatId"] = chatId,
                    ["count"] = ToolSchemaBuilder.Number("Number of recent messages to summarize. Defaults to 50.")
                },
                ["chatId"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "PluginGetCurrentChatMessages",
            "Get messages from the current chat context.",
            ToolSchemaBuilder.Object(
                new() { ["count"] = ToolSchemaBuilder.Number("Number of messages. Defaults to 20.") })));
    }

    // ── Channel Plugin (Feishu/WeChat specific) ──
    private static void RegisterChannelPluginTools(ToolRegistry registry)
    {
        var chatIdProp = ToolSchemaBuilder.String("Target chat ID.");

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuSendImage",
            "Send an image to a Feishu chat.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["chatId"] = chatIdProp,
                    ["imagePath"] = ToolSchemaBuilder.String("Local path to the image file.")
                },
                ["chatId", "imagePath"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuSendFile",
            "Send a file to a Feishu chat.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["chatId"] = chatIdProp,
                    ["filePath"] = ToolSchemaBuilder.String("Local path to the file.")
                },
                ["chatId", "filePath"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuListChatMembers",
            "List members in a Feishu chat.",
            ToolSchemaBuilder.Object(
                new() { ["chatId"] = chatIdProp },
                ["chatId"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuAtMember",
            "Mention a specific member in a Feishu message.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["chatId"] = chatIdProp,
                    ["userId"] = ToolSchemaBuilder.String("User ID to mention."),
                    ["content"] = ToolSchemaBuilder.String("Message content.")
                },
                ["chatId", "userId", "content"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuSendUrgent",
            "Send an urgent message in Feishu.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["messageId"] = ToolSchemaBuilder.String("Message ID to mark as urgent."),
                    ["userIds"] = ToolSchemaBuilder.ArraySchema("User IDs to notify.", ToolSchemaBuilder.String("User ID.")),
                    ["urgentType"] = ToolSchemaBuilder.String("Urgent type.", ["app", "sms"])
                },
                ["messageId"])));

        // Feishu Bitable
        var appToken = ToolSchemaBuilder.String("Bitable app token.");
        var tableId = ToolSchemaBuilder.String("Bitable table ID.");

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuBitableListApps",
            "List Feishu Bitable (多维表格) apps.",
            ToolSchemaBuilder.Object(
                new() { ["pageSize"] = ToolSchemaBuilder.Number("Page size. Defaults to 50.") })));

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuBitableListTables",
            "List tables in a Feishu Bitable app.",
            ToolSchemaBuilder.Object(
                new() { ["appToken"] = appToken },
                ["appToken"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuBitableListFields",
            "List fields in a Feishu Bitable table.",
            ToolSchemaBuilder.Object(
                new() { ["appToken"] = appToken, ["tableId"] = tableId },
                ["appToken", "tableId"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuBitableGetRecords",
            "Get records from a Feishu Bitable table.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["appToken"] = appToken,
                    ["tableId"] = tableId,
                    ["pageSize"] = ToolSchemaBuilder.Number("Page size. Defaults to 50."),
                    ["filter"] = ToolSchemaBuilder.String("Optional filter condition.")
                },
                ["appToken", "tableId"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuBitableCreateRecords",
            "Create records in a Feishu Bitable table.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["appToken"] = appToken,
                    ["tableId"] = tableId,
                    ["records"] = ToolSchemaBuilder.ArraySchema("Records to create.", ToolSchemaBuilder.String("Record JSON."))
                },
                ["appToken", "tableId", "records"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuBitableUpdateRecords",
            "Update records in a Feishu Bitable table.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["appToken"] = appToken,
                    ["tableId"] = tableId,
                    ["records"] = ToolSchemaBuilder.ArraySchema("Records to update.", ToolSchemaBuilder.String("Record JSON."))
                },
                ["appToken", "tableId", "records"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuBitableDeleteRecords",
            "Delete records from a Feishu Bitable table.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["appToken"] = appToken,
                    ["tableId"] = tableId,
                    ["recordIds"] = ToolSchemaBuilder.ArraySchema("Record IDs to delete.", ToolSchemaBuilder.String("Record ID."))
                },
                ["appToken", "tableId", "recordIds"])));

        // WeChat
        registry.Register(new ToolDefinitionPlaceholder(
            "WeixinSendImage",
            "Send an image to a WeChat chat.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["chatId"] = chatIdProp,
                    ["imagePath"] = ToolSchemaBuilder.String("Local path to the image file.")
                },
                ["chatId", "imagePath"])));

        registry.Register(new ToolDefinitionPlaceholder(
            "WeixinSendFile",
            "Send a file to a WeChat chat.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["chatId"] = chatIdProp,
                    ["filePath"] = ToolSchemaBuilder.String("Local path to the file.")
                },
                ["chatId", "filePath"])));
    }
}
