using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.Modules.Skills;

/// <summary>
/// Skill scan engine — security scanning, folder installation, and temp cleanup.
/// Partial of SkillCatalog, separated by responsibility.
/// Ported from OpenCowork SkillCatalog, adapted for wishful-claw.
/// </summary>
internal static partial class SkillCatalog
{
    private const string TempRootName = "wishful-claw-skills";

    private static readonly HashSet<string> TextFileExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".md", ".txt", ".py", ".js", ".ts", ".tsx", ".sh", ".bash", ".ps1", ".bat", ".cmd",
        ".rb", ".pl", ".yaml", ".yml", ".json", ".toml", ".cfg", ".ini", ".env"
    };

    private static readonly HashSet<string> CodeFileExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".py", ".js", ".ts", ".sh", ".bash", ".ps1", ".bat", ".cmd", ".rb", ".pl"
    };

    // ── Public API (sync handlers) ──

    public static WorkerResponse Scan(JsonElement parameters)
    {
        var sourcePath = JsonHelpers.GetString(parameters, "sourcePath") ?? string.Empty;
        lock (Sync)
        {
            try
            {
                return ToResponse(ScanSkillDirectory(Path.GetFullPath(sourcePath)));
            }
            catch (Exception ex)
            {
                return ToResponse(new JsonObject { ["error"] = ex.Message });
            }
        }
    }

    public static WorkerResponse AddFromFolder(JsonElement parameters)
    {
        var sourcePath = JsonHelpers.GetString(parameters, "sourcePath") ?? string.Empty;
        lock (Sync)
        {
            try
            {
                var sourceDir = Path.GetFullPath(sourcePath);
                var sourceManifest = Path.Combine(sourceDir, SkillFileName);
                if (!File.Exists(sourceManifest))
                {
                    return ToResponse(Mutation(false, $"No {SkillFileName} found in the selected folder"));
                }

                var skillName = Path.GetFileName(sourceDir.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar));
                if (!IsSafeSkillName(skillName))
                {
                    return ToResponse(Mutation(false, "Invalid skill folder name"));
                }

                var targetDir = ResolveInstalledSkillPath(skillName);
                if (Directory.Exists(targetDir))
                {
                    return ToResponse(Mutation(false, $"Skill \"{skillName}\" already exists"));
                }

                Directory.CreateDirectory(SkillsDirectory());
                CopyDirectory(sourceDir, targetDir);
                WorkerLog.Debug($"skills add from folder name={skillName}");
                return ToResponse(new JsonObject
                {
                    ["success"] = true,
                    ["name"] = skillName
                });
            }
            catch (Exception ex)
            {
                return ToResponse(Mutation(false, ex.Message));
            }
        }
    }

    public static WorkerResponse CleanupTemp(JsonElement parameters)
    {
        var tempPath = JsonHelpers.GetString(parameters, "tempPath") ?? string.Empty;
        try
        {
            var fullPath = Path.GetFullPath(tempPath);
            var tempRoot = Path.GetFullPath(Path.Combine(Path.GetTempPath(), TempRootName));
            if (fullPath != tempRoot && !fullPath.StartsWith(tempRoot + Path.DirectorySeparatorChar, StringComparison.Ordinal))
            {
                WorkerLog.Warn($"skills cleanup refused non-temp path={tempPath}");
                return ToResponse(new JsonObject { ["success"] = false });
            }

            var relative = Path.GetRelativePath(tempRoot, fullPath);
            var firstSegment = relative.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)[0];
            var baseTempDir = Path.Combine(tempRoot, firstSegment);
            if (Directory.Exists(baseTempDir))
            {
                Directory.Delete(baseTempDir, recursive: true);
            }
            else if (Directory.Exists(fullPath))
            {
                Directory.Delete(fullPath, recursive: true);
            }

            return ToResponse(new JsonObject { ["success"] = true });
        }
        catch (Exception ex)
        {
            WorkerLog.Warn($"skills cleanup failed error={ex.GetType().Name}: {ex.Message}");
            return ToResponse(new JsonObject { ["success"] = false });
        }
    }

    // ── Private scan helpers ──

    private static JsonObject ScanSkillDirectory(string sourceDir)
    {
        var sourceManifest = Path.Combine(sourceDir, SkillFileName);
        if (!File.Exists(sourceManifest))
        {
            return new JsonObject { ["error"] = $"No {SkillFileName} found in the selected folder" };
        }

        var skillName = Path.GetFileName(sourceDir);
        var skillContent = File.ReadAllText(sourceManifest);
        var scriptContents = new JsonArray();
        var files = new JsonArray();
        WalkFiles(sourceDir, (fullPath, relativePath) =>
        {
            var extension = Path.GetExtension(fullPath).ToLowerInvariant();
            var info = new FileInfo(fullPath);
            files.Add((JsonNode?)new JsonObject
            {
                ["name"] = relativePath,
                ["size"] = info.Length,
                ["type"] = string.IsNullOrWhiteSpace(extension) ? "unknown" : extension
            });

            if (CodeFileExtensions.Contains(extension))
            {
                try
                {
                    scriptContents.Add((JsonNode?)new JsonObject
                    {
                        ["file"] = relativePath,
                        ["content"] = File.ReadAllText(fullPath)
                    });
                }
                catch
                {
                    // Skip unreadable files.
                }
            }
        });

        var allContents = new List<(string File, string Content)> { (SkillFileName, skillContent) };
        foreach (var script in scriptContents.OfType<JsonObject>())
        {
            allContents.Add((ReadNodeString(script, "file"), ReadNodeString(script, "content")));
        }

        return new JsonObject
        {
            ["name"] = skillName,
            ["description"] = ExtractDescription(skillContent, skillName),
            ["files"] = files,
            ["risks"] = AnalyzeRisks(allContents),
            ["skillMdContent"] = skillContent,
            ["scriptContents"] = scriptContents
        };
    }

    private static JsonArray AnalyzeRisks(IReadOnlyList<(string File, string Content)> contents)
    {
        var risks = new JsonArray();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        foreach (var (file, content) in contents)
        {
            var lines = content.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');
            foreach (var pattern in RiskPatterns())
            {
                for (var index = 0; index < lines.Length; index++)
                {
                    if (!pattern.Regex.IsMatch(lines[index])) continue;
                    var key = $"{file}\0{index + 1}\0{pattern.Category}";
                    if (!seen.Add(key)) continue;
                    risks.Add((JsonNode?)new JsonObject
                    {
                        ["severity"] = pattern.Severity,
                        ["category"] = pattern.Category,
                        ["detail"] = pattern.Label,
                        ["file"] = file,
                        ["line"] = index + 1
                    });
                }
            }
        }
        return risks;
    }

    private static IReadOnlyList<RiskPattern> RiskPatterns()
    {
        return
        [
            new(RmRfRegex(), "danger", "shell", "rm -rf"),
            new(DelForceRegex(), "danger", "shell", "del /f"),
            new(FormatDriveRegex(), "danger", "shell", "format drive"),
            new(MkfsRegex(), "danger", "shell", "mkfs"),
            new(DdRegex(), "danger", "shell", "dd"),
            new(EvalRegex(), "danger", "execution", "eval()"),
            new(ExecRegex(), "warning", "execution", "exec()"),
            new(SubprocessRegex(), "warning", "execution", "subprocess"),
            new(OsSystemRegex(), "danger", "execution", "os.system()"),
            new(ChildProcessRegex(), "warning", "execution", "child_process"),
            new(OsPopenRegex(), "danger", "execution", "os.popen()"),
            new(RequestsRegex(), "warning", "network", "requests HTTP call"),
            new(UrllibRegex(), "warning", "network", "urllib"),
            new(FetchRegex(), "warning", "network", "fetch()"),
            new(CurlRegex(), "warning", "network", "curl"),
            new(WgetRegex(), "warning", "network", "wget"),
            new(HttpClientRegex(), "warning", "network", "HTTP client"),
            new(ApiKeyRegex(), "warning", "credential", "API key reference"),
            new(PasswordRegex(), "danger", "credential", "password assignment"),
            new(TokenRegex(), "warning", "credential", "token reference"),
            new(ShutilRmtreeRegex(), "danger", "filesystem", "shutil.rmtree()"),
            new(OsRemoveRegex(), "warning", "filesystem", "os.remove()"),
            new(FsDeleteRegex(), "danger", "filesystem", "fs delete"),
            new(Base64SendRegex(), "danger", "exfiltration", "base64 + send")
        ];
    }

    private sealed record RiskPattern(Regex Regex, string Severity, string Category, string Label);

    // ── Risk regex patterns (generated) ──

    [GeneratedRegex(@"\brm\s+-rf\b", RegexOptions.CultureInvariant)]
    private static partial Regex RmRfRegex();

    [GeneratedRegex(@"\bdel\s+\/[fFsS]", RegexOptions.CultureInvariant)]
    private static partial Regex DelForceRegex();

    [GeneratedRegex(@"\bformat\s+[A-Z]:", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex FormatDriveRegex();

    [GeneratedRegex(@"\bmkfs\b", RegexOptions.CultureInvariant)]
    private static partial Regex MkfsRegex();

    [GeneratedRegex(@"\bdd\s+if=", RegexOptions.CultureInvariant)]
    private static partial Regex DdRegex();

    [GeneratedRegex(@"\beval\s*\(", RegexOptions.CultureInvariant)]
    private static partial Regex EvalRegex();

    [GeneratedRegex(@"\bexec\s*\(", RegexOptions.CultureInvariant)]
    private static partial Regex ExecRegex();

    [GeneratedRegex(@"\bsubprocess\b", RegexOptions.CultureInvariant)]
    private static partial Regex SubprocessRegex();

    [GeneratedRegex(@"\bos\.system\s*\(", RegexOptions.CultureInvariant)]
    private static partial Regex OsSystemRegex();

    [GeneratedRegex(@"\bchild_process\b", RegexOptions.CultureInvariant)]
    private static partial Regex ChildProcessRegex();

    [GeneratedRegex(@"\bos\.popen\s*\(", RegexOptions.CultureInvariant)]
    private static partial Regex OsPopenRegex();

    [GeneratedRegex(@"\brequests\.(get|post|put|delete|patch)\s*\(", RegexOptions.CultureInvariant)]
    private static partial Regex RequestsRegex();

    [GeneratedRegex(@"\burllib\b", RegexOptions.CultureInvariant)]
    private static partial Regex UrllibRegex();

    [GeneratedRegex(@"\bfetch\s*\(", RegexOptions.CultureInvariant)]
    private static partial Regex FetchRegex();

    [GeneratedRegex(@"\bcurl\s+", RegexOptions.CultureInvariant)]
    private static partial Regex CurlRegex();

    [GeneratedRegex(@"\bwget\s+", RegexOptions.CultureInvariant)]
    private static partial Regex WgetRegex();

    [GeneratedRegex(@"\bhttpx?\.\w+\s*\(", RegexOptions.CultureInvariant)]
    private static partial Regex HttpClientRegex();

    [GeneratedRegex(@"\b(api_key|apikey|api[-_]?secret)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex ApiKeyRegex();

    [GeneratedRegex(@"\b(password|passwd)\s*[=:]", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex PasswordRegex();

    [GeneratedRegex(@"\b(access_token|auth_token|bearer)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex TokenRegex();

    [GeneratedRegex(@"\bshutil\.rmtree\s*\(", RegexOptions.CultureInvariant)]
    private static partial Regex ShutilRmtreeRegex();

    [GeneratedRegex(@"\bos\.remove\s*\(", RegexOptions.CultureInvariant)]
    private static partial Regex OsRemoveRegex();

    [GeneratedRegex(@"\bfs\.(unlinkSync|rmSync)\s*\(", RegexOptions.CultureInvariant)]
    private static partial Regex FsDeleteRegex();

    [GeneratedRegex(@"\bbase64\b.*\b(send|post|upload)\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex Base64SendRegex();
}
