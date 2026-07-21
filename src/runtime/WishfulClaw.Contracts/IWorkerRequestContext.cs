using System.Text.Json;
using System.Text.Json.Serialization.Metadata;

namespace WishfulClaw.Contracts;

/// <summary>
/// 请求上下文接口。提供 CancellationToken 和事件发射能力。
/// </summary>
public interface IWorkerRequestContext
{
    CancellationToken CancellationToken { get; }

    CancellationToken ConnectionCancellationToken { get; }

    IWorkerRequestContext ForBackgroundOperation();

    ValueTask EmitEventAsync<T>(string eventName, T parameters, JsonTypeInfo<T> typeInfo);

    ValueTask EmitEventIgnoringCancellationAsync<T>(string eventName, T parameters, JsonTypeInfo<T> typeInfo);

    ValueTask EmitMessagePackEventAsync(string eventName, ReadOnlyMemory<byte> payload);
}
