using System.Text.Json;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Simplified context compression: token-based truncation.
/// No LLM summary (added in later iterations).
/// </summary>
internal static class ContextCompression
{
    private const int PreserveHeadCount = 2;
    private const int PreserveTailCount = 12;

    /// <summary>
    /// Truncates the conversation by removing old messages,
    /// keeping the head (system + first user) and recent tail.
    /// </summary>
    public static (List<AgentRuntimeChatMessage> conversation, List<JsonElement> wireConversation) TruncateMessages(
        List<AgentRuntimeChatMessage> conversation,
        List<JsonElement> wireConversation,
        JsonElement provider)
    {
        var total = conversation.Count;
        if (total <= PreserveHeadCount + PreserveTailCount)
        {
            return (conversation, wireConversation);
        }

        // Keep head (first few messages) + tail (most recent)
        var headCount = Math.Min(PreserveHeadCount, total);
        var tailCount = Math.Min(PreserveTailCount, total - headCount);

        var newConversation = new List<AgentRuntimeChatMessage>();
        var newWireConversation = new List<JsonElement>();

        // Head
        for (var i = 0; i < headCount; i++)
        {
            newConversation.Add(conversation[i]);
            newWireConversation.Add(wireConversation[i]);
        }

        // Tail
        var tailStart = total - tailCount;
        for (var i = tailStart; i < total; i++)
        {
            newConversation.Add(conversation[i]);
            newWireConversation.Add(wireConversation[i]);
        }

        return (newConversation, newWireConversation);
    }
}
