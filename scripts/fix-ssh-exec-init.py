"""Add initializeSshRepository() call before ssh:exec in reverse handlers."""
import sys

filepath = r'D:\claw\wishful-claw\src\main\ipc\reverse-handlers\index.ts'

with open(filepath, 'rb') as f:
    content = f.read()

le = b'\r\n' if b'\r\n' in content else b'\n'

old = (b"    if (!connectionId || !command) {" + le +
       b"      return { success: false, exitCode: 1, stdout: '', stderr: 'connectionId and command are required', error: 'connectionId and command are required' }" + le +
       b"    }" + le +
       b"    return await execSshCommand(connectionId, command, timeoutMs ?? 60_000, (chunk) => {")

new = (b"    if (!connectionId || !command) {" + le +
       b"      return { success: false, exitCode: 1, stdout: '', stderr: 'connectionId and command are required', error: 'connectionId and command are required' }" + le +
       b"    }" + le +
       b"    // Ensure SSH repository is initialized - cache might be empty" + le +
       b"    // if the app just started and no SSH UI has been used yet." + le +
       b"    await initializeSshRepository()" + le +
       b"    return await execSshCommand(connectionId, command, timeoutMs ?? 60_000, (chunk) => {")

if old in content:
    content = content.replace(old, new, 1)
    with open(filepath, 'wb') as f:
        f.write(content)
    print("Successfully added initializeSshRepository() call to ssh:exec handler")
else:
    print("ERROR: Could not find target text")
    idx = content.find(b'execSshCommand')
    if idx >= 0:
        start = max(0, idx - 200)
        end = min(len(content), idx + 100)
        print(f"Context: {content[start:end]}")
    sys.exit(1)
