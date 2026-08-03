"""Fix TerminalPanel.tsx ssh-agent tab redundant rendering"""
import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\renderer\src\components\terminal\TerminalPanel.tsx")
text = p.read_text(encoding="utf-8")

old = """              {tab.kind === 'ssh-agent' ? (
                tab.status === 'running' ? (
                  <Suspense fallback={null}>
                    <AgentSshTerminal execId={tab.execId ?? tab.id} />
                  </Suspense>
                ) : (
                  <Suspense fallback={null}>
                    <AgentSshTerminal execId={tab.execId ?? tab.id} />
                  </Suspense>
                )
              ) : tab.status === 'running' ? ("""

new = """              {tab.kind === 'ssh-agent' ? (
                <Suspense fallback={null}>
                  <AgentSshTerminal execId={tab.execId ?? tab.id} />
                </Suspense>
              ) : tab.status === 'running' ? ("""

if old in text:
    text = text.replace(old, new)
    p.write_text(text, encoding="utf-8")
    print("OK (LF)")
elif old.replace("\n", "\r\n") in text:
    text = text.replace(old.replace("\n", "\r\n"), new.replace("\n", "\r\n"))
    p.write_text(text, encoding="utf-8")
    print("OK (CRLF)")
else:
    print("NOT FOUND")
