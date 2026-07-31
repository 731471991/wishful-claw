"""Patch ProviderDebugModels.cs to add session cache fields to AgentRuntimeTokenUsage."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\runtime\WishfulClaw.Agent\Models\ProviderDebugModels.cs")
data = p.read_bytes()

old = b"    double? CacheReadRatio = null);"
new = (
    b"    double? CacheReadRatio = null,\r\n"
    b"    // Session-cumulative cache tokens (filled by AgentLoop before emitting message_end)\r\n"
    b"    int? SessionCacheHitTokens = null,\r\n"
    b"    int? SessionCacheMissTokens = null,\r\n"
    b"    // Source of this usage: \"executor\", \"subagent\", \"compaction\", etc.\r\n"
    b"    string? UsageSource = null);"
)
assert old in data, "CacheReadRatio field not found"
data = data.replace(old, new, 1)

p.write_bytes(data)
print("Done")
