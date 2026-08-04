import sys
filepath = r'D:\claw\wishful-claw\src\renderer\src\components\layout\SessionConversationPane.tsx'
with open(filepath, 'rb') as f:
    content = f.read()
le = b'\r\n' if b'\r\n' in content else b'\n'
old = (b'        {/* Bottom terminal dock */}' + le +
       b'        {bottomTerminalDockOpen && projectId && (' + le +
       b'          <div className="shrink-0 border-t">' + le +
       b'            <BottomTerminalDock' + le +
       b'              projectId={projectId}' + le +
       b'              sessionId={resolvedSessionId}' + le +
       b'              projectName={projectName}' + le +
       b'              workingFolder={projectWorkingFolder ?? null}' + le +
       b'              sshConnectionId={sshConnectionId}' + le +
       b'            />' + le +
       b'          </div>' + le +
       b'        )}')
new = (b'        {/* Bottom terminal dock - keep mounted, hide via CSS to preserve state */}' + le +
       b'        {projectId && (' + le +
       b'          <div className={bottomTerminalDockOpen ? "shrink-0 border-t" : "hidden"}>' + le +
       b'            <BottomTerminalDock' + le +
       b'              projectId={projectId}' + le +
       b'              sessionId={resolvedSessionId}' + le +
       b'              projectName={projectName}' + le +
       b'              workingFolder={projectWorkingFolder ?? null}' + le +
       b'              sshConnectionId={sshConnectionId}' + le +
       b'            />' + le +
       b'          </div>' + le +
       b'        )}')
if old not in content:
    print("ERROR: Could not find dock rendering block")
    sys.exit(1)
content = content.replace(old, new, 1)
with open(filepath, 'wb') as f:
    f.write(content)
print("Done: dock stays mounted, hidden via CSS")
