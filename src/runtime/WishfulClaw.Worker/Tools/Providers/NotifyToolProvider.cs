using WishfulClaw.Worker.Tools;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Worker.Tools.Providers;

/// <summary>
/// Registers notification tool definitions.
/// Execution: ToolDispatchRouter → AgentRuntimeNotifyExecutor (reverse-request to main process).
/// </summary>
internal sealed class NotifyToolProvider : IToolProvider
{
    public string Category => "notify";

    public void RegisterTools(ToolRegistry registry)
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
}
