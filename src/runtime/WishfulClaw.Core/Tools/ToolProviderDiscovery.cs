using System.Reflection;

namespace WishfulClaw.Core.Tools;

/// <summary>
/// Discovers all <see cref="IToolProvider"/> implementations via reflection.
/// Scans the calling assembly for non-abstract types implementing IToolProvider,
/// instantiates them (parameterless constructors), and invokes RegisterTools.
/// </summary>
public static class ToolProviderDiscovery
{
    /// <summary>
    /// Discover and register all tool providers found in the specified assembly.
    /// If no assembly is specified, scans the calling assembly.
    /// </summary>
    public static void DiscoverAndRegister(ToolRegistry registry, Assembly? assembly = null)
    {
        var asm = assembly ?? Assembly.GetCallingAssembly();

        var providerTypes = asm.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false }
                && typeof(IToolProvider).IsAssignableFrom(t))
            .OrderBy(t => t.Name, StringComparer.Ordinal);

        foreach (var type in providerTypes)
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
                // Log but don't throw — one provider failing shouldn't break all tools
                System.Console.Error.WriteLine(
                    $"[ToolProviderDiscovery] Failed to register provider '{type.Name}': {ex.Message}");
            }
        }
    }
}
