"""Remove the duplicate cache accumulation from AgentLoop (now done in providers)."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\runtime\WishfulClaw.Agent\AgentLoop.cs")
data = p.read_bytes()

old = (
    b"\r\n"
    b"            // Accumulate session-level cache counters (LA Reasonix).\r\n"
    b"            // hit = cacheReadTokens; miss = billableInputTokens + cacheCreationTokens\r\n"
    b"            // (billable input = tokens not served from cache; cache creation = tokens written to cache)\r\n"
    b"            if (turn.Usage is { } turnUsage)\r\n"
    b"            {\r\n"
    b"                var cacheHit = turnUsage.CacheReadTokens ?? 0;\r\n"
    b"                var billableInput = turnUsage.BillableInputTokens\r\n"
    b"                    ?? Math.Max(0, turnUsage.InputTokens - cacheHit);\r\n"
    b"                var cacheCreation = turnUsage.CacheCreationTokens ?? 0;\r\n"
    b"                var cacheMiss = billableInput + cacheCreation;\r\n"
    b"                sessionConv.AccumulateCacheTokens(cacheHit, cacheMiss);\r\n"
    b"            }\r\n"
)
new = b"\r\n"
assert old in data, "duplicate accumulation block not found"
data = data.replace(old, new, 1)

p.write_bytes(data)
print("Done")
