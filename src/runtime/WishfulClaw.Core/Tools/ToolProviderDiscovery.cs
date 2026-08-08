using WishfulClaw.Core.Tools;

namespace WishfulClaw.Core.Tools;

/// <summary>
/// Registers known IToolProvider implementations.
/// AOT-safe: uses pre-created instances, no reflection.
/// </summary>
public static class ToolProviderDiscovery
{
    /// <summary>
    /// Register all tool providers from the given instances.
    /// AOT-safe: uses pre-created instances, no reflection.
    /// </summary>
    public static void DiscoverAndRegister(ToolRegistry registry, IToolProvider[] providers)
    {
        foreach (var provider in providers.OrderBy(p => p.GetType().Name, StringComparer.Ordinal))
        {
            try
            {
                registry.PushCategory(provider.Category);
                provider.RegisterTools(registry);
                registry.PopCategory();
            }
            catch (Exception ex)
            {
                System.Console.Error.WriteLine(
                    $"[ToolProviderDiscovery] Failed to register provider '{provider.GetType().Name}': {ex.Message}");
            }
        }
    }
}
