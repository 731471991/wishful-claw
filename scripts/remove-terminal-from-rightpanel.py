"""Remove terminal from RightPanel.tsx"""
import sys

filepath = r'D:\claw\wishful-claw\src\renderer\src\components\layout\RightPanel.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

changes = 0

# 1. Remove TerminalPanel import
old_import = b"import { TerminalPanel } from '@renderer/components/terminal/TerminalPanel'\r\n"
if old_import in content:
    content = content.replace(old_import, b'', 1)
    changes += 1
    print("Removed TerminalPanel import")
else:
    old_import_lf = old_import.replace(b'\r\n', b'\n')
    if old_import_lf in content:
        content = content.replace(old_import_lf, b'', 1)
        changes += 1
        print("Removed TerminalPanel import (LF)")
    else:
        print("WARNING: Could not find TerminalPanel import")

# 2. Remove ensureTerminalTab from store selectors
old_ensure = b"  const ensureTerminalTab = useUIStore((state) => state.ensureTerminalTab)\r\n"
if old_ensure in content:
    content = content.replace(old_ensure, b'', 1)
    changes += 1
    print("Removed ensureTerminalTab selector")
else:
    old_ensure_lf = old_ensure.replace(b'\r\n', b'\n')
    if old_ensure_lf in content:
        content = content.replace(old_ensure_lf, b'', 1)
        changes += 1
        print("Removed ensureTerminalTab selector (LF)")
    else:
        print("WARNING: Could not find ensureTerminalTab selector")

# 3. Remove terminal case in renderActivePanel
old_case = b"    if (tab.kind === 'terminal') return <TerminalPanel />\r\n"
if old_case in content:
    content = content.replace(old_case, b'', 1)
    changes += 1
    print("Removed terminal case in renderActivePanel")
else:
    old_case_lf = old_case.replace(b'\r\n', b'\n')
    if old_case_lf in content:
        content = content.replace(old_case_lf, b'', 1)
        changes += 1
        print("Removed terminal case in renderActivePanel (LF)")
    else:
        print("WARNING: Could not find terminal case in renderActivePanel")

# 4. Remove onAddTerminal prop from RightPanelHeader
old_add = b"              onAddTerminal={() => ensureTerminalTab()}\r\n"
if old_add in content:
    content = content.replace(old_add, b'', 1)
    changes += 1
    print("Removed onAddTerminal prop")
else:
    old_add_lf = old_add.replace(b'\r\n', b'\n')
    if old_add_lf in content:
        content = content.replace(old_add_lf, b'', 1)
        changes += 1
        print("Removed onAddTerminal prop (LF)")
    else:
        print("WARNING: Could not find onAddTerminal prop")

if changes == 0:
    print("ERROR: No changes made to RightPanel.tsx")
    sys.exit(1)

with open(filepath, 'wb') as f:
    f.write(content)

print(f"Successfully modified RightPanel.tsx ({changes} changes)")
