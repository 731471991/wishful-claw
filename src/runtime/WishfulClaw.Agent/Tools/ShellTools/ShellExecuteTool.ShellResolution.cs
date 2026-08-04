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
    // ── Shell resolution (adapted from WishfulClaw ShellTools.ResolveLaunch) ──



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


}
