using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace WishfulClaw.Agent;

/// <summary>
/// Transcript rendering for context compression.
/// </summary>
public static partial class ContextCompression
{
    // ── Transcript rendering ──

    /// <summary>
    /// Flattens messages into a readable transcript for summarization.
    /// </summary>
    private static string RenderTranscript(List<AgentRuntimeChatMessage> messages)
    {
        var sb = new StringBuilder();

        foreach (var message in messages)
        {
            switch (message.Role)
            {
                case "user" when message.ToolResults.Count > 0:
                    foreach (var tr in message.ToolResults)
                    {
                        sb.AppendLine($"[tool {tr.ToolUseId} result]");
                        sb.AppendLine(tr.Content.ValueKind == JsonValueKind.String
                            ? tr.Content.GetString() ?? ""
                            : tr.Content.GetRawText());
                        sb.AppendLine();
                    }
                    break;

                case "user":
                    sb.AppendLine("[user]");
                    sb.AppendLine(message.Text);
                    sb.AppendLine();
                    break;

                case "assistant":
                    if (!string.IsNullOrEmpty(message.Text))
                    {
                        sb.AppendLine("[assistant]");
                        sb.AppendLine(message.Text);
                    }
                    foreach (var tu in message.ToolUses)
                    {
                        sb.AppendLine($"[assistant calls {tu.Name}] {SummarizeToolArgs(tu.Input.GetRawText())}");
                    }
                    sb.AppendLine();
                    break;

                case "system":
                    sb.AppendLine("[system]");
                    sb.AppendLine(message.Text);
                    sb.AppendLine();
                    break;
            }
        }

        return sb.ToString();
    }

    /// <summary>
    /// Returns a short summary of tool-call arguments instead of the full JSON.
    /// </summary>
    private static string SummarizeToolArgs(string args)
    {
        if (string.IsNullOrEmpty(args))
            return "(no arguments)";
        try
        {
            using var doc = JsonDocument.Parse(args);
            var keys = doc.RootElement.EnumerateObject().Select(p => p.Name).OrderBy(k => k).ToList();
            return $"{{{string.Join(", ", keys)}}} ({keys.Count} keys)";
        }
        catch
        {
            return $"({args.Length} bytes)";
        }
    }


}
