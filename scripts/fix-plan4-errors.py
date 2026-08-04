#!/usr/bin/env python3
"""Fix compilation errors in RightPanel, WorkbenchPanel, ui-store."""

import re

# ── Fix 1: RightPanel — move workbench hook after panelSessionId declaration ──

FILE1 = r'src/renderer/src/components/layout/RightPanel.tsx'
with open(FILE1, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the misplaced hook block (it's between ensureBrowserTab and panelSessionId)
old_hook = """  const ensureBrowserTab = useUIStore((state) => state.ensureBrowserTab)
  const ensureWorkbenchTab = useUIStore((state) => state.ensureWorkbenchTab)

  // Auto-create workbench tab when this session has tool calls
  const sessionToolCallCount = useAgentStore((s) => {
    if (!panelSessionId) return 0
    const cache = s.sessionToolCallsCache[panelSessionId]
    if (cache) return cache.pending.length + cache.executed.length
    return s.pendingToolCalls.filter(tc => tc.sessionId === panelSessionId).length +
           s.executedToolCalls.filter(tc => tc.sessionId === panelSessionId).length
  })

  useEffect(() => {
    if (sessionToolCallCount > 0) {
      ensureWorkbenchTab(panelSessionId)
    }
  }, [sessionToolCallCount, panelSessionId, ensureWorkbenchTab])"""

new_hook = "  const ensureBrowserTab = useUIStore((state) => state.ensureBrowserTab)"

if old_hook in content:
    content = content.replace(old_hook, new_hook)
    print('RightPanel: removed misplaced hook')

# Add the hook after panelSessionId declaration
old_panel = "  const panelSessionId = activeScopedSessionId ?? activeSessionId ?? null"
new_panel = """  const panelSessionId = activeScopedSessionId ?? activeSessionId ?? null
  const ensureWorkbenchTab = useUIStore((state) => state.ensureWorkbenchTab)

  // Auto-create workbench tab when this session has tool calls
  const sessionToolCallCount = useAgentStore((s) => {
    if (!panelSessionId) return 0
    const cache = s.sessionToolCallsCache[panelSessionId]
    if (cache) return cache.pending.length + cache.executed.length
    return s.pendingToolCalls.filter(tc => tc.sessionId === panelSessionId).length +
           s.executedToolCalls.filter(tc => tc.sessionId === panelSessionId).length
  })

  useEffect(() => {
    if (sessionToolCallCount > 0) {
      ensureWorkbenchTab(panelSessionId)
    }
  }, [sessionToolCallCount, panelSessionId, ensureWorkbenchTab])"""

if old_panel in content:
    content = content.replace(old_panel, new_panel)
    print('RightPanel: added hook after panelSessionId')

with open(FILE1, 'w', encoding='utf-8') as f:
    f.write(content)

# ── Fix 2: WorkbenchPanel — remove ScrollArea, use plain div ──

FILE2 = r'src/renderer/src/components/layout/WorkbenchPanel.tsx'
with open(FILE2, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "import { ScrollArea } from '@renderer/components/ui/scroll-area'",
    ""
)
content = content.replace(
    "import { cn } from '@renderer/lib/utils'",
    ""
)
content = content.replace(
    '    <ScrollArea className={cn(\'h-full\')}>\n      <div className="space-y-2 p-2">',
    '    <div className="h-full overflow-y-auto">\n      <div className="space-y-2 p-2">'
)
content = content.replace(
    '    </ScrollArea>',
    '    </div>'
)

with open(FILE2, 'w', encoding='utf-8') as f:
    f.write(content)
print('WorkbenchPanel: removed ScrollArea')

# ── Fix 3: ui-store — add createdAt to workbench tab ──

FILE3 = r'src/renderer/src/stores/ui-store.ts'
with open(FILE3, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    "        sessionId: sessionId ?? null,\n      }\n      return {\n        rightPanelTabs: ensureRightPanelTabs([...state.rightPanelTabs, tab]),",
    "        sessionId: sessionId ?? null,\n        createdAt: Date.now(),\n      }\n      return {\n        rightPanelTabs: ensureRightPanelTabs([...state.rightPanelTabs, tab]),"
)

with open(FILE3, 'w', encoding='utf-8') as f:
    f.write(content)
print('ui-store: added createdAt')
