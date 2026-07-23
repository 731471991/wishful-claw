using System.Reflection;
using System.Text.Json;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.Persona;

/// <summary>
/// Reads and writes persona .md files from the global library (~/.wishful-claw/personas/)
/// or project library ({workingFolder}/.wishful-claw/personas/).
/// Also loads built-in presets from embedded resources.
/// </summary>
internal sealed class PersonaStore
{
    private const string DataDirectoryName = ".wishful-claw";
    private const string BuiltinResourcePrefix = "WishfulClaw.Worker.Resources.Personas";

    private static readonly Lazy<PersonaStore> _default = new(() => new PersonaStore());
    public static PersonaStore Default => _default.Value;

    // Built-in preset IDs — these cannot be deleted.
    public static readonly HashSet<string> BuiltinPresetIds =
    [
        "default", "lao-zheng", "jarvis", "taozi", "tingjie", "aming"
    ];

    private readonly Dictionary<string, (PersonaSummary Summary, PersonaConfig Config)> _builtinCache = new(StringComparer.Ordinal);

    private PersonaStore()
    {
        LoadBuiltinPresets();
    }

    // ── Path resolution ──

    /// <summary>
    /// Returns the personas directory for the given scope.
    /// If workingFolder is null/empty, returns the global library path.
    /// </summary>
    public static string GetPersonasDirectory(string? workingFolder)
    {
        var root = string.IsNullOrWhiteSpace(workingFolder)
            ? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                DataDirectoryName)
            : workingFolder;

        return Path.Combine(root, PersonaFileLayout.PersonasDirectoryName);
    }

    /// <summary>
    /// Returns the directory for a specific persona.
    /// </summary>
    public static string GetPersonaDirectory(string personaId, string? workingFolder)
    {
        return Path.Combine(GetPersonasDirectory(workingFolder), personaId);
    }

    // ── List ──

    /// <summary>
    /// Lists all personas in the given scope (built-in + custom on disk).
    /// Built-in presets are always included; custom personas are scanned from disk.
    /// </summary>
    public List<PersonaSummary> ListPersonas(string? workingFolder)
    {
        var result = new List<PersonaSummary>();

        // Add built-in presets first
        foreach (var (_, pair) in _builtinCache)
        {
            result.Add(pair.Summary);
        }

        // Scan custom personas on disk
        var personasDir = GetPersonasDirectory(workingFolder);
        if (Directory.Exists(personasDir))
        {
            foreach (var dir in Directory.GetDirectories(personasDir))
            {
                var id = Path.GetFileName(dir);
                if (BuiltinPresetIds.Contains(id)) continue; // already added

                var identityPath = Path.Combine(dir, PersonaFileLayout.IdentityFile);
                if (!File.Exists(identityPath)) continue;

                try
                {
                    var identityContent = File.ReadAllText(identityPath);
                    var meta = PersonaMetadata.Parse(identityContent);
                    result.Add(new PersonaSummary(
                        id,
                        string.IsNullOrEmpty(meta.Name) ? id : meta.Name,
                        meta.Tagline,
                        meta.Description,
                        IsBuiltin: false));
                }
                catch
                {
                    // Skip unreadable personas
                }
            }
        }

        return result;
    }

    // ── Get ──

    /// <summary>
    /// Gets the full persona config by ID.
    /// Checks built-in cache first, then disk.
    /// </summary>
    public PersonaConfig? GetPersona(string personaId, string? workingFolder)
    {
        // Check built-in cache
        if (_builtinCache.TryGetValue(personaId, out var builtin))
        {
            // If a custom override exists on disk (project scope), prefer it
            if (!string.IsNullOrWhiteSpace(workingFolder))
            {
                var diskConfig = TryReadFromDisk(personaId, workingFolder);
                if (diskConfig is not null) return diskConfig;
            }
            return builtin.Config;
        }

        // Read from disk
        return TryReadFromDisk(personaId, workingFolder);
    }

    private static PersonaConfig? TryReadFromDisk(string personaId, string? workingFolder)
    {
        var dir = GetPersonaDirectory(personaId, workingFolder);
        var identityPath = Path.Combine(dir, PersonaFileLayout.IdentityFile);
        if (!File.Exists(identityPath)) return null;

        var identityContent = File.ReadAllText(identityPath);
        var meta = PersonaMetadata.Parse(identityContent);

        return new PersonaConfig(
            personaId,
            string.IsNullOrEmpty(meta.Name) ? personaId : meta.Name,
            meta.Tagline,
            meta.Description,
            IsBuiltin: BuiltinPresetIds.Contains(personaId) && string.IsNullOrWhiteSpace(workingFolder),
            IdentityMarkdown: identityContent,
            SoulMarkdown: TryReadFile(Path.Combine(dir, PersonaFileLayout.SoulFile)),
            OntologyMarkdown: TryReadFile(Path.Combine(dir, PersonaFileLayout.OntologyFile)),
            AgentsMarkdown: TryReadFile(Path.Combine(dir, PersonaFileLayout.AgentsFile)));
    }

    private static string TryReadFile(string path)
    {
        return File.Exists(path) ? File.ReadAllText(path) : string.Empty;
    }

    // ── Save ──

    /// <summary>
    /// Saves a persona config to disk (creates directory if needed).
    /// </summary>
    public void SavePersona(PersonaConfig config, string? workingFolder)
    {
        var dir = GetPersonaDirectory(config.Id, workingFolder);
        Directory.CreateDirectory(dir);

        File.WriteAllText(Path.Combine(dir, PersonaFileLayout.IdentityFile), config.IdentityMarkdown);
        File.WriteAllText(Path.Combine(dir, PersonaFileLayout.SoulFile), config.SoulMarkdown);
        File.WriteAllText(Path.Combine(dir, PersonaFileLayout.OntologyFile), config.OntologyMarkdown);
        File.WriteAllText(Path.Combine(dir, PersonaFileLayout.AgentsFile), config.AgentsMarkdown);

        WorkerLog.Info($"persona saved id={config.Id} scope={(string.IsNullOrWhiteSpace(workingFolder) ? "global" : "project")}");
    }

    // ── Delete ──

    /// <summary>
    /// Deletes a persona from disk. Built-in presets cannot be deleted.
    /// </summary>
    public bool DeletePersona(string personaId, string? workingFolder)
    {
        if (BuiltinPresetIds.Contains(personaId) && string.IsNullOrWhiteSpace(workingFolder))
        {
            return false; // Cannot delete global built-in presets
        }

        var dir = GetPersonaDirectory(personaId, workingFolder);
        if (!Directory.Exists(dir)) return false;

        Directory.Delete(dir, recursive: true);
        WorkerLog.Info($"persona deleted id={personaId} scope={(string.IsNullOrWhiteSpace(workingFolder) ? "global" : "project")}");
        return true;
    }

    // ── Copy to project ──

    /// <summary>
    /// Copies a persona from the source scope to a project library.
    /// If personaId is null, copies all built-in presets.
    /// </summary>
    public int CopyToProject(string? personaId, string projectFolder)
    {
        var count = 0;

        IEnumerable<string> idsToCopy;
        if (string.IsNullOrWhiteSpace(personaId))
        {
            idsToCopy = BuiltinPresetIds;
        }
        else
        {
            idsToCopy = [personaId];
        }

        foreach (var id in idsToCopy)
        {
            var config = GetPersona(id, workingFolder: null);
            if (config is null) continue;

            SavePersona(config, projectFolder);
            count++;
        }

        WorkerLog.Info($"persona copy to project folder={projectFolder} count={count} personaId={personaId ?? "<all>"}");
        return count;
    }

    // ── Built-in preset loading ──

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

                _builtinCache[presetId] = (summary, config);
            }
            catch (Exception ex)
            {
                WorkerLog.Warn($"failed to load builtin persona id={presetId} error={ex.Message}");
            }
        }

        WorkerLog.Info($"builtin personas loaded count={_builtinCache.Count}");
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
