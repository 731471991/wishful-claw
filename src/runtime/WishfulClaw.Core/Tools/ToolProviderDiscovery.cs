using System.Reflection;

namespace WishfulClaw.Core.Tools;

/// <summary>
/// Registers known IToolProvider implementations.
/// AOT-safe: uses explicit type list provided by the caller instead of Assembly.GetTypes().
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

    /// <summary>
    /// Legacy overload for backward compatibility.
    /// </summary>
    public static void DiscoverAndRegister(ToolRegistry registry, Type[] providerTypes)
    {
        foreach (var type in providerTypes.OrderBy(t => t.Name, StringComparer.Ordinal))
        {
            try
            {
                var provider = (IToolProvider)Activator.CreateInstance(type)!;
                registry.PushCategory(provider.Category);
                provider.RegisterTools(registry);
                registry.PopCategory();
            }
            catch (Exception ex)
            {
                System.Console.Error.WriteLine(
                    $"[ToolProviderDiscovery] Failed to register provider '{type.Name}': {ex.Message}");
            }
        }
    }

    /// <summary>
    /// Legacy overload for backward compatibility (non-AOT scenarios).
    /// Uses Assembly.GetTypes() — will fail under AOT.
    /// </summary>
    public static void DiscoverAndRegister(ToolRegistry registry, Assembly assembly)
    {
        var providerTypes = assembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false }
                && typeof(IToolProvider).IsAssignableFrom(t))
            .ToArray();

        DiscoverAndRegister(registry, providerTypes);
    }
}
