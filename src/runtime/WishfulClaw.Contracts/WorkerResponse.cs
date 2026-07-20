using System.Buffers;
using System.Text.Encodings.Web;
using System.Text.Json;

namespace WishfulClaw.Contracts;

public sealed class WorkerResponse
{
    private readonly Action<Utf8JsonWriter> _resultWriter;

    private WorkerResponse(Action<Utf8JsonWriter> resultWriter)
    {
        _resultWriter = resultWriter;
    }

    public static WorkerResponse Json<T>(T result)
    {
        return new WorkerResponse(writer => JsonSerializer.Serialize(writer, result, WorkerJsonHelper.JsonOptions));
    }

    public static WorkerResponse String(string result)
    {
        return new WorkerResponse(writer => writer.WriteStringValue(result));
    }

    public static WorkerResponse FromWriter(Action<Utf8JsonWriter> writeResult)
    {
        return new WorkerResponse(writeResult);
    }

    public static WorkerResponse RawJson(string result)
    {
        return new WorkerResponse(writer =>
        {
            try
            {
                using var document = JsonDocument.Parse(result);
                document.RootElement.WriteTo(writer);
            }
            catch
            {
                writer.WriteStringValue(result);
            }
        });
    }

    public static WorkerResponse Error(string message)
    {
        return Json(new ErrorResult(message));
    }

    public byte[] ToJsonBytes(JsonElement? id)
    {
        return WorkerJsonHelper.WriteResponse(id, _resultWriter);
    }
}

public sealed record ErrorResult(string Error);
public sealed record StatusResult(bool Ok, int Pid);
public sealed record WorkerRoutesResult(string[] Methods);

public static class WorkerJsonHelper
{
    private static readonly JsonWriterOptions WriterOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public static readonly JsonSerializerOptions JsonOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
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
            id.Value.WriteTo(writer);
        else
            writer.WriteNullValue();
    }
}
