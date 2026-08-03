using WishfulClaw.Core.Tools;

namespace WishfulClaw.Agent.Tools.Providers;

/// <summary>
/// Registers the unified capability proxy tool.
/// Instead of registering every MCP tool and Skill as individual tools
/// (which bloats the LLM request and causes HTTP 413), a single stable
/// use_capability tool lets the agent discover, inspect, and call
/// MCP tools and Skills on demand.
///
/// Inspired by Reasonix's use_capability design.
/// Execution: ToolDispatchRouter → AgentRuntimeUseCapabilityExecutor.
/// </summary>
internal sealed class UseCapabilityToolProvider : IToolProvider
{
    public string Category => "capability";

    public void RegisterTools(ToolRegistry registry)
    {
        registry.Register(new ToolDefinitionPlaceholder(
            "use_capability",
            "Stable capability proxy: list available MCP servers/tools and Skills, "
            + "inspect a specific capability's schema, or call an MCP tool / Skill by id. "
            + "Use action=\"list\" to discover capabilities, action=\"inspect\" with "
            + "capability_id to see a tool's input schema, action=\"call\" with "
            + "capability_id and arguments to execute. "
            + "capability_id format: \"mcp-tool:serverName/toolName\" for MCP tools, "
            + "\"skill:skillName\" for Skills.",
            ToolSchemaBuilder.Object(
                new()
                {
                    ["action"] = ToolSchemaBuilder.String(
                        "list | inspect | call",
                        new[] { "list", "inspect", "call" }),
                    ["capability_id"] = ToolSchemaBuilder.String(
                        "Capability id: mcp-tool:server/tool, mcp-server:name, or skill:name. "
                        + "Not required for action=list."),
                    ["arguments"] = ToolSchemaBuilder.Object(
                        new()
                        {
                            ["(any)"] = ToolSchemaBuilder.String("Tool arguments as JSON object. Only for action=call.")
                        })
                },
                new[] { "action" })));
    }
}
