namespace WishfulClaw.Core.Protocol;

using System.Buffers;
using System.Text.Json;

/// <summary>
/// Public entry point for MessagePack ↔ JSON conversion.
/// Reading logic is in <see cref="MessagePackReader"/>,
/// writing logic is in <see cref="MessagePackJsonWriter"/>.
/// </summary>
public static class MessagePackJsonTranscoder
{
    public static JsonDocument ToJsonDocument(ReadOnlySpan<byte> messagePack)
    {
        var reader = new MessagePackReader(messagePack);
        var buffer = new ArrayBufferWriter<byte>();

        using (var writer = new Utf8JsonWriter(buffer))
        {
            reader.WriteJsonValue(writer);
        }

        reader.EnsureComplete();
        return JsonDocument.Parse(buffer.WrittenMemory);
    }

    public static byte[] ToJsonBytes(ReadOnlySpan<byte> messagePack)
    {
        var reader = new MessagePackReader(messagePack);
        var buffer = new ArrayBufferWriter<byte>();

        using (var writer = new Utf8JsonWriter(buffer))
        {
            reader.WriteJsonValue(writer);
        }

        reader.EnsureComplete();
        return buffer.WrittenMemory.ToArray();
    }

    public static byte[] FromJson(JsonElement element) => MessagePackJsonWriter.FromJson(element);

    public static byte[] FromJson(ReadOnlySpan<byte> json) => MessagePackJsonWriter.FromJson(json);
}
