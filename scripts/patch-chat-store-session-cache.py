"""Patch chat-store/index.ts to store sessionCacheHit/Miss on message_end."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\renderer\src\stores\chat-store\index.ts")
data = p.read_bytes()

# After msg.timing = event.timing, add session cache update
old = b"                  msg.timing = event.timing\r\n"
new = (
    b"                  msg.timing = event.timing\r\n"
    b"\r\n"
    b"                  // Store session-cumulative cache counters from backend\r\n"
    b"                  if (event.usage?.sessionCacheHitTokens != null) {\r\n"
    b"                    session.sessionCacheHit = event.usage.sessionCacheHitTokens\r\n"
    b"                  }\r\n"
    b"                  if (event.usage?.sessionCacheMissTokens != null) {\r\n"
    b"                    session.sessionCacheMiss = event.usage.sessionCacheMissTokens\r\n"
    b"                  }\r\n"
)
assert old in data, "msg.timing line not found"
data = data.replace(old, new, 1)

p.write_bytes(data)
print("Done")
