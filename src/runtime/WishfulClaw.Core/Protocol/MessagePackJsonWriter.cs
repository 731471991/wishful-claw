namespace WishfulClaw.Core.Protocol;

using System.Buffers;
using System.Buffers.Binary;
using System.Text;
using System.Text.Json;

/// <summary>
/// Writes JSON data as MessagePack binary.
/// Extracted from MessagePackJsonTranscoder to keep files focused.
/// </summary>
internal static class MessagePackJsonWriter
{
    public static byte[] FromJson(JsonElement element)
    {
        var buffer = new ArrayBufferWriter<byte>();
        WriteJsonElement(buffer, element);
        return buffer.WrittenMemory.ToArray();
    }

    public static byte[] FromJson(ReadOnlySpan<byte> json)
    {
        var reader = new Utf8JsonReader(json, isFinalBlock: true, state: default);
        if (!reader.Read())
        {
            throw new InvalidDataException("JSON response is empty.");
        }

        var writer = new WorkerMessagePackWriter();
        WriteJsonToken(ref reader, writer);
        if (reader.Read())
        {
            throw new InvalidDataException("JSON response contains trailing data.");
        }
        return writer.ToArray();
    }

    private static void WriteJsonToken(
        ref Utf8JsonReader reader,
        WorkerMessagePackWriter writer)
    {
        switch (reader.TokenType)
        {
            case JsonTokenType.StartObject:
                writer.WriteMapHeader(CountContainerItems(reader, countProperties: true));
                while (reader.Read() && reader.TokenType != JsonTokenType.EndObject)
                {
                    if (reader.TokenType != JsonTokenType.PropertyName)
                    {
                        throw new InvalidDataException("Invalid JSON object token sequence.");
                    }
                    writer.WriteString(reader.GetString() ?? string.Empty);
                    if (!reader.Read())
                    {
                        throw new InvalidDataException("JSON object ended before its property value.");
                    }
                    WriteJsonToken(ref reader, writer);
                }
                break;
            case JsonTokenType.StartArray:
                writer.WriteArrayHeader(CountContainerItems(reader, countProperties: false));
                while (reader.Read() && reader.TokenType != JsonTokenType.EndArray)
                {
                    WriteJsonToken(ref reader, writer);
                }
                break;
            case JsonTokenType.String:
                writer.WriteString(reader.GetString() ?? string.Empty);
                break;
            case JsonTokenType.Number when reader.TryGetInt64(out var signed):
                writer.WriteInt64(signed);
                break;
            case JsonTokenType.Number when reader.TryGetUInt64(out var unsigned):
                writer.WriteUInt64(unsigned);
                break;
            case JsonTokenType.Number:
                writer.WriteDouble(reader.GetDouble());
                break;
            case JsonTokenType.True:
                writer.WriteBoolean(true);
                break;
            case JsonTokenType.False:
                writer.WriteBoolean(false);
                break;
            case JsonTokenType.Null:
                writer.WriteNil();
                break;
            default:
                throw new InvalidDataException($"Unsupported JSON token: {reader.TokenType}");
        }
    }

    private static int CountContainerItems(Utf8JsonReader start, bool countProperties)
    {
        var reader = start;
        var nestedDepth = 0;
        var count = 0;
        while (reader.Read())
        {
            if (nestedDepth == 0)
            {
                if (countProperties && reader.TokenType == JsonTokenType.PropertyName)
                {
                    count++;
                }
                else if (!countProperties && IsValueToken(reader.TokenType))
                {
                    count++;
                }
            }

            if (reader.TokenType is JsonTokenType.StartObject or JsonTokenType.StartArray)
            {
                nestedDepth++;
            }
            else if (reader.TokenType is JsonTokenType.EndObject or JsonTokenType.EndArray)
            {
                if (nestedDepth == 0)
                {
                    break;
                }
                nestedDepth--;
            }
        }
        return count;
    }

    private static bool IsValueToken(JsonTokenType tokenType)
    {
        return tokenType is
            JsonTokenType.StartObject or
            JsonTokenType.StartArray or
            JsonTokenType.String or
            JsonTokenType.Number or
            JsonTokenType.True or
            JsonTokenType.False or
            JsonTokenType.Null;
    }

    // ── JsonElement → MessagePack ──

    private static void WriteJsonElement(ArrayBufferWriter<byte> buffer, JsonElement element)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                WriteMapHeader(buffer, CountProperties(element));
                foreach (var property in element.EnumerateObject())
                {
                    WriteString(buffer, property.Name);
                    WriteJsonElement(buffer, property.Value);
                }
                break;
            case JsonValueKind.Array:
                WriteArrayHeader(buffer, element.GetArrayLength());
                foreach (var item in element.EnumerateArray())
                {
                    WriteJsonElement(buffer, item);
                }
                break;
            case JsonValueKind.String:
                WriteString(buffer, element.GetString() ?? string.Empty);
                break;
            case JsonValueKind.Number:
                WriteNumber(buffer, element);
                break;
            case JsonValueKind.True:
                WriteByte(buffer, 0xc3);
                break;
            case JsonValueKind.False:
                WriteByte(buffer, 0xc2);
                break;
            case JsonValueKind.Null:
            case JsonValueKind.Undefined:
                WriteByte(buffer, 0xc0);
                break;
            default:
                throw new InvalidDataException($"Unsupported JSON value kind: {element.ValueKind}");
        }
    }

    private static void WriteNumber(ArrayBufferWriter<byte> buffer, JsonElement element)
    {
        if (element.TryGetInt64(out var signed))
        {
            WriteInt(buffer, signed);
            return;
        }

        if (element.TryGetUInt64(out var unsigned))
        {
            WriteUInt(buffer, unsigned);
            return;
        }

        WriteDouble(buffer, element.GetDouble());
    }

    private static int CountProperties(JsonElement element)
    {
        var count = 0;
        foreach (var _ in element.EnumerateObject())
        {
            count++;
        }

        return count;
    }

    // ── Low-level MessagePack writers ──

    private static void WriteString(ArrayBufferWriter<byte> buffer, string value)
    {
        var byteCount = Encoding.UTF8.GetByteCount(value);
        WriteStringHeader(buffer, byteCount);

        var span = buffer.GetSpan(byteCount);
        var written = Encoding.UTF8.GetBytes(value, span);
        buffer.Advance(written);
    }

    private static void WriteStringHeader(ArrayBufferWriter<byte> buffer, int length)
    {
        if (length <= 31)
        {
            WriteByte(buffer, (byte)(0xa0 | length));
            return;
        }

        if (length <= byte.MaxValue)
        {
            WriteByte(buffer, 0xd9);
            WriteByte(buffer, (byte)length);
            return;
        }

        if (length <= ushort.MaxValue)
        {
            WriteByte(buffer, 0xda);
            WriteUInt16(buffer, (ushort)length);
            return;
        }

        WriteByte(buffer, 0xdb);
        WriteUInt32(buffer, checked((uint)length));
    }

    private static void WriteArrayHeader(ArrayBufferWriter<byte> buffer, int length)
    {
        if (length <= 15)
        {
            WriteByte(buffer, (byte)(0x90 | length));
            return;
        }

        if (length <= ushort.MaxValue)
        {
            WriteByte(buffer, 0xdc);
            WriteUInt16(buffer, (ushort)length);
            return;
        }

        WriteByte(buffer, 0xdd);
        WriteUInt32(buffer, checked((uint)length));
    }

    private static void WriteMapHeader(ArrayBufferWriter<byte> buffer, int length)
    {
        if (length <= 15)
        {
            WriteByte(buffer, (byte)(0x80 | length));
            return;
        }

        if (length <= ushort.MaxValue)
        {
            WriteByte(buffer, 0xde);
            WriteUInt16(buffer, (ushort)length);
            return;
        }

        WriteByte(buffer, 0xdf);
        WriteUInt32(buffer, checked((uint)length));
    }

    private static void WriteInt(ArrayBufferWriter<byte> buffer, long value)
    {
        if (value >= 0)
        {
            WriteUInt(buffer, (ulong)value);
            return;
        }

        if (value >= -32)
        {
            WriteByte(buffer, unchecked((byte)value));
            return;
        }

        if (value >= sbyte.MinValue)
        {
            WriteByte(buffer, 0xd0);
            WriteByte(buffer, unchecked((byte)(sbyte)value));
            return;
        }

        if (value >= short.MinValue)
        {
            WriteByte(buffer, 0xd1);
            WriteInt16(buffer, (short)value);
            return;
        }

        if (value >= int.MinValue)
        {
            WriteByte(buffer, 0xd2);
            WriteInt32(buffer, (int)value);
            return;
        }

        WriteByte(buffer, 0xd3);
        WriteInt64(buffer, value);
    }

    private static void WriteUInt(ArrayBufferWriter<byte> buffer, ulong value)
    {
        if (value <= 0x7f)
        {
            WriteByte(buffer, (byte)value);
            return;
        }

        if (value <= byte.MaxValue)
        {
            WriteByte(buffer, 0xcc);
            WriteByte(buffer, (byte)value);
            return;
        }

        if (value <= ushort.MaxValue)
        {
            WriteByte(buffer, 0xcd);
            WriteUInt16(buffer, (ushort)value);
            return;
        }

        if (value <= uint.MaxValue)
        {
            WriteByte(buffer, 0xce);
            WriteUInt32(buffer, (uint)value);
            return;
        }

        WriteByte(buffer, 0xcf);
        WriteUInt64(buffer, value);
    }

    private static void WriteDouble(ArrayBufferWriter<byte> buffer, double value)
    {
        if (!double.IsFinite(value))
        {
            throw new InvalidDataException("MessagePack JSON transcoder does not support non-finite numbers.");
        }

        WriteByte(buffer, 0xcb);
        Span<byte> bytes = stackalloc byte[sizeof(long)];
        BinaryPrimitives.WriteInt64BigEndian(bytes, BitConverter.DoubleToInt64Bits(value));
        WriteBytes(buffer, bytes);
    }

    private static void WriteByte(ArrayBufferWriter<byte> buffer, byte value)
    {
        var span = buffer.GetSpan(1);
        span[0] = value;
        buffer.Advance(1);
    }

    private static void WriteBytes(ArrayBufferWriter<byte> buffer, ReadOnlySpan<byte> value)
    {
        var span = buffer.GetSpan(value.Length);
        value.CopyTo(span);
        buffer.Advance(value.Length);
    }

    private static void WriteUInt16(ArrayBufferWriter<byte> buffer, ushort value)
    {
        Span<byte> bytes = stackalloc byte[sizeof(ushort)];
        BinaryPrimitives.WriteUInt16BigEndian(bytes, value);
        WriteBytes(buffer, bytes);
    }

    private static void WriteInt16(ArrayBufferWriter<byte> buffer, short value)
    {
        Span<byte> bytes = stackalloc byte[sizeof(short)];
        BinaryPrimitives.WriteInt16BigEndian(bytes, value);
        WriteBytes(buffer, bytes);
    }

    private static void WriteUInt32(ArrayBufferWriter<byte> buffer, uint value)
    {
        Span<byte> bytes = stackalloc byte[sizeof(uint)];
        BinaryPrimitives.WriteUInt32BigEndian(bytes, value);
        WriteBytes(buffer, bytes);
    }

    private static void WriteInt32(ArrayBufferWriter<byte> buffer, int value)
    {
        Span<byte> bytes = stackalloc byte[sizeof(int)];
        BinaryPrimitives.WriteInt32BigEndian(bytes, value);
        WriteBytes(buffer, bytes);
    }

    private static void WriteUInt64(ArrayBufferWriter<byte> buffer, ulong value)
    {
        Span<byte> bytes = stackalloc byte[sizeof(ulong)];
        BinaryPrimitives.WriteUInt64BigEndian(bytes, value);
        WriteBytes(buffer, bytes);
    }

    private static void WriteInt64(ArrayBufferWriter<byte> buffer, long value)
    {
        Span<byte> bytes = stackalloc byte[sizeof(long)];
        BinaryPrimitives.WriteInt64BigEndian(bytes, value);
        WriteBytes(buffer, bytes);
    }
}
