"""Patch StreamEventModels.cs to add session cache fields and usage source."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\runtime\WishfulClaw.Agent\Models\StreamEventModels.cs")
data = p.read_bytes()

# Add new fields at the end of AgentRuntimeStreamEvent record, before the closing paren
old = b"    JsonElement? Result = null);"
new = (
    b"    JsonElement? Result = null,\r\n"
    b"    // Session-cumulative cache tokens (carried on message_end events)\r\n"
    b"    int? SessionCacheHit = null,\r\n"
    b"    int? SessionCacheMiss = null,\r\n"
    b"    // Usage source: \"executor\", \"subagent\", \"compaction\", etc.\r\n"
    b"    string? UsageSource = null);"
)
assert old in data, "Result field not found"
data = data.replace(old, new, 1)

p.write_bytes(data)
print("Done")
