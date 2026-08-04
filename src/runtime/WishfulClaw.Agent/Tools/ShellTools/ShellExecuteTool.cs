using System.Collections.Concurrent;
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using WishfulClaw.Core.Tools;
using static WishfulClaw.Agent.Tools.ToolHelpers;

namespace WishfulClaw.Agent.Tools.ShellTools;

public sealed partial class ShellExecuteTool : IToolExecutor

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

        "and environment variables. Use for builds, tests, git, package managers, and other shell workflows. To search/read/list/edit files, prefer the dedicated tools (Glob, Grep, Read, LS, Edit, Write) over shell grep/cat/ls/find. " +

        "When sshConnectionId is provided, the command executes on the remote SSH server instead of locally. " +

        "Use SshListConnections to discover available connection IDs. " +

        "When the project has a bound SSH connection, pass \"local\": true to force local execution instead." +
        "IMPORTANT: When using the default PowerShell engine, do NOT use '&&' to chain commands \u2014 " +
        "PowerShell does not support it. Use ';' to separate commands instead. " +
        "If you need bash syntax (&&, ||, $()), set shell to 'bash' explicitly.";



    public JsonElement InputSchema { get; } = ParseSchema(

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

            },

            "local": {

              "type": "boolean",

              "description": "Force local execution. Set to true to run the command on the LOCAL machine instead of the remote SSH server, even when the project has a bound SSH connection. Useful for local file operations, local git, and other local tasks.",

              "default": false

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



}
