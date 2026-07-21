using System.Text.Json;
using System.Text.Json.Serialization.Metadata;
using WishfulClaw.Contracts;

namespace WishfulClaw.Core.Protocol;

public sealed class WorkerRequestContext : IWorkerRequestContext
{
    private readonly Func<string, Action<Utf8JsonWriter>, CancellationToken, ValueTask> _emitEventAsync;
    private readonly Func<WorkerMessagePackEvent, CancellationToken, ValueTask> _emitMessagePackEventAsync;

    public WorkerRequestContext(
        Func<string, Action<Utf8JsonWriter>, CancellationToken, ValueTask> emitEventAsync,
        Func<WorkerMessagePackEvent, CancellationToken, ValueTask> emitMessagePackEventAsync,
        CancellationToken cancellationToken,
        CancellationToken connectionCancellationToken = default)
    {
        _emitEventAsync = emitEventAsync;
        _emitMessagePackEventAsync = emitMessagePackEventAsync;
        CancellationToken = cancellationToken;
        ConnectionCancellationToken = connectionCancellationToken == default
            ? cancellationToken
            : connectionCancellationToken;
    }

    public CancellationToken CancellationToken { get; }

    public CancellationToken ConnectionCancellationToken { get; }

    public IWorkerRequestContext ForBackgroundOperation()
    {
        return new WorkerRequestContext(
            _emitEventAsync,
            _emitMessagePackEventAsync,
            ConnectionCancellationToken,
            ConnectionCancellationToken);
    }

    public ValueTask EmitEventAsync<T>(string eventName, T parameters, JsonTypeInfo<T> typeInfo)
    {
        return _emitEventAsync(
            eventName,
            writer => JsonSerializer.Serialize(writer, parameters, typeInfo),
            CancellationToken);
    }

    public ValueTask EmitEventIgnoringCancellationAsync<T>(string eventName, T parameters, JsonTypeInfo<T> typeInfo)
    {
        return _emitEventAsync(
            eventName,
            writer => JsonSerializer.Serialize(writer, parameters, typeInfo),
            CancellationToken.None);
    }

    public ValueTask EmitMessagePackEventAsync(WorkerMessagePackEvent messagePackEvent)
    {
        return _emitMessagePackEventAsync(messagePackEvent, CancellationToken);
    }

    public ValueTask EmitMessagePackEventAsync(string eventName, ReadOnlyMemory<byte> payload)
    {
        return _emitMessagePackEventAsync(new WorkerMessagePackEvent(eventName, payload), CancellationToken);
    }
}
