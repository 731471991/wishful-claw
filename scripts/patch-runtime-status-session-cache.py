"""Patch runtime-status.tsx to use session cache hit/miss from backend."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\renderer\src\components\chat\InputArea\runtime-status.tsx")
data = p.read_bytes()

# 1. Update imports to include formatSessionCacheHitRate
old_import = (
    b"  formatCacheHitRate, formatCost,\r\n"
    b"  getCacheHitRate\r\n"
    b"} from '@renderer/lib/format-tokens'\r\n"
)
new_import = (
    b"  formatCacheHitRate, formatCost,\r\n"
    b"  formatSessionCacheHitRate, getCacheHitRate\r\n"
    b"} from '@renderer/lib/format-tokens'\r\n"
)
assert old_import in data, "import block not found"
data = data.replace(old_import, new_import, 1)

# 2. Add sessionCacheHit/Miss to the useShallow return values
# Find the return object and add fields
old_return = b"        isGeneratingImage: messagesOverride\r\n"
# This is tricky — find the actual return block
# Look for "return {" near the end of the useShallow selector
old_ret = (
    b"        isGeneratingImage: messagesOverride\r\n"
    b"          ? false\r\n"
    b"          : streamingMessageId\r\n"
    b"            ? Boolean(s.generatingImageMessages[streamingMessageId])\r\n"
    b"            : false\r\n"
    b"      }\r\n"
    b"    })\r\n"
)
new_ret = (
    b"        isGeneratingImage: messagesOverride\r\n"
    b"          ? false\r\n"
    b"          : streamingMessageId\r\n"
    b"            ? Boolean(s.generatingImageMessages[streamingMessageId])\r\n"
    b"            : false,\r\n"
    b"        sessionCacheHit: session?.sessionCacheHit,\r\n"
    b"        sessionCacheMiss: session?.sessionCacheMiss\r\n"
    b"      }\r\n"
    b"    })\r\n"
)
assert old_ret in data, "return block not found"
data = data.replace(old_ret, new_ret, 1)

# 3. Replace cacheHitRate calculation to use session-level values when available
old_calc = (
    b"  const cacheHitRate = getCacheHitRate(\r\n"
    b"    inputTokens,\r\n"
    b"    cacheReadTokens,\r\n"
    b"    cacheCreationTokens\r\n"
    b"  )\r\n"
)
new_calc = (
    b"  // Session-level cache hit rate from backend (Reasonix-style: \xce\xa3hit/\xce\xa3(hit+miss))\r\n"
    b"  // Falls back to per-message traversal when session counters are unavailable.\r\n"
    b"  const hasSessionCache = live.sessionCacheHit != null || live.sessionCacheMiss != null\r\n"
    b"  const cacheHitRate = hasSessionCache\r\n"
    b"    ? (live.sessionCacheHit ?? 0) / Math.max(1, (live.sessionCacheHit ?? 0) + (live.sessionCacheMiss ?? 0))\r\n"
    b"    : getCacheHitRate(inputTokens, cacheReadTokens, cacheCreationTokens)\r\n"
    b"  const sessionCacheRateLabel = hasSessionCache\r\n"
    b"    ? formatSessionCacheHitRate(live.sessionCacheHit, live.sessionCacheMiss)\r\n"
    b"    : null\r\n"
)
assert old_calc in data, "cacheHitRate calculation not found"
data = data.replace(old_calc, new_calc, 1)

# 4. Use sessionCacheRateLabel for display when available
old_display = b"        suffix={formatCacheHitRate(cacheHitRate)}\r\n"
new_display = b"        suffix={sessionCacheRateLabel ?? formatCacheHitRate(cacheHitRate)}\r\n"
assert old_display in data, "suffix display not found"
data = data.replace(old_display, new_display, 1)

p.write_bytes(data)
print("Done")
