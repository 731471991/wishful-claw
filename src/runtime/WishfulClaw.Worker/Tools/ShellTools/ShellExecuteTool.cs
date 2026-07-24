using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Worker.Tools.ShellTools;

using static WishfulClaw.Worker.Tools.ToolHelpers;

/// <summary>
/// Execute a shell command with timeout, output capture, and working directory support.
/// Adapted from OpenCowork AgentRuntimeNativeToolExecutor.ExecuteShellAsync
/// and ShellTools.cs (ShellModule).
/// </summary>
public sealed class ShellExecuteTool : IToolExecutor
{
    private const int DefaultTimeoutMs = 600_000;   // 10 minutes
    private const int MaxTimeoutMs = 3_600_000;      // 1 hour
    private const int MaxOutputChars = 64_000;       // 64KB per stream

    public string Name => "Bash";

    public string Description =>
        "Execute a shell command and return stdout, stderr, and exit code. " +
        "Commands run in the working folder by default, or in the specified `cwd` if provided. " +
        "Use this tool for running tests, building projects, inspecting files, git operations, etc. " +
        "Output is truncated if too long (64KB per stream).";

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
              "description": "Working directory for the command. Defaults to the session working folder."
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

        // Resolve working directory: explicit cwd > session working folder > user home
        var cwd = GetString(input, "cwd");
        if (string.IsNullOrWhiteSpace(cwd))
        {
            cwd = context.WorkingFolder;
        }
        if (!string.IsNullOrWhiteSpace(cwd) && !Directory.Exists(cwd))
        {
            cwd = null;
        }
        if (string.IsNullOrWhiteSpace(cwd))
        {
            cwd = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        }

        var timeoutMs = Math.Clamp(
            GetInt(input, "timeout", DefaultTimeoutMs),
            1,
            MaxTimeoutMs);

        var startedAt = Stopwatch.GetTimestamp();

        try
        {
            var (stdout, stderr, exitCode, timedOut) = await RunProcessAsync(
                command, cwd, timeoutMs, context.CancellationToken);

            var elapsedMs = (long)Math.Round(
                Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds);

            var result = FormatOutput(stdout, stderr, exitCode, timedOut, cwd, command, elapsedMs);

            // Treat non-zero exit as error only if there's no stdout (heuristic:
            // tests/builds often exit non-zero with useful stdout)
            var isError = exitCode != 0 && string.IsNullOrWhiteSpace(stdout) && string.IsNullOrWhiteSpace(stderr);
            return new ToolResult(result, isError);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            var elapsedMs = (long)Math.Round(
                Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds);
            var result = FormatOutput(
                string.Empty, ex.Message, -1, false, cwd, command, elapsedMs);
            return new ToolResult(result, IsError: true, Error: ex.Message);
        }
    }

    private static async Task<(string Stdout, string Stderr, int ExitCode, bool TimedOut)> RunProcessAsync(
        string command,
        string workingDirectory,
        int timeoutMs,
        CancellationToken cancellationToken)
    {
        var psi = CreateProcessStartInfo(command, workingDirectory);

        using var process = new Process { StartInfo = psi, EnableRaisingEvents = true };

        using var timeoutCts = new CancellationTokenSource(timeoutMs);
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        process.Start();

        var stdoutCollector = new OutputCollector(MaxOutputChars);
        var stderrCollector = new OutputCollector(MaxOutputChars);

        var stdoutTask = ReadStreamAsync(process.StandardOutput, stdoutCollector, linkedCts.Token);
        var stderrTask = ReadStreamAsync(process.StandardError, stderrCollector, linkedCts.Token);

        bool timedOut = false;

        try
        {
            await process.WaitForExitAsync(linkedCts.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // Timeout
            timedOut = true;
            TryKillProcessTree(process);
            // Wait for process to actually exit after kill
            try
            {
                await process.WaitForExitAsync(CancellationToken.None);
            }
            catch
            {
                // ignore
            }
        }

        // Ensure stream reading is complete
        try { await stdoutTask; } catch { }
        try { await stderrTask; } catch { }

        var exitCode = timedOut ? 124 : process.ExitCode;
        return (stdoutCollector.ToString(), stderrCollector.ToString(), exitCode, timedOut);
    }

    private static ProcessStartInfo CreateProcessStartInfo(string command, string workingDirectory)
    {
        var isWindows = OperatingSystem.IsWindows();
        var startInfo = new ProcessStartInfo
        {
            // On Windows use cmd.exe; on macOS/Linux use the user's shell or fall back to /bin/sh
            FileName = isWindows
                ? (Environment.GetEnvironmentVariable("ComSpec") ?? "cmd.exe")
                : (Environment.GetEnvironmentVariable("SHELL") ?? "/bin/sh"),
            WorkingDirectory = workingDirectory,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
            CreateNoWindow = true
        };

        if (isWindows)
        {
            // Use ArgumentList to avoid quoting issues with complex commands
            startInfo.ArgumentList.Add("/d");   // Disable AutoRun from registry
            startInfo.ArgumentList.Add("/s");   // Enable old-style quoting
            startInfo.ArgumentList.Add("/c");   // Execute and terminate
            startInfo.ArgumentList.Add(command);
        }
        else
        {
            // -l: login shell (loads profile), -c: execute command
            startInfo.ArgumentList.Add("-lc");
            startInfo.ArgumentList.Add(command);
        }

        return startInfo;
    }

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

    private static async Task ReadStreamAsync(
        StreamReader reader,
        OutputCollector collector,
        CancellationToken ct)
    {
        var buffer = new char[4096];
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

            collector.Append(buffer, 0, read);
        }
    }

    private static string FormatOutput(
        string stdout, string stderr, int exitCode,
        bool timedOut, string cwd, string command, long elapsedMs)
    {
        var builder = new StringBuilder();
        builder.Append("{\"exitCode\":");
        builder.Append(exitCode);

        builder.Append(",\"cwd\":\"");
        builder.Append(EscapeJson(cwd));
        builder.Append('"');

        builder.Append(",\"command\":\"");
        builder.Append(EscapeJson(command));
        builder.Append('"');

        builder.Append(",\"totalMs\":");
        builder.Append(elapsedMs);

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

    /// <summary>
    /// Collects output with a character limit, truncating gracefully.
    /// </summary>
    private sealed class OutputCollector
    {
        private readonly int _maxChars;
        private readonly StringBuilder _builder = new();
        private bool _truncated;

        public OutputCollector(int maxChars)
        {
            _maxChars = maxChars;
        }

        public void Append(char[] buffer, int offset, int count)
        {
            if (_truncated)
            {
                return;
            }

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
