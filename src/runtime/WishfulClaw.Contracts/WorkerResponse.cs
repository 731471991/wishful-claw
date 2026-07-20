using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;

namespace WishfulClaw.Contracts;

/// <summary>
/// Worker 响应抽象基类。具体编码逻辑由 Core 层实现。
/// </summary>
public abstract class WorkerResponse
{
    public abstract byte[] ToJsonBytes(JsonElement? id);

    public static WorkerResponse Json<T>(T result, JsonTypeInfo<T> typeInfo)
    {
        return new JsonWorkerResponse<T>(result, typeInfo);
    }

    public static WorkerResponse String(string result)
    {
        return new StringWorkerResponse(result);
    }

    public static WorkerResponse Error(string message)
    {
        return new ErrorWorkerResponse(message);
    }

    public static WorkerResponse RawJson(string result)
    {
        return new RawJsonWorkerResponse(result);
    }
}

internal sealed class JsonWorkerResponse<T>(T result, JsonTypeInfo<T> typeInfo) : WorkerResponse
{
    public override byte[] ToJsonBytes(JsonElement? id)
    {
        return WorkerJsonHelper.WriteResponse(id, writer =>
            JsonSerializer.Serialize(writer, result, typeInfo));
    }
}

internal sealed class StringWorkerResponse(string result) : WorkerResponse
{
    public override byte[] ToJsonBytes(JsonElement? id)
    {
        return WorkerJsonHelper.WriteResponse(id, writer => writer.WriteStringValue(result));
    }
}

internal sealed class ErrorWorkerResponse(string message) : WorkerResponse
{
    public override byte[] ToJsonBytes(JsonElement? id)
    {
        return WorkerJsonHelper.WriteResponse(id, writer =>
            JsonSerializer.Serialize(writer, new ErrorResult(message),
                WorkerJsonContext.Default.ErrorResult));
    }
}

internal sealed class RawJsonWorkerResponse(string result) : WorkerResponse
{
    public override byte[] ToJsonBytes(JsonElement? id)
    {
        return WorkerJsonHelper.WriteResponse(id, writer =>
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
}

/// <summary>
/// 通用数据模型。
/// </summary>
public sealed record ErrorResult(string Error);

public sealed record StatusResult(bool Ok, int Pid);

public sealed record WorkerRoutesResult(string[] Methods);

/// <summary>
/// JSON 序列化上下文（AOT 友好）。
/// </summary>
[JsonSourceGenerationOptions(
    WriteIndented = false,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull)]
[JsonSerializable(typeof(ErrorResult))]
[JsonSerializable(typeof(StatusResult))]
[JsonSerializable(typeof(WorkerRoutesResult))]
public partial class WorkerJsonContext : JsonSerializerContext;
