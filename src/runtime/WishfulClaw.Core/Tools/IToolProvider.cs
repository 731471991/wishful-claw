namespace WishfulClaw.Core.Tools;

/// <summary>
/// Interface for tool category providers.
/// Each provider is responsible for registering a group of related tool definitions
/// into the <see cref="ToolRegistry"/>.
/// </summary>
/// <remarks>
/// This enables a pluggable registration architecture:
/// <list type="bullet">
/// <item>Simple tools with real executors implement <see cref="IToolExecutor"/> directly.</item>
/// <item>Definition-only tools (executed via reverse-request, native executors, etc.)
/// are registered through <see cref="IToolProvider"/> implementations.</item>
/// <item>Providers are auto-discovered via reflection — no manual wiring needed.</item>
/// </list>
/// </remarks>
public interface IToolProvider
{
    /// <summary>
    /// Category name (e.g. "desktop", "web", "plugin", "cron").
    /// Used for diagnostics and ordering.
    /// </summary>
    string Category { get; }

    /// <summary>
    /// Register tool definitions into the registry.
    /// </summary>
    void RegisterTools(ToolRegistry registry);
}
