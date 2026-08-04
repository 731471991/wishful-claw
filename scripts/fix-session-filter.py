"""Fix: local terminals also filter by session, not project."""
import sys

filepath = r'D:\claw\wishful-claw\src\renderer\src\components\terminal\BottomTerminalDock.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

le = b'\r\n' if b'\r\n' in content else b'\n'

old = (
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

new = (
    b'  // Filter tabs by session' + le +
    b'  const sessionTabs = useMemo(' + le +
    b'    () => allTabs.filter((tab) => tab.sessionId === sessionId),' + le +
    b'    [allTabs, sessionId]' + le +
    b'  )'
)

if old not in content:
    print("ERROR: Could not find filter block")
    sys.exit(1)

content = content.replace(old, new, 1)

# Also replace all remaining references to `projectTabs` with `sessionTabs`
content = content.replace(b'projectTabs', b'sessionTabs')

with open(filepath, 'wb') as f:
    f.write(content)

print("Done: all tabs now filter by session")
