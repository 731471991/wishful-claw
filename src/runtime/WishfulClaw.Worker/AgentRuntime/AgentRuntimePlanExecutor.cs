using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Plan mode executor — EnterPlanMode/ExitPlanMode for read-only analysis.
/// Simplified port: file-based plan storage (no SQLite, no SSH).
/// Ported from OpenCowork AgentRuntimePlanExecutor.
/// </summary>
internal static class AgentRuntimePlanExecutor
{
    private const string PlanDirectoryName = ".plan";
    private const string IdAlphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

    private static readonly HashSet<string> PlanToolNames = new(StringComparer.Ordinal)
    {
        "EnterPlanMode", "ExitPlanMode"
    };

    private static readonly ConcurrentDictionary<string, PlanRunState> RunStates = new(StringComparer.Ordinal);
    private static readonly ConcurrentDictionary<string, string> SessionPlans = new(StringComparer.Ordinal);
    private static readonly JsonWriterOptions WriterOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public static bool IsPlanTool(string toolName)
    {
        return PlanToolNames.Contains(toolName);
    }

    public static async Task<string> ExecuteAsync(
        AgentRuntimeNativeToolCall call,
        JsonElement parameters,
        string runId,
        IWorkerRequestContext context,
        CancellationToken cancellationToken)
    {
        return call.Name switch
        {
            "EnterPlanMode" => await EnterPlanModeAsync(call.Input, parameters, runId, context, cancellationToken),
            "ExitPlanMode" => await ExitPlanModeAsync(parameters, runId, context, cancellationToken),
            _ => EncodeError($"Native plan tool not registered: {call.Name}")
        };
    }

    public static void ClearRun(string runId)
    {
        RunStates.TryRemove(runId, out _);
    }

    public static bool IsPlanModeActiveForRun(string runId, JsonElement parameters)
    {
        if (RunStates.TryGetValue(runId, out var state) && state.Active)
        {
            return true;
        }
        return JsonHelpers.GetBool(parameters, "planMode", false);
    }

    private static async Task<string> EnterPlanModeAsync(
        JsonElement input,
        JsonElement parameters,
        string runId,
        IWorkerRequestContext context,
        CancellationToken cancellationToken)
    {
        var sessionId = JsonHelpers.GetString(parameters, "sessionId")?.Trim() ?? string.Empty;
        if (sessionId.Length == 0)
        {
            return EncodeError("No active session.");
        }

        var workingFolder = JsonHelpers.GetString(parameters, "workingFolder")?.Trim() ?? string.Empty;
        if (workingFolder.Length == 0)
        {
            return EncodeError("Plan mode requires an active working folder.");
        }

        string status;
        string planId;
        string planFilePath;

        if (SessionPlans.TryGetValue(sessionId, out var existingPath) && File.Exists(existingPath))
        {
            planFilePath = existingPath;
            planId = Path.GetFileNameWithoutExtension(planFilePath);
            status = "resumed";
        }
        else
        {
            var reason = JsonHelpers.GetString(input, "reason")?.Trim();
            if (string.IsNullOrEmpty(reason))
            {
                reason = "Implementation planning";
            }
            planId = CreatePlanId();
            planFilePath = GetPlanFilePath(workingFolder, planId);
            SessionPlans[sessionId] = planFilePath;
            status = "entered";
        }

        try
        {
            var planDir = Path.Combine(workingFolder, PlanDirectoryName);
            Directory.CreateDirectory(planDir);
            if (!File.Exists(planFilePath))
            {
                await File.WriteAllTextAsync(planFilePath, string.Empty, cancellationToken);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return EncodeError(ex.Message);
        }

        RunStates[runId] = new PlanRunState(true, planFilePath);

        return EncodeJsonObject(writer =>
        {
            writer.WriteString("status", status);
            writer.WriteString("plan_id", planId);
            writer.WriteString("plan_file_path", planFilePath);
            writer.WriteString(
                "message",
                status == "resumed"
                    ? "Resumed existing plan draft. Update the current plan file with Write/Edit, then call ExitPlanMode."
                    : "Plan mode activated. Write the plan into the current plan file with Write/Edit, then call ExitPlanMode.");
        });
    }

    private static async Task<string> ExitPlanModeAsync(
        JsonElement parameters,
        string runId,
        IWorkerRequestContext context,
        CancellationToken cancellationToken)
    {
        var sessionId = JsonHelpers.GetString(parameters, "sessionId")?.Trim() ?? string.Empty;
        if (sessionId.Length == 0)
        {
            return EncodeError("No active session.");
        }

        if (!SessionPlans.TryGetValue(sessionId, out var planFilePath) || !File.Exists(planFilePath))
        {
            return EncodeJsonObject(writer =>
            {
                writer.WriteString("status", "not_in_plan_mode");
                writer.WriteString("message", "You are not currently in plan mode.");
            });
        }

        string content;
        try
        {
            content = await File.ReadAllTextAsync(planFilePath, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return EncodeError($"Failed to read the current plan file before exiting plan mode: {ex.Message}");
        }

        if (string.IsNullOrWhiteSpace(content))
        {
            return EncodeError("Plan file is empty. Write the plan file before exiting plan mode.");
        }

        var title = InferTitleFromContent(content);
        RunStates[runId] = new PlanRunState(false, planFilePath);

        return EncodeJsonObject(writer =>
        {
            writer.WriteString("status", "awaiting_review");
            writer.WriteBoolean("awaiting_user_review", true);
            writer.WriteString("plan_file_path", planFilePath);
            writer.WriteString("title", title);
            writer.WriteString("content", content);
            writer.WriteString("message", "Plan finalized and ready for user review. Wait for approval before implementing.");
        });
    }

    private static string GetPlanFilePath(string workingFolder, string planId)
    {
        return Path.Combine(workingFolder, PlanDirectoryName, $"{planId}.md");
    }

    private static string InferTitleFromContent(string content)
    {
        foreach (var rawLine in content.Split('\n'))
        {
            var line = rawLine.Trim();
            if (line.Length == 0) continue;
            var title = System.Text.RegularExpressions.Regex
                .Replace(line, @"^#+\s*", string.Empty).Trim();
            title = System.Text.RegularExpressions.Regex
                .Replace(title, @"^plan:\s*", string.Empty, System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();
            return title.Length > 80 ? title[..80] : title.Length > 0 ? title : "Plan";
        }
        return "Plan";
    }

    private static string CreatePlanId()
    {
        Span<byte> bytes = stackalloc byte[12];
        RandomNumberGenerator.Fill(bytes);
        Span<char> chars = stackalloc char[12];
        for (var i = 0; i < bytes.Length; i++)
        {
            chars[i] = IdAlphabet[bytes[i] % IdAlphabet.Length];
        }
        return new string(chars);
    }

    private static string EncodeError(string message)
    {
        return EncodeJsonObject(writer => writer.WriteString("error", message));
    }

    private static string EncodeJsonObject(Action<Utf8JsonWriter> writeProperties)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream, WriterOptions))
        {
            writer.WriteStartObject();
            writeProperties(writer);
            writer.WriteEndObject();
        }
        return Encoding.UTF8.GetString(stream.ToArray());
    }

    private sealed record PlanRunState(bool Active, string FilePath);
}
