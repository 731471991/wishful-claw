"""Patch AgentStreamMessagePackEmitter.cs to serialize session cache fields."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\runtime\WishfulClaw.Agent\AgentStreamMessagePackEmitter.cs")
data = p.read_bytes()

# 1. Add write calls at end of WriteOptionalUsage
old_write = (
    b"        if (usage.CacheReadRatio.HasValue)\r\n"
    b"        {\r\n"
    b"            writer.WriteString(\"cacheReadRatio\");\r\n"
    b"            writer.WriteDouble(usage.CacheReadRatio.Value);\r\n"
    b"        }\r\n"
    b"    }\r\n"
)
new_write = (
    b"        if (usage.CacheReadRatio.HasValue)\r\n"
    b"        {\r\n"
    b"            writer.WriteString(\"cacheReadRatio\");\r\n"
    b"            writer.WriteDouble(usage.CacheReadRatio.Value);\r\n"
    b"        }\r\n"
    b"        WriteOptionalInt(writer, \"sessionCacheHitTokens\", usage.SessionCacheHitTokens);\r\n"
    b"        WriteOptionalInt(writer, \"sessionCacheMissTokens\", usage.SessionCacheMissTokens);\r\n"
    b"        WriteOptionalString(writer, \"usageSource\", usage.UsageSource);\r\n"
    b"    }\r\n"
)
assert old_write in data, "WriteOptionalUsage end not found"
data = data.replace(old_write, new_write, 1)

# 2. Add count at end of CountUsageProperties
old_count = (
    b"        if (usage.CacheReadRatio.HasValue) count++;\r\n"
    b"        return count;\r\n"
    b"    }\r\n"
)
new_count = (
    b"        if (usage.CacheReadRatio.HasValue) count++;\r\n"
    b"        if (usage.SessionCacheHitTokens.HasValue) count++;\r\n"
    b"        if (usage.SessionCacheMissTokens.HasValue) count++;\r\n"
    b"        if (usage.UsageSource is not null) count++;\r\n"
    b"        return count;\r\n"
    b"    }\r\n"
)
assert old_count in data, "CountUsageProperties end not found"
data = data.replace(old_count, new_count, 1)

# 3. Check if WriteOptionalString exists
if b"WriteOptionalString" not in data:
    # Add it after WriteOptionalInt
    old_helper = b"    private static void WriteOptionalInt(WorkerMessagePackWriter writer, string key, int? value)\r\n"
    new_helper = (
        b"    private static void WriteOptionalString(WorkerMessagePackWriter writer, string key, string? value)\r\n"
        b"    {\r\n"
        b"        if (value is null) return;\r\n"
        b"        writer.WriteString(key);\r\n"
        b"        writer.WriteString(value);\r\n"
        b"    }\r\n"
        b"\r\n"
        b"    private static void WriteOptionalInt(WorkerMessagePackWriter writer, string key, int? value)\r\n"
    )
    assert old_helper in data, "WriteOptionalInt not found"
    data = data.replace(old_helper, new_helper, 1)

p.write_bytes(data)
print("Done")
