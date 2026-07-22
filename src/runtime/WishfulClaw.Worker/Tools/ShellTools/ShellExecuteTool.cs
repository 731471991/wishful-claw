using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Worker.Tools.ShellTools;

using static WishfulClaw.Worker.Tools.ToolHelpers;

/// <summary>
/// Execute a shell command with timeout and output capture.
/// Adapted from OpenCowork AgentRuntimeNativeToolExecutor.ExecuteShellAsync.
/// </summary>
public sealed class ShellExecuteTool : IToolExecutor
{
    private const int DefaultTimeoutMs = 600_000;  // 10 minutes
    private const int MaxTimeoutMs = 3_600_000;     // 1 hour
    private const int MaxOutputChars = 12_000;

    public string Name => "Bash";

    public string Description => "Execute a bash/shell command. Returns stdout, stderr, and exit code. Commands run in the working folder if set. Output is truncated if too long.";

    public JsonElement InputSchema => ParseSchema(
        """{"type":"object","properties":{"command":{"type":"string","description":"The shell command to execute"},"timeout":{"type":"integer","description":"Timeout in milliseconds. Default: 600000 (10 min). Max: 3600000 (1 hour).","default":600000}},"required":["command"]}""");

    public async Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        var command = GetString(input, "command");
        if (string.IsNullOrWhiteSpace(command))
        {
            return new ToolResult("{\"exitCode\":1,\"stderr\":\"Missing command\"}", true);
        }

        var cwd = context.WorkingFolder;
        if (!string.IsNullOrWhiteSpace(cwd) && !Directory.Exists(cwd))
        {
            cwd = null;
        }

        var timeoutMs = Math.Clamp(
            GetInt(input, "timeout", DefaultTimeoutMs),
            1,
            MaxTimeoutMs);

        try
        {
            (string stdout, string stderr, int exitCode) = await RunProcessAsync(command, cwd, timeoutMs, context.CancellationToken);

            var result = FormatOutput(stdout, stderr, exitCode);
            return new ToolResult(result, exitCode != 0 && string.IsNullOrEmpty(stdout));
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            return new ToolResult($"Failed to execute command: {ex.Message}", true, ex.Message);
        }
    }

    private static async Task<(string Stdout, string Stderr, int ExitCode)> RunProcessAsync(
        string command,
        string? workingDirectory,
        int timeoutMs,
        CancellationToken cancellationToken)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "bash",
            Arguments = $"-c {command}",
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };

        if (!string.IsNullOrWhiteSpace(workingDirectory))
        {
            psi.WorkingDirectory = workingDirectory;
        }

        // On Windows, use cmd.exe
        if (OperatingSystem.IsWindows())
        {
            psi.FileName = "cmd.exe";
            psi.Arguments = $"/c {command}";
        }

        using var process = new Process { StartInfo = psi };

        using var timeoutCts = new CancellationTokenSource(timeoutMs);
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            timeoutCts.Token);

        process.Start();

        var stdoutTask = ReadStreamAsync(process.StandardOutput, linkedCts.Token);
        var stderrTask = ReadStreamAsync(process.StandardError, linkedCts.Token);

        // Wait for process to exit or timeout
        var waitForExitTask = Task.Run(() => process.WaitForExit(), linkedCts.Token);

        try
        {
            await Task.WhenAll(waitForExitTask, stdoutTask, stderrTask);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            // Timeout
            try
            {
                process.Kill(entireProcessTree: true);
            }
            catch
            {
                // ignore
            }

            var stdout = stdoutTask.IsCompletedSuccessfully ? stdoutTask.Result : string.Empty;
            var stderr = stderrTask.IsCompletedSuccessfully ? stderrTask.Result : string.Empty;
            return (stdout, $"{stderr}\n[Command timed out after {timeoutMs / 1000}s]", -1);
        }

        return (stdoutTask.Result, stderrTask.Result, process.ExitCode);
    }

    private static async Task<string> ReadStreamAsync(StreamReader reader, CancellationToken ct)
    {
        var builder = new StringBuilder();
        var buffer = new char[4096];

        while (!ct.IsCancellationRequested)
        {
            var read = await reader.ReadAsync(buffer, ct);
            if (read == 0)
            {
                break;
            }

            if (builder.Length + read > MaxOutputChars)
            {
                var remaining = MaxOutputChars - builder.Length;
                if (remaining > 0)
                {
                    builder.Append(buffer, 0, remaining);
                }
                builder.Append($"\n... [output truncated at {MaxOutputChars} chars]");
                break;
            }

            builder.Append(buffer, 0, read);
        }

        return builder.ToString();
    }

    private static string FormatOutput(string stdout, string stderr, int exitCode)
    {
        var builder = new StringBuilder();
        builder.Append("{\"exitCode\":");
        builder.Append(exitCode);

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
}
