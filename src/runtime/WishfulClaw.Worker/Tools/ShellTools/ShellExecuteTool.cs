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
        "On Windows, PowerShell is the default and recommended shell for reliable Unicode support. " +
        "Avoid cmd.exe unless specifically needed — its UTF-8 piping is unreliable for non-ASCII text. " +
        "Supports choosing the shell (PowerShell, cmd, bash, zsh), setting a working directory, " +
        "and environment variables. Use for running tests, building, git, file inspection, etc. " +
        "When sshConnectionId is provided, the command executes on the remote SSH server instead of locally. " +
        "Use SshListConnections to discover available connection IDs.";

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
            },
            "sshConnectionId": {
              "type": "string",
              "description": "SSH connection ID. When provided, the command executes on the remote server via SSH instead of locally. Use SshListConnections to get available IDs. If the project has a bound SSH connection, this parameter is auto-filled."
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
        // For cmd.exe, use the system default code page (usually GBK/936 on
        // Chinese Windows) because chcp 65001 doesn't reliably affect piped
        // output from all legacy programs. For PowerShell/bash, UTF-8 is safe.
        var isCmd = OperatingSystem.IsWindows() && !IsPowerShell(launch.Shell);
        var outputEncoding = isCmd ? GetSystemEncoding() : Encoding.UTF8;

        var startInfo = new ProcessStartInfo
        {
            FileName = launch.Shell,
            WorkingDirectory = cwd,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = outputEncoding,
            StandardErrorEncoding = outputEncoding,
            CreateNoWindow = true
        };

        foreach (var arg in GetLaunchArgs(launch, command))
        {
            startInfo.ArgumentList.Add(arg);
        }

        // Ensure child processes use UTF-8 for console I/O (fixes Chinese garbled output)
        startInfo.Environment["PYTHONUTF8"] = "1";
        startInfo.Environment["PYTHONIOENCODING"] = "utf-8";
        if (OperatingSystem.IsWindows())
        {
            startInfo.Environment["LANG"] = "zh_CN.UTF-8";
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
        // Priority: per-call 'shell' param > env WISHFUL_SHELL > platform default
        var envShell = Environment.GetEnvironmentVariable("WISHFUL_SHELL")?.Trim();
        var effective = !string.IsNullOrEmpty(preferredShell) ? preferredShell : envShell;

        foreach (var launch in GetShellLaunchCandidates(effective))
        {
            if (OperatingSystem.IsWindows())
            {
                // On Windows, trust well-known shells; for custom paths, verify existence
                if (IsPowerShell(launch.Shell) || launch.Shell.EndsWith("cmd.exe", StringComparison.OrdinalIgnoreCase))
                    return launch;
                if (File.Exists(launch.Shell))
                    return launch;
            }
            else if (File.Exists(launch.Shell))
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
                // Prepend chcp 65001 to force UTF-8 console output,
                // then set OutputEncoding so PowerShell pipes UTF-8 too.
                var wrappedCommand =
                    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; " +
                    "$OutputEncoding = [System.Text.Encoding]::UTF8; " +
                    command;
                return ["-NoLogo", "-NoProfile", "-Command", wrappedCommand];
            }
            // cmd.exe — read output with system ANSI code page (GBK/936)
            // instead of trying to force UTF-8, which is unreliable for piped
            // output from legacy programs. No chcp needed.
            return ["/d", "/s", "/c", command];
        }

        // Unix: interactive flags from launch + -lc command
        return launch.Args.Concat(["-lc", command]);
    }

    private static Encoding? _systemEncoding;

    /// <summary>
    /// Get the system ANSI code page encoding (e.g. GBK/936 on Chinese Windows).
    /// Falls back to UTF-8 if the code page is not available.
    /// </summary>
    private static Encoding GetSystemEncoding()
    {
        if (_systemEncoding is not null) return _systemEncoding;

        // Ensure code page providers are registered (needed on .NET Core/.NET 5+)
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

        try
        {
            // GetACP() returns the system ANSI code page (936 for Chinese)
            var codePage = GetSystemCodePage();
            _systemEncoding = Encoding.GetEncoding(codePage);
        }
        catch
        {
            _systemEncoding = Encoding.UTF8;
        }

        return _systemEncoding;
    }

    [System.Runtime.InteropServices.DllImport("kernel32.dll")]
    private static extern uint GetACP();

    private static int GetSystemCodePage()
    {
        try { return (int)GetACP(); }
        catch { return 0; }
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
