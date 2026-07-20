namespace WishfulClaw.Core.Protocol;

public readonly record struct WorkerMessagePackEvent(string EventName, ReadOnlyMemory<byte> Payload);
