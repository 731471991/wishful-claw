using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace WishfulClaw.Agent.Modules.Git;

/// <summary>
/// Executes local git commands with timeout, output limiting, and error normalization.
/// </summary>
public static class GitExecutor
{
    private const int DefaultGitTimeoutMs = 60_000;
    private const int DefaultMaxStdoutChars = 512 * 1024;
    private const int DefaultMaxStderrChars = 64 * 1024;

    /// <summary>
    /// Runs git with the given args in the specified working directory.
    /// </summary>
    public static async Task<GitExecResult> ExecAsync(
        IReadOnlyList<string> args,
        string cwd,
        int timeoutMs = DefaultGitTimeoutMs,
        int maxStdoutChars = DefaultMaxStdoutChars,
        int maxStderrChars = DefaultMaxStderrChars)
    {
        // Prepend -C <cwd> so we don't need to chdir
        var fullArgs = new List<string>(args.Count + 2) { "-C", cwd };
        fullArgs.AddRange(args);

        using var process = new Process();
        process.StartInfo = new ProcessStartInfo
        {
            FileName = "git",
            WorkingDirectory = cwd,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };
        foreach (var arg in fullArgs)
        {
            process.StartInfo.ArgumentList.Add(arg);
        }

        try
        {
            process.Start();
        }
        catch (Exception ex)
        {
            return new GitExecResult(false, string.Empty, ex.Message, 1, "UNKNOWN", false, false);
        }

        using var cts = new CancellationTokenSource(Math.Max(1_000, timeoutMs));
        var stdoutTask = ReadLimitedAsync(process.StandardOutput, maxStdoutChars, cts.Token);
        var stderrTask = ReadLimitedAsync(process.StandardError, maxStderrChars, cts.Token);
        var timedOut = false;

        try
        {
            await process.WaitForExitAsync(cts.Token);
        }
        catch (OperationCanceledException)
        {
            timedOut = true;
            TryKill(process);
        }

        var stdout = await stdoutTask;
        var stderr = await stderrTask;
        var exitCode = timedOut ? 124 : process.ExitCode;
        var (errorType, errorMessage) = timedOut
            ? ("UNKNOWN", "Git command timed out")
            : NormalizeGitError(stderr.Text, exitCode, "UNKNOWN");

        return new GitExecResult(
            exitCode == 0 && !timedOut,
            stdout.Text,
            errorMessage,
            exitCode,
            errorType,
            stdout.Truncated,
            stderr.Truncated);
    }

    /// <summary>
    /// Reads from a stream up to maxChars, reporting truncation.
    /// </summary>
    private static async Task<(string Text, bool Truncated)> ReadLimitedAsync(
        TextReader reader, int maxChars, CancellationToken cancellationToken)
    {
        var builder = new StringBuilder(Math.Min(Math.Max(maxChars, 0), 16_384));
        var buffer = new char[8192];
        var truncated = false;

        while (true)
        {
            int read;
            try
            {
                read = await reader.ReadAsync(buffer, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            if (read <= 0)
            {
                break;
            }

            var remaining = maxChars - builder.Length;
            if (remaining > 0)
            {
                builder.Append(buffer, 0, Math.Min(remaining, read));
            }
            if (read > remaining)
            {
                truncated = true;
            }
        }

        return (builder.ToString(), truncated);
    }

    /// <summary>
    /// Classifies common git errors into typed error categories.
    /// </summary>
    public static (string? ErrorType, string Message) NormalizeGitError(
        string stderr, int exitCode, string defaultType)
    {
        var message = stderr.Trim();
        var lower = message.ToLowerInvariant();
        if (lower.Contains("not a git repository"))
        {
            return ("NOT_GIT_REPO", message);
        }
        if (lower.Contains("authentication failed") || lower.Contains("could not read from remote repository"))
        {
            return ("AUTH_REQUIRED", message);
        }
        if (lower.Contains("merge conflict") || lower.Contains("conflict"))
        {
            return ("MERGE_CONFLICT", message);
        }
        if (lower.Contains("unstaged changes") || lower.Contains("would be overwritten"))
        {
            return ("UNCOMMITTED_CHANGES_BLOCKING", message);
        }
        if (lower.Contains("non-fast-forward"))
        {
            return ("NON_FAST_FORWARD", message);
        }
        return (exitCode == 0 ? null : defaultType,
            string.IsNullOrEmpty(message) ? "Git command failed" : message);
    }

    private static void TryKill(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch
        {
            // best effort
        }
    }

    /// <summary>
    /// Splits output into trimmed non-empty lines.
    /// </summary>
    public static List<string> NormalizeLines(string text)
    {
        return text
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(line => line.Trim().TrimEnd('\r'))
            .Where(line => line.Length > 0)
            .ToList();
    }

    /// <summary>
    /// Reads a required string parameter.
    /// </summary>
    public static string? GetString(JsonElement parameters, string name)
    {
        return parameters.ValueKind == JsonValueKind.Object &&
            parameters.TryGetProperty(name, out var prop) &&
            prop.ValueKind == JsonValueKind.String
                ? prop.GetString()
                : null;
    }

    /// <summary>
    /// Reads an optional int parameter with a default.
    /// </summary>
    public static int GetInt(JsonElement parameters, string name, int defaultValue)
    {
        return parameters.ValueKind == JsonValueKind.Object &&
            parameters.TryGetProperty(name, out var prop) &&
            prop.ValueKind == JsonValueKind.Number
                ? prop.GetInt32()
                : defaultValue;
    }

    /// <summary>
    /// Reads an optional bool parameter with a default.
    /// </summary>
    public static bool GetBool(JsonElement parameters, string name, bool defaultValue)
    {
        if (parameters.ValueKind != JsonValueKind.Object ||
            !parameters.TryGetProperty(name, out var prop))
        {
            return defaultValue;
        }
        return prop.ValueKind is JsonValueKind.True or JsonValueKind.False
            ? prop.GetBoolean()
            : defaultValue;
    }
}
