using System.Diagnostics;
using System.Text;

namespace WishfulClaw.Worker.Tools.ShellTools;

/// <summary>
/// Describes a shell executable and its base arguments.
/// </summary>
internal sealed record ShellLaunch(string Shell, string[] Args);

/// <summary>
/// Tracks a running shell process for abort/cancellation.
/// </summary>
internal sealed class RunningProcess
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
internal sealed class OutputCollector
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

/// <summary>
/// JSON escaping and output formatting helpers for shell tools.
/// </summary>
internal static class ShellOutputFormatter
{
    public static string Format(
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

    public static string EscapeJson(string s)
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
