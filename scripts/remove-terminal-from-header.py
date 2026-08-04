"""Remove terminal from RightPanelHeader.tsx"""
import sys

filepath = r'D:\claw\wishful-claw\src\renderer\src\components\layout\RightPanelHeader.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

changes = 0

# 1. Remove onAddTerminal from interface (CRLF)
old1 = b"  onAddTerminal: () => void\r\n"
new1 = b""
if old1 in content:
    content = content.replace(old1, new1, 1)
    changes += 1
    print("Removed onAddTerminal from interface")
else:
    old1_lf = old1.replace(b'\r\n', b'\n')
    if old1_lf in content:
        content = content.replace(old1_lf, new1.replace(b'\r\n', b'\n'), 1)
        changes += 1
        print("Removed onAddTerminal from interface (LF)")
    else:
        print("WARNING: Could not find onAddTerminal in interface")

# 2. Remove onAddTerminal from function params
old2 = b"  onAddTerminal,\r\n"
new2 = b""
if old2 in content:
    content = content.replace(old2, new2, 1)
    changes += 1
    print("Removed onAddTerminal from function params")
else:
    old2_lf = old2.replace(b'\r\n', b'\n')
    if old2_lf in content:
        content = content.replace(old2_lf, b'', 1)
        changes += 1
        print("Removed onAddTerminal from function params (LF)")
    else:
        print("WARNING: Could not find onAddTerminal in function params")

# 3. Remove the terminal DropdownMenuItem
old3 = b"          <DropdownMenuItem onSelect={onAddTerminal}>\r\n            <SquareTerminal className=\"size-4\" />\r\n            {t('rightPanel.terminal', { defaultValue: 'Terminal' })}\r\n          </DropdownMenuItem>\r\n"
new3 = b""
if old3 in content:
    content = content.replace(old3, new3, 1)
    changes += 1
    print("Removed terminal DropdownMenuItem")
else:
    old3_lf = old3.replace(b'\r\n', b'\n')
    if old3_lf in content:
        content = content.replace(old3_lf, b'', 1)
        changes += 1
        print("Removed terminal DropdownMenuItem (LF)")
    else:
        print("WARNING: Could not find terminal DropdownMenuItem")

# 4. Also remove SquareTerminal import if no longer used
if b'SquareTerminal' not in content.replace(b'SquareTerminal', b'', 99):  # Check if still used
    pass  # Keep import for now, unused import won't cause build error with tsc

if changes == 0:
    print("ERROR: No changes made to RightPanelHeader.tsx")
    sys.exit(1)

with open(filepath, 'wb') as f:
    f.write(content)

print(f"Successfully modified RightPanelHeader.tsx ({changes} changes)")
