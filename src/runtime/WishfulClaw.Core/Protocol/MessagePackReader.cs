namespace WishfulClaw.Core.Protocol;

using System.Buffers;
using System.Buffers.Binary;
using System.Text;
using System.Text.Json;

/// <summary>
/// Reads MessagePack binary data and converts it to JSON.
/// Extracted from MessagePackJsonTranscoder to keep files focused.
/// </summary>
internal ref struct MessagePackReader
{
    private readonly ReadOnlySpan<byte> data;
    private int offset;

    public MessagePackReader(ReadOnlySpan<byte> data)
    {
        this.data = data;
        offset = 0;
    }

    public void EnsureComplete()
    {
        if (offset != data.Length)
        {
            throw new InvalidDataException("MessagePack payload contains trailing bytes.");
        }
    }

    public void WriteJsonValue(Utf8JsonWriter writer)
    {
        var code = ReadByte();

        if (code <= 0x7f)
        {
            writer.WriteNumberValue(code);
            return;
        }

        if (code >= 0xe0)
        {
            writer.WriteNumberValue(unchecked((sbyte)code));
            return;
        }

        if ((code & 0xf0) == 0x80)
        {
            WriteMap(writer, code & 0x0f);
            return;
        }

        if ((code & 0xf0) == 0x90)
        {
            WriteArray(writer, code & 0x0f);
            return;
        }

        if ((code & 0xe0) == 0xa0)
        {
            writer.WriteStringValue(ReadStringBytes(code & 0x1f));
            return;
        }

        switch (code)
        {
            case 0xc0:
                writer.WriteNullValue();
                break;
            case 0xc2:
                writer.WriteBooleanValue(false);
                break;
            case 0xc3:
                writer.WriteBooleanValue(true);
                break;
            case 0xc4:
                writer.WriteStringValue(Convert.ToBase64String(ReadBytes(ReadByte())));
                break;
            case 0xc5:
                writer.WriteStringValue(Convert.ToBase64String(ReadBytes(ReadUInt16())));
                break;
            case 0xc6:
                writer.WriteStringValue(Convert.ToBase64String(ReadBytes(ReadInt32Length())));
                break;
            case 0xca:
                WriteSingle(writer);
                break;
            case 0xcb:
                WriteDouble(writer);
                break;
            case 0xcc:
                writer.WriteNumberValue(ReadByte());
                break;
            case 0xcd:
                writer.WriteNumberValue(ReadUInt16());
                break;
            case 0xce:
                writer.WriteNumberValue(ReadUInt32());
                break;
            case 0xcf:
                writer.WriteNumberValue(ReadUInt64());
                break;
            case 0xd0:
                writer.WriteNumberValue(unchecked((sbyte)ReadByte()));
                break;
            case 0xd1:
                writer.WriteNumberValue(ReadInt16());
                break;
            case 0xd2:
                writer.WriteNumberValue(ReadInt32());
                break;
            case 0xd3:
                writer.WriteNumberValue(ReadInt64());
                break;
            case 0xd9:
                writer.WriteStringValue(ReadStringBytes(ReadByte()));
                break;
            case 0xda:
                writer.WriteStringValue(ReadStringBytes(ReadUInt16()));
                break;
            case 0xdb:
                writer.WriteStringValue(ReadStringBytes(ReadInt32Length()));
                break;
            case 0xdc:
                WriteArray(writer, ReadUInt16());
                break;
            case 0xdd:
                WriteArray(writer, ReadInt32Length());
                break;
            case 0xde:
                WriteMap(writer, ReadUInt16());
                break;
            case 0xdf:
                WriteMap(writer, ReadInt32Length());
                break;
            default:
                throw new InvalidDataException($"Unsupported MessagePack code: 0x{code:x2}");
        }
    }

    private void WriteArray(Utf8JsonWriter writer, int length)
    {
        writer.WriteStartArray();
        for (var i = 0; i < length; i++)
        {
            WriteJsonValue(writer);
        }

        writer.WriteEndArray();
    }

    private void WriteMap(Utf8JsonWriter writer, int length)
    {
        writer.WriteStartObject();
        for (var i = 0; i < length; i++)
        {
            writer.WritePropertyName(ReadMapKey());
            WriteJsonValue(writer);
        }

        writer.WriteEndObject();
    }

    private string ReadMapKey()
    {
        var code = ReadByte();

        if ((code & 0xe0) == 0xa0)
        {
            return ReadStringBytes(code & 0x1f);
        }

        return code switch
        {
            0xd9 => ReadStringBytes(ReadByte()),
            0xda => ReadStringBytes(ReadUInt16()),
            0xdb => ReadStringBytes(ReadInt32Length()),
            _ => throw new InvalidDataException("MessagePack map keys must be strings.")
        };
    }

    private void WriteSingle(Utf8JsonWriter writer)
    {
        var value = BitConverter.Int32BitsToSingle(ReadInt32());
        if (!float.IsFinite(value))
        {
            throw new InvalidDataException("MessagePack JSON transcoder does not support non-finite numbers.");
        }

        writer.WriteNumberValue(value);
    }

    private void WriteDouble(Utf8JsonWriter writer)
    {
        var value = BitConverter.Int64BitsToDouble(ReadInt64());
        if (!double.IsFinite(value))
        {
            throw new InvalidDataException("MessagePack JSON transcoder does not support non-finite numbers.");
        }

        writer.WriteNumberValue(value);
    }

    private string ReadStringBytes(int length)
    {
        return Encoding.UTF8.GetString(ReadBytes(length));
    }

    private byte ReadByte()
    {
        if (offset >= data.Length)
        {
            throw new EndOfStreamException("MessagePack payload ended early.");
        }

        return data[offset++];
    }

    private ReadOnlySpan<byte> ReadBytes(int length)
    {
        if (length < 0 || data.Length - offset < length)
        {
            throw new EndOfStreamException("MessagePack payload ended early.");
        }

        var bytes = data.Slice(offset, length);
        offset += length;
        return bytes;
    }

    private ushort ReadUInt16()
    {
        return BinaryPrimitives.ReadUInt16BigEndian(ReadBytes(sizeof(ushort)));
    }

    private uint ReadUInt32()
    {
        return BinaryPrimitives.ReadUInt32BigEndian(ReadBytes(sizeof(uint)));
    }

    private ulong ReadUInt64()
    {
        return BinaryPrimitives.ReadUInt64BigEndian(ReadBytes(sizeof(ulong)));
    }

    private short ReadInt16()
    {
        return BinaryPrimitives.ReadInt16BigEndian(ReadBytes(sizeof(short)));
    }

    private int ReadInt32()
    {
        return BinaryPrimitives.ReadInt32BigEndian(ReadBytes(sizeof(int)));
    }

    private long ReadInt64()
    {
        return BinaryPrimitives.ReadInt64BigEndian(ReadBytes(sizeof(long)));
    }

    private int ReadInt32Length()
    {
        var value = ReadUInt32();
        if (value > int.MaxValue)
        {
            throw new InvalidDataException($"MessagePack payload length is too large: {value}");
        }

        return (int)value;
    }
}
