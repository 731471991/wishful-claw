"""Patch format-tokens.ts to add session-level cache hit rate functions."""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\renderer\src\lib\format-tokens.ts")
data = p.read_bytes()

old = b"export function formatCacheHitRate(rate: number): string {\r\n"
if old not in data:
    old = b"export function formatCacheHitRate(rate: number): string {\n"
    if old not in data:
        # find the function
        lines = data.split(b'\n')
        for i, line in enumerate(lines):
            if b'formatCacheHitRate' in line and b'export function' in line:
                print(f"Found at line {i}: {repr(line)}")
                break
        raise ValueError("formatCacheHitRate not found")

# Find the closing brace of formatCacheHitRate
func_start = data.index(old)
# Find the next "}\n" after func_start
brace_end = data.index(b"}\r\n", func_start) + 3
if b"}\n" in data[func_start:brace_end]:
    pass  # already includes newline

insertion = (
    b"\r\n"
    b"/**\r\n"
    b" * Session-level cache hit rate using Reasonix's formula:\r\n"
    b" * hitRate = sessionCacheHit / (sessionCacheHit + sessionCacheMiss)\r\n"
    b" * Returns 0 when no cache data exists.\r\n"
    b" */\r\n"
    b"export function getSessionCacheHitRate(\r\n"
    b"  sessionCacheHit: number | undefined,\r\n"
    b"  sessionCacheMiss: number | undefined\r\n"
    b"): number {\r\n"
    b"  const hit = Math.max(0, sessionCacheHit ?? 0)\r\n"
    b"  const miss = Math.max(0, sessionCacheMiss ?? 0)\r\n"
    b"  const denom = hit + miss\r\n"
    b"  if (denom <= 0) return 0\r\n"
    b"  return hit / denom\r\n"
    b"}\r\n"
    b"\r\n"
    b"/**\r\n"
    b" * Format session cache hit rate as a percentage string.\r\n"
    b" * Uses 2 decimal places (matching Reasonix's formatCacheHitRate).\r\n"
    b" */\r\n"
    b"export function formatSessionCacheHitRate(\r\n"
    b"  sessionCacheHit: number | undefined,\r\n"
    b"  sessionCacheMiss: number | undefined\r\n"
    b"): string {\r\n"
    b"  const hit = Math.max(0, sessionCacheHit ?? 0)\r\n"
    b"  const miss = Math.max(0, sessionCacheMiss ?? 0)\r\n"
    b"  const denom = hit + miss\r\n"
    b"  if (denom <= 0) return '-'\r\n"
    b"  const pct = (hit / denom) * 100\r\n"
    b"  return `${pct.toFixed(2)}%`\r\n"
    b"}\r\n"
)

data = data[:brace_end] + insertion + data[brace_end:]
p.write_bytes(data)
print("Done")
