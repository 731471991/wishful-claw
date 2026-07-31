"""Patch providers to accumulate cache tokens BEFORE emitting message_end."""
import pathlib

# --- Anthropic provider ---
p = pathlib.Path(r"D:\claw\wishful-claw\src\runtime\WishfulClaw.Agent\AnthropicMessagesProvider.cs")
data = p.read_bytes()

old = (
    b"        // Attach session-cumulative cache counters and usage source to the usage object\r\n"
    b"        var emitUsage = parseState.Usage;\r\n"
    b"        if (emitUsage is not null && state.SessionConversation is { } sessConv)\r\n"
    b"        {\r\n"
    b"            emitUsage = emitUsage with\r\n"
    b"            {\r\n"
    b"                SessionCacheHitTokens = (int)sessConv.SessionCacheHit,\r\n"
    b"                SessionCacheMissTokens = (int)sessConv.SessionCacheMiss,\r\n"
    b"                UsageSource = state.UsageSource\r\n"
    b"            };\r\n"
    b"        }\r\n"
)
new = (
    b"        // Accumulate cache tokens and attach session-cumulative counters + usage source.\r\n"
    b"        var emitUsage = parseState.Usage;\r\n"
    b"        if (emitUsage is not null && state.SessionConversation is { } sessConv)\r\n"
    b"        {\r\n"
    b"            var cacheHit = emitUsage.CacheReadTokens ?? 0;\r\n"
    b"            var billableInput = emitUsage.BillableInputTokens\r\n"
    b"                ?? Math.Max(0, emitUsage.InputTokens - cacheHit);\r\n"
    b"            var cacheCreation = emitUsage.CacheCreationTokens ?? 0;\r\n"
    b"            var cacheMiss = billableInput + cacheCreation;\r\n"
    b"            sessConv.AccumulateCacheTokens(cacheHit, cacheMiss);\r\n"
    b"            emitUsage = emitUsage with\r\n"
    b"            {\r\n"
    b"                SessionCacheHitTokens = (int)sessConv.SessionCacheHit,\r\n"
    b"                SessionCacheMissTokens = (int)sessConv.SessionCacheMiss,\r\n"
    b"                UsageSource = state.UsageSource\r\n"
    b"            };\r\n"
    b"        }\r\n"
)
assert old in data, "Anthropic emit block not found"
data = data.replace(old, new, 1)
p.write_bytes(data)
print("Anthropic done")

# --- OpenAI provider ---
p2 = pathlib.Path(r"D:\claw\wishful-claw\src\runtime\WishfulClaw.Agent\OpenAIChatProvider.cs")
data2 = p2.read_bytes()

old2 = (
    b"        // Attach session-cumulative cache counters and usage source to the usage object\r\n"
    b"        var emitUsage = finalUsage;\r\n"
    b"        if (emitUsage is not null && state.SessionConversation is { } sessConv)\r\n"
    b"        {\r\n"
    b"            emitUsage = emitUsage with\r\n"
    b"            {\r\n"
    b"                SessionCacheHitTokens = (int)sessConv.SessionCacheHit,\r\n"
    b"                SessionCacheMissTokens = (int)sessConv.SessionCacheMiss,\r\n"
    b"                UsageSource = state.UsageSource\r\n"
    b"            };\r\n"
    b"        }\r\n"
)
new2 = (
    b"        // Accumulate cache tokens and attach session-cumulative counters + usage source.\r\n"
    b"        var emitUsage = finalUsage;\r\n"
    b"        if (emitUsage is not null && state.SessionConversation is { } sessConv)\r\n"
    b"        {\r\n"
    b"            var cacheHit = emitUsage.CacheReadTokens ?? 0;\r\n"
    b"            var billableInput = emitUsage.BillableInputTokens\r\n"
    b"                ?? Math.Max(0, emitUsage.InputTokens - cacheHit);\r\n"
    b"            var cacheCreation = emitUsage.CacheCreationTokens ?? 0;\r\n"
    b"            var cacheMiss = billableInput + cacheCreation;\r\n"
    b"            sessConv.AccumulateCacheTokens(cacheHit, cacheMiss);\r\n"
    b"            emitUsage = emitUsage with\r\n"
    b"            {\r\n"
    b"                SessionCacheHitTokens = (int)sessConv.SessionCacheHit,\r\n"
    b"                SessionCacheMissTokens = (int)sessConv.SessionCacheMiss,\r\n"
    b"                UsageSource = state.UsageSource\r\n"
    b"            };\r\n"
    b"        }\r\n"
)
assert old2 in data2, "OpenAI emit block not found"
data2 = data2.replace(old2, new2, 1)
p2.write_bytes(data2)
print("OpenAI done")
