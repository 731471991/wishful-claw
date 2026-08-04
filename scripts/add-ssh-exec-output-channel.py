"""Add 'ssh:exec-output' to MESSAGEPACK_EVENT_CHANNELS set."""
import sys

filepath = r'D:\claw\wishful-claw\src\renderer\src\lib\ipc\messagepack-channel-routing.ts'

with open(filepath, 'rb') as f:
    content = f.read()

# Find the line 'ssh:output' and add 'ssh:exec-output' after it
target = b"  'ssh:output',\r\n"
replacement = b"  'ssh:output',\r\n  'ssh:exec-output',\r\n"

if target in content:
    content = content.replace(target, replacement, 1)
    with open(filepath, 'wb') as f:
        f.write(content)
    print("Successfully added 'ssh:exec-output' to MESSAGEPACK_EVENT_CHANNELS")
else:
    # Try without \r\n
    target2 = b"  'ssh:output',\n"
    replacement2 = b"  'ssh:output',\n  'ssh:exec-output',\n"
    if target2 in content:
        content = content.replace(target2, replacement2, 1)
        with open(filepath, 'wb') as f:
            f.write(content)
        print("Successfully added 'ssh:exec-output' to MESSAGEPACK_EVENT_CHANNELS (LF)")
    else:
        print("ERROR: Could not find 'ssh:output' in file")
        sys.exit(1)
