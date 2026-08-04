"""Add sessionId prop to BottomTerminalDock.tsx"""
import sys

filepath = r'D:\claw\wishful-claw\src\renderer\src\components\terminal\BottomTerminalDock.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

le = b'\r\n' if b'\r\n' in content else b'\n'

# 1. Add sessionId to interface and function params
old1 = (
    b'export interface BottomTerminalDockProps {' + le +
    b'  projectId: string' + le +
    b'  projectName?: string | null' + le +
    b'  workingFolder?: string | null' + le +
    b'  sshConnectionId?: string | null' + le +
    b'}' + le +
    le +
    b'export function BottomTerminalDock({' + le +
    b'  projectId,' + le +
    b'  projectName,' + le +
    b'  workingFolder,' + le +
    b'  sshConnectionId' + le +
    b'}: BottomTerminalDockProps): React.JSX.Element {'
)

new1 = (
    b'export interface BottomTerminalDockProps {' + le +
    b'  projectId: string' + le +
    b'  sessionId?: string | null' + le +
    b'  projectName?: string | null' + le +
    b'  workingFolder?: string | null' + le +
    b'  sshConnectionId?: string | null' + le +
    b'}' + le +
    le +
    b'export function BottomTerminalDock({' + le +
    b'  projectId,' + le +
    b'  sessionId,' + le +
    b'  projectName,' + le +
    b'  workingFolder,' + le +
    b'  sshConnectionId' + le +
    b'}: BottomTerminalDockProps): React.JSX.Element {'
)

if old1 in content:
    content = content.replace(old1, new1, 1)
    print("Step 1: Added sessionId to props")
else:
    print("ERROR: Could not find props block")
    sys.exit(1)

# 2. Update filter logic
old2 = (
    b'  // Filter tabs by project' + le +
    b'  const projectTabs = useMemo(' + le +
    b'    () => allTabs.filter((tab) => tab.projectId === projectId),' + le +
    b'    [allTabs, projectId]' + le +
    b'  )'
)

new2 = (
    b'  // Filter tabs: local terminals by project, agent SSH tabs by session' + le +
    b'  const projectTabs = useMemo(' + le +
    b'    () => allTabs.filter((tab) => {' + le +
    b'      if (tab.kind === \'ssh-agent\') {' + le +
    b'        return tab.sessionId === sessionId' + le +
    b'      }' + le +
    b'      return tab.projectId === projectId' + le +
    b'    }),' + le +
    b'    [allTabs, projectId, sessionId]' + le +
    b'  )'
)

if old2 in content:
    content = content.replace(old2, new2, 1)
    print("Step 2: Updated filter logic")
else:
    print("ERROR: Could not find filter block")
    sys.exit(1)

# 3. Update handleCreate to pass sessionId
old3 = (
    b'    void createTab(workingFolder ?? undefined, projectId, projectName || \'Terminal\')' + le +
    b'  }, [workingFolder, projectId, projectName, createTab])'
)

new3 = (
    b'    void createTab(workingFolder ?? undefined, projectId, projectName || \'Terminal\', sessionId)' + le +
    b'  }, [workingFolder, projectId, projectName, sessionId, createTab])'
)

if old3 in content:
    content = content.replace(old3, new3, 1)
    print("Step 3: Updated handleCreate with sessionId")
else:
    print("WARNING: Could not find handleCreate (might already be updated)")

# 4. Update handleClose to filter by project AND session for agent tabs
old4 = (
    b"      const remaining = useTerminalStore.getState().tabs.filter(" + le +
    b"        (t) => t.projectId === projectId" + le +
    b"      )"
)

new4 = (
    b"      const remaining = useTerminalStore.getState().tabs.filter(" + le +
    b"        (t) => t.kind === 'ssh-agent' ? t.sessionId === sessionId : t.projectId === projectId" + le +
    b"      )"
)

if old4 in content:
    content = content.replace(old4, new4, 1)
    print("Step 4: Updated handleClose filter")
else:
    print("WARNING: Could not find handleClose filter")

with open(filepath, 'wb') as f:
    f.write(content)

print("Successfully updated BottomTerminalDock.tsx")
