#!/usr/bin/env python3
"""Patch RightPanel.tsx to add workbench auto-creation."""

FILE = r'src/renderer/src/components/layout/RightPanel.tsx'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

changes = []

# 1. Add useAgentStore import
old_imp = "import { useAppPluginStore } from '@renderer/stores/app-plugin-store'"
new_imp = "import { useAppPluginStore } from '@renderer/stores/app-plugin-store'\nimport { useAgentStore } from '@renderer/stores/agent-store'"
if old_imp in content:
    content = content.replace(old_imp, new_imp)
    changes.append('import: OK')
else:
    changes.append('import: NOT FOUND')

# 2. Add useEffect to auto-create workbench tab when tools are running
old_hook = "  const ensureBrowserTab = useUIStore((state) => state.ensureBrowserTab)"
new_hook = (
    "  const ensureBrowserTab = useUIStore((state) => state.ensureBrowserTab)\n"
    "  const ensureWorkbenchTab = useUIStore((state) => state.ensureWorkbenchTab)\n"
    "\n"
    "  // Auto-create workbench tab when this session has tool calls\n"
    "  const sessionToolCallCount = useAgentStore((s) => {\n"
    "    if (!panelSessionId) return 0\n"
    "    const cache = s.sessionToolCallsCache[panelSessionId]\n"
    "    if (cache) return cache.pending.length + cache.executed.length\n"
    "    return s.pendingToolCalls.filter(tc => tc.sessionId === panelSessionId).length +\n"
    "           s.executedToolCalls.filter(tc => tc.sessionId === panelSessionId).length\n"
    "  })\n"
    "\n"
    "  useEffect(() => {\n"
    "    if (sessionToolCallCount > 0) {\n"
    "      ensureWorkbenchTab(panelSessionId)\n"
    "    }\n"
    "  }, [sessionToolCallCount, panelSessionId, ensureWorkbenchTab])"
)
if old_hook in content:
    content = content.replace(old_hook, new_hook)
    changes.append('hook: OK')
else:
    changes.append('hook: NOT FOUND')

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

for c in changes:
    print(c)
