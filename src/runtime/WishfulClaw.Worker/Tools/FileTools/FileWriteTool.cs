using System;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using WishfulClaw.Core.Tools;

namespace WishfulClaw.Worker.Tools.FileTools;

using static WishfulClaw.Worker.Tools.ToolHelpers;

/// <summary>
/// Write content to a file. Creates the file if it doesn't exist, overwrites if it does.
/// Adapted from OpenCowork AgentRuntimeNativeToolExecutor.WriteAsync.
/// </summary>
public sealed class FileWriteTool : IToolExecutor
{
    public string Name => "Write";

    public string Description => "Write content to a file. Creates parent directories if needed. Overwrites existing content.";

    public JsonElement InputSchema => FileReadTool.WriteSchema;

    public async Task<ToolResult> ExecuteAsync(JsonElement input, ToolExecutionContext context)
    {
        var path = ResolveFilePath(input, context.WorkingFolder);
        var content = GetString(input, "content");

        if (string.IsNullOrWhiteSpace(path))
        {
            return new ToolResult("Write requires a non-empty file_path", true);
        }
        if (content is null)
        {
            return new ToolResult("Write requires a content string", true);
        }

        try
        {
            var directory = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var existed = File.Exists(path);
            await File.WriteAllTextAsync(path, content, Encoding.UTF8, context.CancellationToken);

            return new ToolResult($"{{\"success\":true,\"path\":\"{EscapeJson(path)}\",\"op\":\"{(existed ? "modify" : "create")}\"}}");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return new ToolResult($"Failed to write file: {ex.Message}", true, ex.Message);
        }
    }

    private static string EscapeJson(string s)
    {
        return s.Replace("\\", "\\\\").Replace("\"", "\\\"");
    }
}
