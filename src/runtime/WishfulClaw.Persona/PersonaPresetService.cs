using System.Reflection;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Persona;

/// <summary>
/// Loads built-in persona presets from embedded resources.
/// Built-in presets are read-only; custom personas live on disk and are managed by PersonaStore.
/// </summary>
public sealed class PersonaPresetService
{
    private const string BuiltinResourcePrefix = "WishfulClaw.Persona.Resources.Personas";

    private static readonly Lazy<PersonaPresetService> _default = new(() => new PersonaPresetService());
    public static PersonaPresetService Default => _default.Value;

    /// <summary>
    /// Built-in preset IDs — these cannot be deleted from the global library.
    /// </summary>
    public static readonly HashSet<string> BuiltinPresetIds =
    [
        "default", "lao-zheng", "jarvis", "taozi", "tingjie", "aming"
    ];

    private readonly Dictionary<string, (PersonaSummary Summary, PersonaConfig Config)> _cache = new(StringComparer.Ordinal);

    private PersonaPresetService()
    {
        LoadBuiltinPresets();
    }

    /// <summary>
    /// Returns all built-in preset summaries.
    /// </summary>
    public List<PersonaSummary> ListBuiltin()
    {
        return _cache.Values.Select(pair => pair.Summary).ToList();
    }

    /// <summary>
    /// Returns the full config for a built-in preset, or null if not found.
    /// </summary>
    public PersonaConfig? GetBuiltin(string personaId)
    {
        return _cache.TryGetValue(personaId, out var pair) ? pair.Config : null;
    }

    /// <summary>
    /// Returns all built-in preset configs.
    /// </summary>
    public IEnumerable<PersonaConfig> GetAllBuiltin()
    {
        return _cache.Values.Select(pair => pair.Config);
    }

    // ── Loading ──

    private void LoadBuiltinPresets()
    {
        var assembly = Assembly.GetExecutingAssembly();

        foreach (var presetId in BuiltinPresetIds)
        {
            try
            {
                var identity = ReadEmbeddedResource(assembly, presetId, PersonaFileLayout.IdentityFile);
                var soul = ReadEmbeddedResource(assembly, presetId, PersonaFileLayout.SoulFile);
                var ontology = ReadEmbeddedResource(assembly, presetId, PersonaFileLayout.OntologyFile);
                var agents = ReadEmbeddedResource(assembly, presetId, PersonaFileLayout.AgentsFile);

                if (string.IsNullOrWhiteSpace(identity)) continue;

                var meta = PersonaMetadata.Parse(identity);
                var summary = new PersonaSummary(
                    presetId,
                    string.IsNullOrEmpty(meta.Name) ? presetId : meta.Name,
                    meta.Tagline,
                    meta.Description,
                    IsBuiltin: true);

                var config = new PersonaConfig(
                    presetId,
                    summary.Name,
                    summary.Tagline,
                    summary.Description,
                    IsBuiltin: true,
                    identity, soul, ontology, agents);

                _cache[presetId] = (summary, config);
            }
            catch (Exception ex)
            {
                WorkerLog.Warn($"failed to load builtin persona id={presetId} error={ex.Message}");
            }
        }

        WorkerLog.Info($"builtin personas loaded count={_cache.Count}");
    }

    private static string ReadEmbeddedResource(Assembly assembly, string presetId, string fileName)
    {
        // .NET embeds resources with dots as separators.
        // Directory names with hyphens (e.g. "lao-zheng") become underscores in resource names (e.g. "lao_zheng").
        // Try both the original name and the underscore-normalized name.
        var normalizedPresetId = presetId.Replace('-', '_');

        foreach (var idVariant in new[] { presetId, normalizedPresetId })
        {
            var resourceName = $"{BuiltinResourcePrefix}.{idVariant}.{fileName}";
            using var stream = assembly.GetManifestResourceStream(resourceName);
            if (stream is not null)
            {
                using var reader = new StreamReader(stream);
                return reader.ReadToEnd();
            }
        }

        WorkerLog.Debug($"embedded resource not found: {BuiltinResourcePrefix}.{presetId}.{fileName}");
        return string.Empty;
    }
}
