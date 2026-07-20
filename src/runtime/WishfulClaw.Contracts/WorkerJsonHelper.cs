using System.Buffers;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace WishfulClaw.Contracts;

/// <summary>
/// JSON 写入工具。用于构建 IPC 响应和事件的 JSON 字节。
/// </summary>
public static class WorkerJsonHelper
{
    private static readonly JsonWriterOptions WriterOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public static byte[] WriteResponse(JsonElement? id, Action<Utf8JsonWriter> writeResult)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer, WriterOptions))
        {
            writer.WriteStartObject();
            WriteId(writer, id);
            writer.WritePropertyName("result");
            writeResult(writer);
            writer.WriteEndObject();
        }

        return buffer.WrittenMemory.ToArray();
    }

    public static byte[] WriteEvent(string eventName, Action<Utf8JsonWriter> writeParameters)
    {
        var buffer = new ArrayBufferWriter<byte>();
        using (var writer = new Utf8JsonWriter(buffer, WriterOptions))
        {
            writer.WriteStartObject();
            writer.WriteString("event", eventName);
            writer.WritePropertyName("params");
            writeParameters(writer);
            writer.WriteEndObject();
        }

        return buffer.WrittenMemory.ToArray();
    }

    private static void WriteId(Utf8JsonWriter writer, JsonElement? id)
    {
        writer.WritePropertyName("id");
        if (id.HasValue)
        {
            id.Value.WriteTo(writer);
        }
        else
        {
            writer.WriteNullValue();
        }
    }
}
