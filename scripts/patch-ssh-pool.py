"""Add closeConnection function to connection-pool.ts"""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\main\ssh\connection-pool.ts")
text = p.read_text(encoding="utf-8")

old = """/**
 * Close all active SSH connections (used during app shutdown).
 */
export function closeAllSshConnections(): void {"""

new = """/**
 * Close a single SSH connection by connectionId.
 * Used when the user explicitly disconnects.
 */
export function closeConnection(connectionId: string): void {
  const handle = handles.get(connectionId)
  if (handle) {
    closeHandle(handle)
  }
}

/**
 * Close all active SSH connections (used during app shutdown).
 */
export function closeAllSshConnections(): void {"""

if old not in text:
    # Try with CRLF
    old_crlf = old.replace("\n", "\r\n")
    if old_crlf in text:
        text = text.replace(old_crlf, new.replace("\n", "\r\n"))
        p.write_text(text, encoding="utf-8")
        print("OK (CRLF)")
    else:
        print("NOT FOUND")
else:
    text = text.replace(old, new)
    p.write_text(text, encoding="utf-8")
    print("OK (LF)")
