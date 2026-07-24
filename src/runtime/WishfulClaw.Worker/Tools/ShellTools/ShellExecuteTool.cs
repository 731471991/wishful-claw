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
              "description": "Preferred shell executable. On Windows: cmd.exe, powershell.exe, pwsh.exe. On Unix: zsh, bash, sh. Defaults to platform default."
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

            var totalMs = (long)Math.Round(
                Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds);

            var result = FormatOutput(
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
            var totalMs = (long)Math.Round(
                Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds);
            var result = FormatOutput(
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
            ? new ShellLaunch(Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe", [])
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
            // cmd.exe (ComSpec) — most compatible
            yield return new ShellLaunch(
                Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe", []);
            // PowerShell (Windows PowerShell 5.x)
            yield return new ShellLaunch("powershell.exe", []);
            // pwsh (PowerShell 7+)
            yield return new ShellLaunch("pwsh.exe", []);
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

    // ── Output formatting ──

    private static string FormatOutput(
        string stdout, string stderr, int exitCode, bool timedOut,
        string cwd, string command, string shell,
        long totalMs, long spawnMs, long? firstChunkMs)
    {
        var builder = new StringBuilder();
        builder.Append("{\"exitCode\":");
        builder.Append(exitCode);

        builder.Append(",\"shell\":\"");
        builder.Append(EscapeJson(shell));
        builder.Append('"');

        builder.Append(",\"cwd\":\"");
        builder.Append(EscapeJson(cwd));
        builder.Append('"');

        builder.Append(",\"command\":\"");
        builder.Append(EscapeJson(command));
        builder.Append('"');

        builder.Append(",\"totalMs\":");
        builder.Append(totalMs);

        builder.Append(",\"spawnMs\":");
        builder.Append(spawnMs);

        if (firstChunkMs.HasValue)
        {
            builder.Append(",\"firstChunkMs\":");
            builder.Append(firstChunkMs.Value);
        }

        if (timedOut)
        {
            builder.Append(",\"timedOut\":true");
        }

        if (!string.IsNullOrEmpty(stdout))
        {
            builder.Append(",\"stdout\":\"");
            builder.Append(EscapeJson(stdout));
            builder.Append('"');
        }

        if (!string.IsNullOrEmpty(stderr))
        {
            builder.Append(",\"stderr\":\"");
            builder.Append(EscapeJson(stderr));
            builder.Append('"');
        }

        builder.Append('}');
        return builder.ToString();
    }

    private static string EscapeJson(string s)
    {
        var builder = new StringBuilder(s.Length);
        foreach (var c in s)
        {
            switch (c)
            {
                case '\\': builder.Append("\\\\"); break;
                case '"': builder.Append("\\\""); break;
                case '\n': builder.Append("\\n"); break;
                case '\r': builder.Append("\\r"); break;
                case '\t': builder.Append("\\t"); break;
                default:
                    if (c < 32)
                    {
                        builder.Append($"\\u{(int)c:X4}");
                    }
                    else
                    {
                        builder.Append(c);
                    }
                    break;
            }
        }
        return builder.ToString();
    }

    private static long ElapsedMs(long startedAt)
    {
        return (long)Math.Round(Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds);
    }

    // ── Inner types ──

    private sealed record ShellLaunch(string Shell, string[] Args);

    private sealed class RunningProcess
    {
        public Process Process { get; }
        public string? AbortReason { get; private set; }

        public RunningProcess(Process process) => Process = process;

        public void Abort(string reason)
        {
            AbortReason ??= reason;
            try
            {
                if (!Process.HasExited)
                {
                    Process.Kill(entireProcessTree: true);
                }
            }
            catch { }
        }
    }

    /// <summary>
    /// Collects output with a character limit, truncating gracefully.
    /// </summary>
    private sealed class OutputCollector
    {
        private readonly int _maxChars;
        private readonly StringBuilder _builder = new();
        private bool _truncated;

        public OutputCollector(int maxChars) => _maxChars = maxChars;

        public void Append(char[] buffer, int offset, int count)
        {
            if (_truncated) return;

            var remaining = _maxChars - _builder.Length;
            if (remaining <= 0)
            {
                Truncate();
                return;
            }

            if (count <= remaining)
            {
                _builder.Append(buffer, offset, count);
                return;
            }

            _builder.Append(buffer, offset, remaining);
            Truncate();
        }

        private void Truncate()
        {
            if (_truncated) return;
            _truncated = true;
            _builder.AppendLine();
            _builder.Append($"[output truncated at {_maxChars} chars]");
        }

        public override string ToString() => _builder.ToString();
    }
}
