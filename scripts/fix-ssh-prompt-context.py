"""Fix BuildProjectContext SSH hint in PromptBuilder.cs"""
import sys

filepath = r'D:\claw\wishful-claw\src\runtime\WishfulClaw.Persona\PromptBuilder.cs'

with open(filepath, 'rb') as f:
    content = f.read()

le = b'\r\n' if b'\r\n' in content else b'\n'

old = (b'This is a remote path on the SSH server. All Bash commands default to this directory. '
       b'Use SSH file tools (not local file tools) to read or write files on the remote server.')

new = (b'This is a remote path on the SSH server. All Bash commands default to this directory. '
       b'Use Bash (not LS/Read/Write) for file operations on the remote server '
       b'\xe2\x80\x94 local file tools cannot access it.')

# Try both with and without line endings
for line_ending in [le, b'\n']:
    old_full = old.replace(b'\n', line_ending) if b'\n' in old else old
    new_full = new.replace(b'\n', line_ending) if b'\n' in new else new
    if old_full in content:
        content = content.replace(old_full, new_full, 1)
        with open(filepath, 'wb') as f:
            f.write(content)
        print("Successfully updated BuildProjectContext SSH hint")
        sys.exit(0)

# Also try just the raw text
if old in content:
    content = content.replace(old, new, 1)
    with open(filepath, 'wb') as f:
        f.write(content)
    print("Successfully updated BuildProjectContext SSH hint (raw)")
    sys.exit(0)

print("ERROR: Could not find the target text")
# Debug
idx = content.find(b'Use SSH file tools')
if idx >= 0:
    print(f"Found 'Use SSH file tools' at index {idx}")
    print(f"Context: {content[idx-80:idx+120]}")
sys.exit(1)
