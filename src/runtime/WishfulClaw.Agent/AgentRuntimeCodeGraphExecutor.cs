using System.Buffers;
using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Agent;

/// <summary>
/// CodeGraph tool executor — routes codegraph_* tools to the CodeGraph sidecar
/// via reverse-request to the Main process.
/// Ported from WishfulClaw AgentRuntimeCodeGraphExecutor.
/// </summary>
public static class AgentRuntimeCodeGraphExecutor
{
    public static bool IsCodeGraphTool(string toolName)
    {
        return toolName.StartsWith("codegraph_", StringComparison.Ordinal);
    }

    public static async Task<string> ExecuteAsync(
        AgentRuntimeNativeToolCall call,
        JsonElement parameters,
        IWorkerRequestContext context,
        CancellationToken cancellationToken)
    {
        var workingFolder = JsonHelpers.GetString(parameters, "workingFolder");
        var payload = BuildPayload(call, workingFolder);
        var result = await AgentRuntimeReverseRequests.RequestAsync(
            context,
            "codegraph:tool",
            payload,
            cancellationToken);

        var text = JsonHelpers.GetString(result, "text");
        if (!string.IsNullOrEmpty(text))
        {
            return text;
        }

        var message = JsonHelpers.GetString(result, "message") ?? JsonHelpers.GetString(result, "error");
        if (!string.IsNullOrEmpty(message))
        {
            return message;
        }

        return result.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null
            ? "CodeGraph returned no result."
            : result.GetRawText();
    }

    private static JsonElement BuildPayload(AgentRuntimeNativeToolCall call, string? workingFolder)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer))
        {
            writer.WriteStartObject();
            writer.WriteString("name", call.Name);
            writer.WritePropertyName("input");
            call.Input.WriteTo(writer);
            if (!string.IsNullOrWhiteSpace(workingFolder))
            {
                writer.WriteString("workingFolder", workingFolder);
            }
            writer.WriteEndObject();
        }

        using var document = JsonDocument.Parse(buffer.WrittenMemory);
        return document.RootElement.Clone();
    }
}
