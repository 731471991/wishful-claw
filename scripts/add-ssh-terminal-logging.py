"""Add debug logging to AgentSshTerminal.tsx"""
import sys

filepath = r'D:\claw\wishful-claw\src\renderer\src\components\terminal\AgentSshTerminal.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

le = b'\r\n' if b'\r\n' in content else b'\n'
changes = 0

# 1. Add log after header line
old1 = b"    term.writeln('')" + le
new1 = b"    term.writeln('')" + le + b"    console.log('[AgentSshTerminal] mounted', { execId })" + le

# Find the first occurrence (after the header writeln)
idx = content.find(old1)
if idx >= 0:
    content = content[:idx] + new1 + content[idx+len(old1):]
    changes += 1
    print("Added mount log")
else:
    print("WARNING: Could not find header line end")

# 2. Add log in SSH_EXEC_OUTPUT handler
old2 = (b"    // Listen for SSH exec output events matching this execId" + le +
        b"    const outputCleanup = ipcClient.on(IPC.SSH_EXEC_OUTPUT, (payload) => {" + le +
        b"      const event = payload as SshExecOutputEvent" + le +
        b"      if (event.execId !== execId || !event.data) return" + le)

new2 = (b"    // Listen for SSH exec output events matching this execId" + le +
        b"    const outputCleanup = ipcClient.on(IPC.SSH_EXEC_OUTPUT, (payload) => {" + le +
        b"      const event = payload as SshExecOutputEvent" + le +
        b"      console.log('[AgentSshTerminal] SSH_EXEC_OUTPUT', { eventExecId: event.execId, tabExecId: execId, match: event.execId === execId, hasData: Boolean(event.data), stream: event.stream })" + le +
        b"      if (event.execId !== execId || !event.data) return" + le)

if old2 in content:
    content = content.replace(old2, new2, 1)
    changes += 1
    print("Added output handler log")
else:
    print("WARNING: Could not find output handler")

if changes == 0:
    print("ERROR: No changes made")
    sys.exit(1)

with open(filepath, 'wb') as f:
    f.write(content)

print(f"Successfully added logging ({changes} changes)")
