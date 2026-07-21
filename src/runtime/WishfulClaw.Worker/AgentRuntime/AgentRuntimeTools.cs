using System.Collections.Concurrent;
using System.Text.Json;
using WishfulClaw.Contracts;
using WishfulClaw.Core.Protocol;

namespace WishfulClaw.Worker.AgentRuntime;

/// <summary>
/// Static agent runtime tools: run management, cancellation, event emission.
/// Simplified from OpenCowork — no SubAgent/Team/Reverse support.
/// </summary>
internal static class AgentRuntimeTools
{
    private const int ProtocolVersion = 1;
    private const int MaxConcurrentRuns = 8;
    private static readonly ConcurrentDictionary<string, AgentRuntimeRunState> ActiveRuns = new(StringComparer.Ordinal);
    private static readonly SemaphoreSlim RunSlots = new(MaxConcurrentRuns, MaxConcurrentRuns);
    private static long _generatedRunId;

    // ── Run management ──

    public static Task<WorkerResponse> RunAsync(JsonElement parameters, IWorkerRequestContext context)
    {
        if (!RunSlots.Wait(0))
        {
            return Task.FromResult(WorkerResponse.Error(
                $"Agent run quota exceeded ({MaxConcurrentRuns} concurrent runs)."));
        }

        var runId = NormalizeRunId(JsonHelpers.GetString(parameters, "runId"));
        var sessionId = JsonHelpers.GetString(parameters, "sessionId")?.Trim() ?? string.Empty;
        var initialMessageCount = CountArray(parameters, "messages");
        var state = new AgentRuntimeRunState(runId, sessionId);
        try
        {
            state.ReplaceParameters(parameters.Clone());
        }
        catch
        {
            RunSlots.Release();
            state.Dispose();
            throw;
        }

        if (!ActiveRuns.TryAdd(runId, state))
        {
            RunSlots.Release();
            state.Dispose();
            return Task.FromResult(WorkerResponse.Error($"Agent run already exists: {runId}"));
        }

        WorkerLog.Info(
            $"agent run accepted runId={runId} sessionId={FormatLogValue(sessionId)} " +
            $"messages={initialMessageCount}");

        var backgroundContext = context.ForBackgroundOperation();
        _ = Task.Run(
            async () => await ExecuteRunAsync(state, backgroundContext),
            CancellationToken.None);

        return Task.FromResult(WorkerResponse.Json(
            new AgentRuntimeRunResult(true, runId)));
    }

    public static WorkerResponse Cancel(JsonElement parameters)
    {
        var runId = JsonHelpers.GetString(parameters, "runId")?.Trim();
        if (string.IsNullOrEmpty(runId))
        {
            return WorkerResponse.Json(new AgentRuntimeCancelResult(false, null));
        }

        if (!ActiveRuns.TryGetValue(runId, out var state))
        {
            return WorkerResponse.Json(new AgentRuntimeCancelResult(false, runId));
        }

        state.Cancel("user");
        WorkerLog.Info($"agent run cancel requested runId={runId}");
        return WorkerResponse.Json(new AgentRuntimeCancelResult(true, runId));
    }

    public static WorkerResponse RequestStop(JsonElement parameters)
    {
        var runId = JsonHelpers.GetString(parameters, "runId")?.Trim();
        if (string.IsNullOrEmpty(runId))
        {
            return WorkerResponse.Json(new AgentRuntimeStopResult(false, null));
        }

        if (!ActiveRuns.TryGetValue(runId, out var state))
        {
            return WorkerResponse.Json(new AgentRuntimeStopResult(false, runId));
        }

        state.RequestStop("user");
        WorkerLog.Info($"agent run stop requested runId={runId}");
        return WorkerResponse.Json(new AgentRuntimeStopResult(true, runId));
    }

    public static WorkerResponse AppendMessages(JsonElement parameters)
    {
        var runId = JsonHelpers.GetString(parameters, "runId")?.Trim();
        if (string.IsNullOrEmpty(runId))
        {
            return WorkerResponse.Json(new AgentRuntimeAppendMessagesResult(false, null, 0));
        }

        if (!ActiveRuns.TryGetValue(runId, out var state))
        {
            return WorkerResponse.Json(new AgentRuntimeAppendMessagesResult(false, runId, 0));
        }

        var count = state.EnqueueMessages(parameters);
        WorkerLog.Debug($"agent run append messages runId={runId} count={count}");
        return WorkerResponse.Json(new AgentRuntimeAppendMessagesResult(count > 0, runId, count));
    }

    // ── Event emission ──

    internal static async Task EmitAsync(
        AgentRuntimeRunState state,
        IWorkerRequestContext context,
        params AgentRuntimeStreamEvent[] events)
    {
        if (events.Length == 0)
        {
            return;
        }

        var envelope = new AgentRuntimeStreamEnvelope(
            ProtocolVersion,
            state.RunId,
            state.SessionId,
            state.NextSeq(),
            events);

        var messagePackEvent = AgentStreamMessagePackEmitter.Encode(envelope);
        await context.EmitMessagePackEventAsync(messagePackEvent.EventName, messagePackEvent.Payload);

        WorkerLog.Debug(
            $"agent stream emitted runId={state.RunId} seq={envelope.Seq} " +
            $"events={events.Length} bytes={messagePackEvent.Payload.Length}");
    }

    // ── Internal execution ──

    private static async Task ExecuteRunAsync(AgentRuntimeRunState state, IWorkerRequestContext context)
    {
        try
        {
            await EmitAsync(state, context, new AgentRuntimeStreamEvent("loop_start"));

            if (state.IsCancellationRequested)
            {
                await AgentLoop.EmitLoopEndAsync(state, context, "aborted");
                return;
            }

            await AgentLoop.ExecuteLoopAsync(state.Parameters, state, context);
        }
        catch (OperationCanceledException) when (state.IsCancellationRequested)
        {
            await AgentLoop.EmitLoopEndAsync(state, context, "aborted");
        }
        catch (Exception ex)
        {
            WorkerLog.Warn($"agent run failed runId={state.RunId} error={ex.GetType().Name}: {ex.Message}");
            await EmitAsync(
                state,
                context,
                new AgentRuntimeStreamEvent(
                    "error",
                    Message: ex.Message,
                    ErrorType: ex.GetType().Name,
                    Details: ex.Message,
                    StackTrace: ex.StackTrace));
            await AgentLoop.EmitLoopEndAsync(state, context, "error");
        }
        finally
        {
            ActiveRuns.TryRemove(state.RunId, out _);
            RunSlots.Release();
            state.Dispose();
            WorkerLog.Info($"agent run finalized runId={state.RunId}");
        }
    }

    // ── Helpers ──

    private static string NormalizeRunId(string? runId)
    {
        var trimmed = runId?.Trim();
        if (!string.IsNullOrEmpty(trimmed))
        {
            return trimmed;
        }

        var next = Interlocked.Increment(ref _generatedRunId);
        return $"wc-agent-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{next}";
    }

    private static int CountArray(JsonElement element, string propertyName)
    {
        if (element.ValueKind != JsonValueKind.Object ||
            !element.TryGetProperty(propertyName, out var property) ||
            property.ValueKind != JsonValueKind.Array)
        {
            return 0;
        }
        return property.GetArrayLength();
    }

    private static string FormatLogValue(string? value)
    {
        return string.IsNullOrEmpty(value) ? "<empty>" : value;
    }
}

/// <summary>
/// Per-run state: cancellation, message queue, seq counter.
/// </summary>
internal sealed class AgentRuntimeRunState : IDisposable
{
    private readonly CancellationTokenSource _cancellation = new();
    private readonly ConcurrentQueue<JsonElement> _queuedMessages = new();
    private readonly object _messageQueueSync = new();
    private long _seq;
    private int _queuedMessageCount;
    private int _stopRequested;
    private bool _messageQueueClosed;

    public AgentRuntimeRunState(string runId, string sessionId)
    {
        RunId = runId;
        SessionId = sessionId;
        StartedAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    public string RunId { get; }
    public string SessionId { get; }
    public long StartedAt { get; }
    public JsonElement Parameters { get; private set; }
    public CancellationToken CancellationToken => _cancellation.Token;
    public int QueuedMessageCount => Volatile.Read(ref _queuedMessageCount);
    public bool IsCancellationRequested => _cancellation.IsCancellationRequested;
    public bool IsStopRequested => Volatile.Read(ref _stopRequested) != 0;
    public string? StopReason { get; private set; }

    public void ReplaceParameters(JsonElement parameters)
    {
        Parameters = parameters;
    }

    public long NextSeq()
    {
        return Interlocked.Increment(ref _seq);
    }

    public int EnqueueMessages(JsonElement parameters)
    {
        if (parameters.ValueKind != JsonValueKind.Object ||
            !parameters.TryGetProperty("messages", out var messages) ||
            messages.ValueKind != JsonValueKind.Array)
        {
            return 0;
        }

        lock (_messageQueueSync)
        {
            if (_messageQueueClosed)
            {
                return 0;
            }

            var count = 0;
            foreach (var message in messages.EnumerateArray())
            {
                if (message.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }
                _queuedMessages.Enqueue(message.Clone());
                count++;
            }

            if (count > 0)
            {
                Interlocked.Add(ref _queuedMessageCount, count);
            }
            return count;
        }
    }

    public List<JsonElement> DrainQueuedMessages()
    {
        lock (_messageQueueSync)
        {
            var messages = new List<JsonElement>();
            while (_queuedMessages.TryDequeue(out var message))
            {
                messages.Add(message);
            }
            if (messages.Count > 0)
            {
                Interlocked.Add(ref _queuedMessageCount, -messages.Count);
            }
            return messages;
        }
    }

    public bool TryCloseMessageQueueIfEmpty()
    {
        lock (_messageQueueSync)
        {
            if (QueuedMessageCount > 0)
            {
                return false;
            }
            _messageQueueClosed = true;
            return true;
        }
    }

    public void Cancel(string reason)
    {
        _cancellation.Cancel();
    }

    public void RequestStop(string reason)
    {
        StopReason = string.IsNullOrWhiteSpace(reason) ? "completed" : reason;
        Interlocked.Exchange(ref _stopRequested, 1);
    }

    public void Dispose()
    {
        lock (_messageQueueSync)
        {
            _messageQueueClosed = true;
        }
        _cancellation.Dispose();
    }
}
