"""Patch SessionConversation.cs to add session-level cache counters."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\runtime\WishfulClaw.Agent\SessionConversation.cs")
data = p.read_bytes()

# 1. Add cache counter fields and methods after _version field
old_fields = b"    private long _version;\r\n"
new_fields = (
    b"    private long _version;\r\n"
    b"\r\n"
    b"    // Session-level cumulative cache counters (LA Reasonix's sessCacheHit/sessCacheMiss).\r\n"
    b"    // Atomic: the run loop accumulates them while the status bar reads them.\r\n"
    b"    // NOT reset on compaction -- the aggregate never craters when the prefix is summarized away.\r\n"
    b"    private long _sessCacheHit;\r\n"
    b"    private long _sessCacheMiss;\r\n"
    b"\r\n"
    b"    /// <summary>\r\n"
    b"    /// Cumulative cache-hit prompt tokens across every API call this session.\r\n"
    b"    /// </summary>\r\n"
    b"    public long SessionCacheHit => Interlocked.Read(ref _sessCacheHit);\r\n"
    b"\r\n"
    b"    /// <summary>\r\n"
    b"    /// Cumulative cache-miss prompt tokens across every API call this session.\r\n"
    b"    /// </summary>\r\n"
    b"    public long SessionCacheMiss => Interlocked.Read(ref _sessCacheMiss);\r\n"
    b"\r\n"
    b"    /// <summary>\r\n"
    b"    /// Accumulate cache hit/miss tokens from a single API call.\r\n"
    b"    /// Thread-safe via Interlocked.\r\n"
    b"    /// </summary>\r\n"
    b"    public void AccumulateCacheTokens(int hit, int miss)\r\n"
    b"    {\r\n"
    b"        if (hit > 0) Interlocked.Add(ref _sessCacheHit, hit);\r\n"
    b"        if (miss > 0) Interlocked.Add(ref _sessCacheMiss, miss);\r\n"
    b"    }\r\n"
    b"\r\n"
    b"    /// <summary>\r\n"
    b"    /// Reset cache counters -- called on Initialize (full session restore).\r\n"
    b"    /// </summary>\r\n"
    b"    public void ResetCacheTotals()\r\n"
    b"    {\r\n"
    b"        Interlocked.Exchange(ref _sessCacheHit, 0);\r\n"
    b"        Interlocked.Exchange(ref _sessCacheMiss, 0);\r\n"
    b"    }\r\n"
)
assert old_fields in data, "version field not found"
data = data.replace(old_fields, new_fields, 1)

# 2. Add ResetCacheTotals() call at end of Initialize
old_init = (
    b"            _version++;\r\n"
    b"        }\r\n"
    b"    }\r\n"
    b"\r\n"
    b"    /// <summary>\r\n"
    b"    /// Appends incremental"
)
new_init = (
    b"            _version++;\r\n"
    b"        }\r\n"
    b"        ResetCacheTotals();\r\n"
    b"    }\r\n"
    b"\r\n"
    b"    /// <summary>\r\n"
    b"    /// Appends incremental"
)
assert old_init in data, "Initialize end not found"
data = data.replace(old_init, new_init, 1)

p.write_bytes(data)
print("Done")
