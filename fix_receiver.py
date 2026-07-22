import sys

filepath = r'D:\claw\wishful-claw\src\renderer\src\lib\ipc\agent-stream-receiver.ts'
with open(filepath, 'r', encoding='utf-8', newline='') as f:
    content = f.read()

# 1. Add start/stop methods after notifySessionVisibility
old_method = "  notifySessionVisibility(sessionId: string, visible: boolean): void {\r\n    ipcClient.send('agent:session-visibility', { sessionId, visible })\r\n  }\r\n"

bridge = (
    "\r\n"
    "  // wishful-claw compatibility bridge\r\n"
    "  // Our code calls start(callback) with an envelope-level callback,\r\n"
    "  // while OpenCowork API uses attach() + subscribeAll(event-level).\r\n"
    "  private envelopeCallbacks = new Set<(envelope: AgentStreamEnvelope) => void>()\r\n"
    "\r\n"
    "  start(callback: (envelope: AgentStreamEnvelope) => void): void {\r\n"
    "    this.attach()\r\n"
    "    this.envelopeCallbacks.add(callback)\r\n"
    "  }\r\n"
    "\r\n"
    "  stop(): void {\r\n"
    "    this.envelopeCallbacks.clear()\r\n"
    "  }\r\n"
)

new_method = old_method + bridge

if old_method not in content:
    print("FAIL: notifySessionVisibility not found")
    sys.exit(1)

content = content.replace(old_method, new_method, 1)
print("Step 1: added start/stop methods")

# 2. Add envelope callback dispatch in acceptEnvelope
old_dispatch = (
    "    for (const event of envelope.events) {\r\n"
    "      this.dispatch(envelope.runId, envelope.sessionId, event)\r\n"
    "    }\r\n"
    "\r\n"
    "    if (envelope.events.some((e) => e.type === 'loop_end' || e.type === 'error')) {"
)

new_dispatch = (
    "    for (const event of envelope.events) {\r\n"
    "      this.dispatch(envelope.runId, envelope.sessionId, event)\r\n"
    "    }\r\n"
    "\r\n"
    "    // Notify envelope-level callbacks (wishful-claw compatibility)\r\n"
    "    for (const cb of this.envelopeCallbacks) {\r\n"
    "      cb(envelope)\r\n"
    "    }\r\n"
    "\r\n"
    "    if (envelope.events.some((e) => e.type === 'loop_end' || e.type === 'error')) {"
)

if old_dispatch not in content:
    print("FAIL: dispatch block not found")
    sys.exit(1)

content = content.replace(old_dispatch, new_dispatch, 1)
print("Step 2: added envelope callback dispatch")

with open(filepath, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
print("Done - file written")
