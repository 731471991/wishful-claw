using System.Text.Json;

namespace WishfulClaw.Agent.Modules.Skills;

/// <summary>
/// Manages the skills-config.json file that tracks enabled/disabled state.
/// Stored at ~/.agents/skills-config.json.
/// </summary>
public static partial class SkillConfigStore
{
    public sealed class ConfigData
    {
        public HashSet<string> DisabledSkills { get; } = [];
    }

    public static ConfigData Load()
    {
        var config = new ConfigData();
        try
        {
            var path = ConfigPath();
            if (!File.Exists(path))
            {
                return config;
            }

            var json = File.ReadAllText(path);
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind == JsonValueKind.Object &&
                doc.RootElement.TryGetProperty("disabledSkills", out var disabled) &&
                disabled.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in disabled.EnumerateArray())
                {
                    if (item.ValueKind == JsonValueKind.String)
                    {
                        var name = item.GetString();
                        if (!string.IsNullOrWhiteSpace(name))
                        {
                            config.DisabledSkills.Add(name);
                        }
                    }
                }
            }
        }
        catch
        {
            // If config is corrupt, treat all skills as enabled.
        }
        return config;
    }

    public static void Save(ConfigData config)
    {
        var path = ConfigPath();
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);

        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, new JsonWriterOptions { Indented = true }))
        {
            writer.WriteStartObject();
            writer.WritePropertyName("disabledSkills");
            writer.WriteStartArray();
            foreach (var name in config.DisabledSkills.OrderBy(n => n, StringComparer.Ordinal))
            {
                writer.WriteStringValue(name);
            }
            writer.WriteEndArray();
            writer.WriteEndObject();
        }
        File.WriteAllText(path, System.Text.Encoding.UTF8.GetString(stream.ToArray()));
    }

    private static string ConfigPath()
    {
        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".agents",
            "skills-config.json");
    }
}
