"""Patch types.ts to add SessionUsageTotals interface and usageTotals field on Session."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\renderer\src\stores\chat-store\types.ts")
# Read in binary, work with CRLF
data = p.read_bytes()

# 1. Add SessionUsageTotals before Session interface
session_marker = b"// \xe2\x94\x80\xe2\x94\x80\xe2\x94\x80 Session \xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\r\nexport interface Session {\r\n"
totals_iface = (
    b"// \xe2\x94\x80\xe2\x94\x80\xe2\x94\x80 Session Usage Totals (cached on session to avoid per-render traversal) \xe2\x94\x80\xe2\x94\x80\xe2\x94\x80\r\n"
    b"export interface SessionUsageTotals {\r\n"
    b"  inputTokens: number\r\n"
    b"  outputTokens: number\r\n"
    b"  billableInputTokens: number\r\n"
    b"  cacheReadTokens: number\r\n"
    b"  cacheCreationTokens: number\r\n"
    b"  cacheCreation5mTokens: number\r\n"
    b"  cacheCreation1hTokens: number\r\n"
    b"  inputCost: number | null\r\n"
    b"  outputCost: number | null\r\n"
    b"  cacheReadCost: number | null\r\n"
    b"  cacheCreationCost: number | null\r\n"
    b"  totalCost: number | null\r\n"
    b"  latestRequestTiming: RequestTimingWire | null\r\n"
    b"}\r\n"
    b"\r\n"
)
assert session_marker in data, "Session marker not found"
data = data.replace(session_marker, totals_iface + session_marker, 1)

# 2. Add usageTotals field on Session
session_end = b"  personaId?: string\r\n}\r\n\r\n// \xe2\x94\x80\xe2\x94\x80\xe2\x94\x80 Project"
session_new = (
    b"  personaId?: string\r\n"
    b"  /** Cached cumulative usage across all messages \xe2\x80\x94 updated incrementally on message_end. */\r\n"
    b"  usageTotals?: SessionUsageTotals\r\n"
    b"}\r\n\r\n// \xe2\x94\x80\xe2\x94\x80\xe2\x94\x80 Project"
)
assert session_end in data, "Session end marker not found"
data = data.replace(session_end, session_new, 1)

p.write_bytes(data)
print("Done")
