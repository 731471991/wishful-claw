namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Collects text events from a sub-agent's event stream.
/// The final assistant text is accumulated from "text" events and returned
/// as the sub-agent's output.
/// </summary>
internal sealed class SubAgentRunCollector
{
    private readonly List<string> _textParts = [];
    private string? _lastText;
    private int _toolCallCount;
    private int _iterations;

    public ValueTask ObserveAsync(AgentRuntimeStreamEvent evt)
    {
        switch (evt.Type)
        {
            case "text":
                if (!string.IsNullOrEmpty(evt.Text))
                {
                    _textParts.Add(evt.Text);
                    _lastText = evt.Text;
                }
                break;
            case "tool_call_start":
                _toolCallCount++;
                break;
            case "iteration_start":
                if (evt.Iteration.HasValue)
                {
                    _iterations = evt.Iteration.Value;
                }
                break;
        }
        return ValueTask.CompletedTask;
    }

    /// <summary>
    /// Returns the final assistant text output.
    /// The text events come in deltas, so we concatenate all parts.
    /// The last text before a loop_end (with no tool calls after it)
    /// is the final report.
    /// </summary>
    public string GetFinalOutput()
    {
        if (_textParts.Count == 0)
        {
            return string.Empty;
        }

        // Concatenate all text deltas — the agent loop emits text as
        // streaming deltas, so the full output is the concatenation.
        return string.Concat(_textParts);
    }
}
