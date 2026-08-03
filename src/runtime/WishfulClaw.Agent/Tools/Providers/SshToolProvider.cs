using WishfulClaw.Agent.Tools;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Agent.Tools.Providers;

/// <summary>
/// Registers SSH-related tool definitions.
/// Execution: ToolDispatchRouter → AgentRuntimeSshToolExecutor (reverse-request to main process).
/// </summary>
internal sealed class SshToolProvider : IToolProvider
{
    public string Category => "ssh";

    public void RegisterTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "SshListConnections",
            "List all available SSH connections saved in the application. " +
            "Returns each connection's id, name, host, port, username, and auth type. " +
            "Use this to discover sshConnectionId values needed for remote command execution via the Bash tool.",
            ToolSchemaBuilder.Object()));
    }
}
