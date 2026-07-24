using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Worker.Tools.ShellTools;

using static WishfulClaw.Worker.Tools.ToolHelpers;

/// <summary>
/// Execute a shell command with timeout, output capture, shell selection, and abort support.
/// Adapted from OpenCowork ShellTools.cs (ShellModule) and AgentRuntimeNativeToolExecutor.ExecuteShellAsync.
/// </summary>
public sealed class ShellExecuteTool : IToolExecutor
{
    private const int DefaultTimeoutMs = 600_000;   // 10 minutes
    private const int MaxTimeoutMs = 3_600_000;      // 1 hour
    private const int MaxOutputChars = 64_000;       // 64KB per stream

    private static readonly ConcurrentDictionary<string, RunningProcess> Running = new(StringComparer.Ordinal);

    public string Name => "Bash";

    public string Description =>
        "Execute a shell command and return stdout, stderr, exit code, and timing. " +
        "Supports choosing the shell (PowerShell, cmd, bash, zsh), setting a working directory, " +
        "and environment variables. Use for running tests, building, git, file inspection, etc.";

    public JsonElement InputSchema => ParseSchema(
        """
        {
          "type": "object",
          "properties": {
            "command": {
              "type": "string",
              "description": "The shell command to execute"
            },
            "timeout": {
              "type": "integer",
              "description": "Timeout in milliseconds. Default: 600000 (10 min). Max: 3600000 (1 hour).",
              "default": 600000
            },
            "cwd": {
              "type": "string",
              "description": "Working directory. Defaults to the session working folder."
            },
            "shell": {
              "type": "string",
              "description": "Preferred shell executable. On Windows: powershell.exe, pwsh.exe, cmd.exe. On Unix: zsh, bash, sh. Defaults to platform default."
            },
            "env": {
              "type": "object",
              "description": "Additional environment variables (key-value pairs).",
              "additionalProperties": { "type": "string" }
            }
          },
          "required": ["command"]
        }
        """);

    public async Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        var command = GetString(input, "command");
        if (string.IsNullOrWhiteSpace(command))
        {
            return new ToolResult(
                "{\"exitCode\":1,\"stderr\":\"Missing 'command' field\"}",
                IsError: true,
                Error: "Missing 'command' field");
        }

        var cwd = ResolveCwd(GetString(input, "cwd"), context.WorkingFolder);
        var preferredShell = GetString(input, "shell");
        var timeoutMs = Math.Clamp(
            GetInt(input, "timeout", DefaultTimeoutMs),
            1,
            MaxTimeoutMs);

        var launch = ResolveLaunch(preferredShell);
        var startedAt = Stopwatch.GetTimestamp();

        try
        {
            var (stdout, stderr, exitCode, timedOut, spawnMs, firstChunkMs) = await RunProcessAsync(
                command, cwd, launch, input, timeoutMs, context.CancellationToken);

            var totalMs = ElapsedMs(startedAt);

            var result = ShellOutputFormatter.Format(
                stdout, stderr, exitCode, timedOut,
                cwd, command, launch.Shell, totalMs, spawnMs, firstChunkMs);

            var isError = exitCode != 0 && string.IsNullOrWhiteSpace(stdout) && string.IsNullOrWhiteSpace(stderr);
            return new ToolResult(result, isError);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            var totalMs = ElapsedMs(startedAt);
            var result = ShellOutputFormatter.Format(
                string.Empty, ex.Message, -1, false,
                cwd, command, launch.Shell, totalMs, 0, null);
            return new ToolResult(result, IsError: true, Error: ex.Message);
        }
    }

    // ── Process execution ──

    private static async Task<(string Stdout, string Stderr, int ExitCode, bool TimedOut, long SpawnMs, long? FirstChunkMs)> RunProcessAsync(
        string command,
        string cwd,
        ShellLaunch launch,
        JsonElement input,
        int timeoutMs,
        CancellationToken cancellationToken)
    {
        var startInfo = CreateProcessStartInfo(launch, command, cwd, input);

        using var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
        var stdoutCollector = new OutputCollector(MaxOutputChars);
        var stderrCollector = new OutputCollector(MaxOutputChars);

        var spawnStartedAt = Stopwatch.GetTimestamp();
        process.Start();
        var spawnMs = ElapsedMs(spawnStartedAt);

        using var timeoutCts = new CancellationTokenSource(timeoutMs);
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        long? firstChunkMs = null;

        var stdoutTask = ReadStreamAsync(
            process.StandardOutput, stdoutCollector, linkedCts.Token,
            () => firstChunkMs ??= ElapsedMs(spawnStartedAt));
        var stderrTask = ReadStreamAsync(
            process.StandardError, stderrCollector, linkedCts.Token,
            () => firstChunkMs ??= ElapsedMs(spawnStartedAt));

        bool timedOut = false;

        try
        {
            await process.WaitForExitAsync(linkedCts.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            timedOut = true;
            TryKillProcessTree(process);
            try { await process.WaitForExitAsync(CancellationToken.None); } catch { }
        }

        try { await stdoutTask; } catch { }
        try { await stderrTask; } catch { }

        var exitCode = timedOut ? 124 : process.ExitCode;
        return (stdoutCollector.ToString(), stderrCollector.ToString(), exitCode, timedOut, spawnMs, firstChunkMs);
    }

    private static ProcessStartInfo CreateProcessStartInfo(
        ShellLaunch launch, string command, string cwd, JsonElement input)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = launch.Shell,
            WorkingDirectory = cwd,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
            CreateNoWindow = true
        };

        foreach (var arg in GetLaunchArgs(launch, command))
        {
            startInfo.ArgumentList.Add(arg);
        }

        ApplyEnvironment(startInfo, input);
        return startInfo;
    }

    private static void ApplyEnvironment(ProcessStartInfo startInfo, JsonElement input)
    {
        if (!input.TryGetProperty("env", out var envElement) || envElement.ValueKind != JsonValueKind.Object)
        {
            return;
        }

        foreach (var prop in envElement.EnumerateObject())
        {
            if (prop.Value.ValueKind == JsonValueKind.String)
            {
                startInfo.Environment[prop.Name] = prop.Value.GetString() ?? string.Empty;
            }
        }
    }

    // ── Shell resolution (adapted from OpenCowork ShellTools.ResolveLaunch) ──

    private static ShellLaunch ResolveLaunch(string? preferredShell)
    {
        foreach (var launch in GetShellLaunchCandidates(preferredShell))
        {
            if (OperatingSystem.IsWindows() || File.Exists(launch.Shell))
            {
                return launch;
            }
        }

        return OperatingSystem.IsWindows()
            ? new ShellLaunch("powershell.exe", [])
            : new ShellLaunch("/bin/sh", []);
    }

    private static IEnumerable<ShellLaunch> GetShellLaunchCandidates(string? preferredShell)
    {
        var preferred = preferredShell?.Trim();

        if (OperatingSystem.IsWindows())
        {
            // User-specified shell first
            if (!string.IsNullOrEmpty(preferred))
            {
                yield return new ShellLaunch(preferred, []);
            }
            // Windows default: PowerShell (most capable for scripting)
            yield return new ShellLaunch("powershell.exe", []);
            // pwsh (PowerShell 7+)
            yield return new ShellLaunch("pwsh.exe", []);
            // cmd.exe as last-resort fallback
            yield return new ShellLaunch(
                Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe", []);
            yield break;
        }

        // Unix: try preferred → $SHELL → zsh → bash → sh
        foreach (var shell in new[]
        {
            preferred,
            Environment.GetEnvironmentVariable("SHELL"),
            "/bin/zsh",
            "/bin/bash",
            "/bin/sh"
        })
        {
            if (string.IsNullOrWhiteSpace(shell))
            {
                continue;
            }

            yield return new ShellLaunch(shell, shell == "/bin/sh" ? [] : ["-i"]);
        }
    }

    private static IEnumerable<string> GetLaunchArgs(ShellLaunch launch, string command)
    {
        if (OperatingSystem.IsWindows())
        {
            if (IsPowerShell(launch.Shell))
            {
                return ["-NoLogo", "-NoProfile", "-Command", command];
            }
            // cmd.exe
            return ["/d", "/s", "/c", command];
        }

        // Unix: interactive flags from launch + -lc command
        return launch.Args.Concat(["-lc", command]);
    }

    private static bool IsPowerShell(string shell)
    {
        var name = Path.GetFileName(shell).ToLowerInvariant();
        return name is "powershell.exe" or "powershell" or "pwsh.exe" or "pwsh";
    }

    // ── Working directory resolution ──

    private static string ResolveCwd(string? cwd, string? fallback)
    {
        if (!string.IsNullOrWhiteSpace(cwd) && Directory.Exists(cwd))
        {
            return Path.GetFullPath(cwd);
        }

        if (!string.IsNullOrWhiteSpace(fallback) && Directory.Exists(fallback))
        {
            return Path.GetFullPath(fallback);
        }

        var home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        return Directory.Exists(home) ? home : Environment.CurrentDirectory;
    }

    // ── Stream reading ──

    private static async Task ReadStreamAsync(
        StreamReader reader,
        OutputCollector collector,
        CancellationToken ct,
        Action onFirstChunk)
    {
        var buffer = new char[4096];
        var firstChunkRecorded = false;

        while (!ct.IsCancellationRequested)
        {
            int read;
            try
            {
                read = await reader.ReadAsync(buffer, ct);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            if (read <= 0)
            {
                break;
            }

            if (!firstChunkRecorded)
            {
                firstChunkRecorded = true;
                onFirstChunk();
            }

            collector.Append(buffer, 0, read);
        }
    }

    // ── Process kill ──

    private static void TryKillProcessTree(Process process)
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
            // Process may have exited between check and Kill
        }
    }

    // ── Timing helper ──

    private static long ElapsedMs(long startedAt)
    {
        return (long)Math.Round(Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds);
    }
}
