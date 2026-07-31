"""Patch AgentLoop.cs to set SessionConversation on state and accumulate cache tokens."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\runtime\WishfulClaw.Agent\AgentLoop.cs")
data = p.read_bytes()

# 1. Before ExecuteTurnAsync call, set state.SessionConversation
old_exec = (
    b"            // \xe2\x94\x80\xe2\x94\x80 Execute provider turn (with retry policy for 429/5xx) \xe2\x94\x80\xe2\x94\x80\r\n"
    b"            var turn = await ProviderRetryPolicy.ExecuteAsync(\r\n"
)
new_exec = (
    b"            // \xe2\x94\x80\xe2\x94\x80 Execute provider turn (with retry policy for 429/5xx) \xe2\x94\x80\xe2\x94\x80\r\n"
    b"            // Expose SessionConversation on state so providers can attach\r\n"
    b"            // session-cumulative cache counters to message_end events.\r\n"
    b"            state.SessionConversation = sessionConv;\r\n"
    b"            var turn = await ProviderRetryPolicy.ExecuteAsync(\r\n"
)
assert old_exec in data, "ExecuteTurnAsync call not found"
data = data.replace(old_exec, new_exec, 1)

# 2. After turn returns, accumulate cache tokens from turn.Usage
old_ctx = (
    b"            if (turn.Usage?.ContextTokens is > 0)\r\n"
    b"            {\r\n"
    b"                lastInputTokens = turn.Usage.ContextTokens.Value;\r\n"
    b"            }\r\n"
)
new_ctx = (
    b"            if (turn.Usage?.ContextTokens is > 0)\r\n"
    b"            {\r\n"
    b"                lastInputTokens = turn.Usage.ContextTokens.Value;\r\n"
    b"            }\r\n"
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
assert old_ctx in data, "ContextTokens block not found"
data = data.replace(old_ctx, new_ctx, 1)

p.write_bytes(data)
print("Done")
