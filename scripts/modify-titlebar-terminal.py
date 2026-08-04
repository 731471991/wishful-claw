"""Modify TitleBar.tsx to use bottom terminal dock instead of right panel terminal."""
import sys

filepath = r'D:\claw\wishful-claw\src\renderer\src\components\layout\TitleBar.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

# 1. Replace ensureTerminalTab with bottom terminal dock
old1 = b"  const ensureFilesTab = useUIStore((s) => s.ensureFilesTab)\r\n  const ensureTerminalTab = useUIStore((s) => s.ensureTerminalTab)\r\n\r\n  // Only show file/terminal buttons in project-level sessions (has workingFolder)\r\n  const hasProject = useChatStore((s) => {\r\n    const session = s.sessions.find((item) => item.id === s.activeSessionId)\r\n    if (session?.workingFolder) return true\r\n    // Inherit from project if session doesn't have its own workingFolder\r\n    if (session?.projectId) {\r\n      const project = s.projects.find((p) => p.id === session.projectId)\r\n      return Boolean(project?.workingFolder)\r\n    }\r\n    return false\r\n  })"

new1 = b"  const ensureFilesTab = useUIStore((s) => s.ensureFilesTab)\r\n  const toggleBottomTerminalDock = useUIStore((s) => s.toggleBottomTerminalDock)\r\n\r\n  // Get current project ID and terminal dock state\r\n  const currentProjectId = useChatStore((s) => {\r\n    const session = s.sessions.find((item) => item.id === s.activeSessionId)\r\n    return session?.projectId ?? null\r\n  })\r\n  const bottomTerminalDockOpen = useUIStore((s) =>\r\n    currentProjectId ? Boolean(s.bottomTerminalDockOpenByProjectId[currentProjectId]) : false\r\n  )\r\n\r\n  // Only show file/terminal buttons in project-level sessions (has workingFolder)\r\n  const hasProject = useChatStore((s) => {\r\n    const session = s.sessions.find((item) => item.id === s.activeSessionId)\r\n    if (session?.workingFolder) return true\r\n    // Inherit from project if session doesn't have its own workingFolder\r\n    if (session?.projectId) {\r\n      const project = s.projects.find((p) => p.id === session.projectId)\r\n      return Boolean(project?.workingFolder) || Boolean(project?.sshConnectionId)\r\n    }\r\n    return false\r\n  })"

if old1 not in content:
    print("ERROR: Could not find block 1 in TitleBar.tsx")
    # Try with LF
    old1_lf = old1.replace(b'\r\n', b'\n')
    new1_lf = new1.replace(b'\r\n', b'\n')
    if old1_lf in content:
        content = content.replace(old1_lf, new1_lf, 1)
        print("Block 1 replaced (LF)")
    else:
        print("Could not find block 1 at all")
        sys.exit(1)
else:
    content = content.replace(old1, new1, 1)
    print("Block 1 replaced (CRLF)")

# 2. Replace the terminal button click handler and styling
old2 = b"                <button\r\n                  onClick={() => ensureTerminalTab()}\r\n                  className=\"titlebar-no-drag flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground\"\r\n                >\r\n                  <SquareTerminal className=\"size-4\" />\r\n                </button>"

new2 = b"                <button\r\n                  onClick={() => currentProjectId && toggleBottomTerminalDock(currentProjectId)}\r\n                  className={`titlebar-no-drag flex size-7 items-center justify-center rounded-md transition-colors ${bottomTerminalDockOpen ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}\r\n                >\r\n                  <SquareTerminal className=\"size-4\" />\r\n                </button>"

if old2 not in content:
    old2_lf = old2.replace(b'\r\n', b'\n')
    new2_lf = new2.replace(b'\r\n', b'\n')
    if old2_lf in content:
        content = content.replace(old2_lf, new2_lf, 1)
        print("Block 2 replaced (LF)")
    else:
        print("ERROR: Could not find block 2 in TitleBar.tsx")
        sys.exit(1)
else:
    content = content.replace(old2, new2, 1)
    print("Block 2 replaced (CRLF)")

with open(filepath, 'wb') as f:
    f.write(content)

print("Successfully modified TitleBar.tsx")
