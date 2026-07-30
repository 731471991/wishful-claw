using System.Collections.Concurrent;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Session-scoped queue of memory change notes (turn-tail notes).
///
/// Design follows Reasonix's memory.Queue pattern: when a memory tool writes
/// mid-session, it queues a short note. On the next AgentLoop turn, the notes
/// are drained and injected as a &lt;memory-update&gt; block into the user message
/// prefix — NOT into the system prompt — so the cache-stable prefix is preserved.
///
/// The memory content in the cached system prompt stays stale for the rest of
/// this session; the turn-tail note bridges the gap. On the next session,
/// SystemPromptCache rebuilds from disk and picks up the fresh content naturally.
/// </summary>
internal static class MemoryUpdateQueue
{
    private static readonly ConcurrentDictionary<string, ConcurrentQueue<string>> _queues = new();

    /// <summary>
    /// Enqueue a memory change note for the given session.
    /// </summary>
    public static void Enqueue(string sessionId, string note)
    {
        if (string.IsNullOrWhiteSpace(sessionId) || string.IsNullOrWhiteSpace(note))
            return;

        var queue = _queues.GetOrAdd(sessionId, _ => new ConcurrentQueue<string>());
        queue.Enqueue(note);
    }

    /// <summary>
    /// Drain and return all pending notes for the given session.
    /// Returns an empty list if there are none.
    /// </summary>
    public static List<string> Drain(string sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
            return [];

        if (!_queues.TryGetValue(sessionId, out var queue))
            return [];

        var notes = new List<string>();
        while (queue.TryDequeue(out var note))
        {
            notes.Add(note);
        }
        return notes;
    }

    /// <summary>
    /// Clear the queue for a specific session (e.g., on session end).
    /// </summary>
    public static void Clear(string sessionId)
    {
        _queues.TryRemove(sessionId, out _);
    }
}
