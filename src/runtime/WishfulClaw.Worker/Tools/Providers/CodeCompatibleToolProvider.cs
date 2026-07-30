using WishfulClaw.Worker.Tools;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Worker.Tools.Providers;

/// <summary>
/// Registers code-compatible tool definitions (PowerShell, Monitor).
/// Execution: ToolDispatchRouter → AgentRuntimeCodeCompatibleExecutor.
/// </summary>
internal sealed class CodeCompatibleToolProvider : IToolProvider
{
    public string Category => "code-compatible";

    public void RegisterTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "PowerShell",
            "Execute a PowerShell command on the local system. " +
            "IMPORTANT PowerShell syntax notes: " +
            "Do NOT use '&&' to chain commands — PowerShell does not support it. " +
            "Use ';' to separate commands, or 'if ($LASTEXITCODE -eq 0) { ... }' for conditional execution. " +
            "Use '|' for piping. Use '$()' for subexpressions instead of backticks. " +
            "String interpolation uses double quotes; single quotes are literal.",
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
}
