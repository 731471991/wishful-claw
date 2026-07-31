"""Patch AgentRuntimeRunState.cs to add UsageSource field."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\runtime\WishfulClaw.Agent\AgentRuntimeRunState.cs")
data = p.read_bytes()

# Add UsageSource property after SuppressTransportEvents
old = (
    b"    public bool SuppressTransportEvents { get; set; }\r\n"
)
new = (
    b"    public bool SuppressTransportEvents { get; set; }\r\n"
    b"\r\n"
    b"    /// <summary>\r\n"
    b"    /// Identifies the source of usage events: \"executor\", \"subagent\", \"compaction\", etc.\r\n"
    b"    /// Default is \"executor\". Set by the caller before executing a provider turn.\r\n"
    b"    /// </summary>\r\n"
    b"    public string UsageSource { get; set; } = \"executor\";\r\n"
)
assert old in data, "SuppressTransportEvents not found"
data = data.replace(old, new, 1)

p.write_bytes(data)
print("Done")
