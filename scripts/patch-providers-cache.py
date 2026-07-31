"""Patch both providers to attach session cache totals and usage source to message_end events."""
import pathlib

# --- Anthropic provider ---
p = pathlib.Path(r"D:\claw\wishful-claw\src\runtime\WishfulClaw.Agent\AnthropicMessagesProvider.cs")
data = p.read_bytes()

old = (
    b"        await AgentRuntimeTools.EmitAsync(\r\n"
    b"            state, context,\r\n"
    b"            new AgentRuntimeStreamEvent(\r\n"
    b"                \"message_end\",\r\n"
    b"                StopReason: parseState.StopReason,\r\n"
    b"                Usage: parseState.Usage,\r\n"
    b"                Timing: new AgentRuntimeRequestTiming(\r\n"
    b"                    totalMs,\r\n"
    b"                    parseState.FirstTokenMs,\r\n"
    b"                    AgentLoop.ComputeTps(parseState.Usage?.OutputTokens ?? parseState.EstimatedOutputTokens, parseState.FirstTokenMs, totalMs))));\r\n"
)
new = (
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
    b"\r\n"
    b"        await AgentRuntimeTools.EmitAsync(\r\n"
    b"            state, context,\r\n"
    b"            new AgentRuntimeStreamEvent(\r\n"
    b"                \"message_end\",\r\n"
    b"                StopReason: parseState.StopReason,\r\n"
    b"                Usage: emitUsage,\r\n"
    b"                Timing: new AgentRuntimeRequestTiming(\r\n"
    b"                    totalMs,\r\n"
    b"                    parseState.FirstTokenMs,\r\n"
    b"                    AgentLoop.ComputeTps(parseState.Usage?.OutputTokens ?? parseState.EstimatedOutputTokens, parseState.FirstTokenMs, totalMs))));\r\n"
)
assert old in data, "Anthropic message_end block not found"
data = data.replace(old, new, 1)
p.write_bytes(data)
print("Anthropic done")

# --- OpenAI provider ---
p2 = pathlib.Path(r"D:\claw\wishful-claw\src\runtime\WishfulClaw.Agent\OpenAIChatProvider.cs")
data2 = p2.read_bytes()

old2 = (
    b"        await AgentRuntimeTools.EmitAsync(\r\n"
    b"            state, context,\r\n"
    b"            new AgentRuntimeStreamEvent(\r\n"
    b"                \"message_end\",\r\n"
    b"                StopReason: finalStopReason,\r\n"
    b"                Usage: finalUsage,\r\n"
    b"                Timing: new AgentRuntimeRequestTiming(\r\n"
    b"                    totalMs, firstTokenMs,\r\n"
    b"                    AgentLoop.ComputeTps(finalUsage?.OutputTokens ?? estimatedOutputTokens, firstTokenMs, totalMs))));\r\n"
)
new2 = (
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
    b"\r\n"
    b"        await AgentRuntimeTools.EmitAsync(\r\n"
    b"            state, context,\r\n"
    b"            new AgentRuntimeStreamEvent(\r\n"
    b"                \"message_end\",\r\n"
    b"                StopReason: finalStopReason,\r\n"
    b"                Usage: emitUsage,\r\n"
    b"                Timing: new AgentRuntimeRequestTiming(\r\n"
    b"                    totalMs, firstTokenMs,\r\n"
    b"                    AgentLoop.ComputeTps(finalUsage?.OutputTokens ?? estimatedOutputTokens, firstTokenMs, totalMs))));\r\n"
)
assert old2 in data2, "OpenAI message_end block not found"
data2 = data2.replace(old2, new2, 1)
p2.write_bytes(data2)
print("OpenAI done")
