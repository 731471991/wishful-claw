using WishfulClaw.Agent.Tools;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Agent.Tools.Providers;

/// <summary>
/// Registers channel-specific plugin tool definitions (Feishu, WeChat).
/// Execution: ToolDispatchRouter → AgentRuntimeChannelPluginExecutor (reverse-request to main process).
/// Available in normal and goal modes only (not sub-agent).
/// </summary>
internal sealed class ChannelPluginToolProvider : IToolProvider
{
    public string Category => "channel-plugin";

    public void RegisterTools(ToolRegistry registry)
    {
        var chatIdProp = ToolSchemaBuilder.String("Target chat ID.");

        // ── Feishu messaging ──
        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuSendImage",
            "Send an image to a Feishu chat.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["chatId"] = chatIdProp,
                    ["imagePath"] = ToolSchemaBuilder.String("Local path to the image file.")
                },
                ["chatId", "imagePath"]),
            availableModes: ["normal", "goal"]));

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuSendFile",
            "Send a file to a Feishu chat.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["chatId"] = chatIdProp,
                    ["filePath"] = ToolSchemaBuilder.String("Local path to the file.")
                },
                ["chatId", "filePath"]),
            availableModes: ["normal", "goal"]));

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuListChatMembers",
            "List members in a Feishu chat.",
            ToolSchemaBuilder.Object(
                new() { ["chatId"] = chatIdProp },
                ["chatId"]),
            availableModes: ["normal", "goal"]));

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
                ["chatId", "userId", "content"]),
            availableModes: ["normal", "goal"]));

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
                ["messageId"]),
            availableModes: ["normal", "goal"]));

        // ── Feishu Bitable ──
        RegisterFeishuBitableTools(registry);

        // ── WeChat ──
        registry.Register(new ToolDefinitionPlaceholder(
            "WeixinSendImage",
            "Send an image to a WeChat chat.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["chatId"] = chatIdProp,
                    ["imagePath"] = ToolSchemaBuilder.String("Local path to the image file.")
                },
                ["chatId", "imagePath"]),
            availableModes: ["normal", "goal"]));

        registry.Register(new ToolDefinitionPlaceholder(
            "WeixinSendFile",
            "Send a file to a WeChat chat.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["chatId"] = chatIdProp,
                    ["filePath"] = ToolSchemaBuilder.String("Local path to the file.")
                },
                ["chatId", "filePath"]),
            availableModes: ["normal", "goal"]));
    }

    private static void RegisterFeishuBitableTools(ToolRegistry registry)
    {
        var appToken = ToolSchemaBuilder.String("Bitable app token.");
        var tableId = ToolSchemaBuilder.String("Bitable table ID.");

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuBitableListApps",
            "List Feishu Bitable (多维表格) apps.",
            ToolSchemaBuilder.Object(
                new() { ["pageSize"] = ToolSchemaBuilder.Number("Page size. Defaults to 50.") }),
            availableModes: ["normal", "goal"]));

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuBitableListTables",
            "List tables in a Feishu Bitable app.",
            ToolSchemaBuilder.Object(
                new() { ["appToken"] = appToken },
                ["appToken"]),
            availableModes: ["normal", "goal"]));

        registry.Register(new ToolDefinitionPlaceholder(
            "FeishuBitableListFields",
            "List fields in a Feishu Bitable table.",
            ToolSchemaBuilder.Object(
                new() { ["appToken"] = appToken, ["tableId"] = tableId },
                ["appToken", "tableId"]),
            availableModes: ["normal", "goal"]));

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
                ["appToken", "tableId"]),
            availableModes: ["normal", "goal"]));

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
                ["appToken", "tableId", "records"]),
            availableModes: ["normal", "goal"]));

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
                ["appToken", "tableId", "records"]),
            availableModes: ["normal", "goal"]));

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
                ["appToken", "tableId", "recordIds"]),
            availableModes: ["normal", "goal"]));
    }
}