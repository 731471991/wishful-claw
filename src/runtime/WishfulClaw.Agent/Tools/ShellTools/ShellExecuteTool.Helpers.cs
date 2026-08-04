using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using WishfulClaw.Core.Tools;
using static WishfulClaw.Agent.Tools.ToolHelpers;

namespace WishfulClaw.Agent.Tools.ShellTools;

public sealed partial class ShellExecuteTool
{
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


