"""Patch AgentRuntimeRunState.cs to add SessionConversation reference."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\runtime\WishfulClaw.Agent\AgentRuntimeRunState.cs")
data = p.read_bytes()

# Add SessionConversation property after UsageSource
old = b'    public string UsageSource { get; set; } = "executor";\r\n'
new = (
    b'    public string UsageSource { get; set; } = "executor";\r\n'
    b'\r\n'
    b'    /// <summary>\r\n'
    b'    /// The session conversation for this run. Set by AgentLoop before executing\r\n'
    b'    /// provider turns so that providers can read session-level cache counters\r\n'
    b'    /// and attach them to message_end events.\r\n'
    b'    /// </summary>\r\n'
    b'    public SessionConversation? SessionConversation { get; set; }\r\n'
)
assert old in data, "UsageSource not found"
data = data.replace(old, new, 1)

p.write_bytes(data)
print("Done")
