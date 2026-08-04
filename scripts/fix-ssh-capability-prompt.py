"""Fix ssh_capability block in PromptBuilder.cs"""
import sys

filepath = r'D:\claw\wishful-claw\src\runtime\WishfulClaw.Persona\PromptBuilder.cs'

with open(filepath, 'rb') as f:
    content = f.read()

le = b'\r\n' if b'\r\n' in content else b'\n'

# Old ssh_capability block for SSH projects
old_lines = [
    b'<ssh_capability>',
    b'**Current project is a remote SSH project.**',
    b'- SSH connection ID: `{sshConnectionId}`{cwdLine}',
    b'- All Bash/Shell commands you execute will automatically run on the remote server via this SSH connection. You do NOT need to manually pass `sshConnectionId` in tool calls \xe2\x80\x94 the system routes them automatically.',
    b'- The working folder above is a **remote path** on the SSH server, not a local path. Do not attempt to read it with local file tools.',
    b'- Use `SshListConnections` if you need to inspect available connections.',
    b'- Real-time command output is displayed in the terminal panel for the user to observe.',
    b'</ssh_capability>',
]

# New lines
new_lines = [
    b'<ssh_capability>',
    b'**Current project is a remote SSH project.**',
    b'- SSH connection ID: `{sshConnectionId}`{cwdLine}',
    b'- **Bash/Shell** commands run on the remote server automatically \xe2\x80\x94 no need to pass `sshConnectionId` manually.',
    b'- **Important: LS, Read, Write, Edit tools operate on your LOCAL filesystem, NOT the remote SSH server.** They cannot access remote files.',
    b'- To work with files on the remote server, use Bash commands: `ls`, `cat`, `head`, `tail`, `find`, `grep`, `cp`, `mkdir`, `rm`, `sed`, `echo > file`, etc.',
    b'- The working folder `{workingFolder}` is a remote path. Use `cd {workingFolder} && <command>` or rely on the default cwd.',
    b'- Use `SshListConnections` if you need to inspect available connections.',
    b'- Real-time command output is displayed in the terminal panel for the user to observe.',
    b'</ssh_capability>',
]

old_text = le.join(old_lines)
new_text = le.join(new_lines)

# The content in the file might have slightly different formatting
# Let's try to find a unique substring
search = b'- All Bash/Shell commands you execute will automatically run on the remote server'
if search not in content:
    print("Searching for alternative text...")
    search2 = b'All Bash/Shell commands you execute will automatically'
    if search2 not in content:
        print("ERROR: Cannot find the old ssh_capability text")
        # Debug
        idx = content.find(b'ssh_capability')
        while idx >= 0:
            print(f"Found 'ssh_capability' at index {idx}")
            print(f"Context: {content[idx:idx+500]}")
            idx = content.find(b'ssh_capability', idx+1)
        sys.exit(1)

# Replace the entire block between <ssh_capability> and </ssh_capability>
# that contains the "All Bash/Shell" line
start_marker = b'<ssh_capability>'
end_marker = b'</ssh_capability>'

# Find the second occurrence (first is for non-SSH projects)
first_idx = content.find(start_marker)
second_idx = content.find(start_marker, first_idx + 1)

if second_idx < 0:
    print("ERROR: Could not find second <ssh_capability> block")
    sys.exit(1)

end_idx = content.find(end_marker, second_idx)
if end_idx < 0:
    print("ERROR: Could not find </ssh_capability> after second block")
    sys.exit(1)

end_idx += len(end_marker)

# Replace the block
old_block = content[second_idx:end_idx]
new_block = new_text

content = content[:second_idx] + new_block + content[end_idx:]

with open(filepath, 'wb') as f:
    f.write(content)

print("Successfully updated ssh_capability block for SSH projects")
