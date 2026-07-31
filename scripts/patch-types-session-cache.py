"""Patch types.ts to add sessionCacheHit/Miss fields on Session."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\renderer\src\stores\chat-store\types.ts")
data = p.read_bytes()

# Add sessionCacheHit/Miss fields before personaId
old = b"  personaId?: string\r\n"
if old not in data:
    old = b"  personaId?: string\n"

new = (
    b"  personaId?: string\r\n"
    b"  // Session-cumulative cache counters from backend (Reasonix-style).\r\n"
    b"  // Updated on each message_end event, read directly by the status bar.\r\n"
    b"  sessionCacheHit?: number\r\n"
    b"  sessionCacheMiss?: number\r\n"
)
assert old in data, "personaId field not found"
data = data.replace(old, new, 1)

p.write_bytes(data)
print("Done")
