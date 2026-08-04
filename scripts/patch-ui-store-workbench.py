#!/usr/bin/env python3
"""Patch ui-store-interface.ts and ui-store.ts to add ensureWorkbenchTab."""

FILE1 = r'src/renderer/src/stores/ui-store-interface.ts'
with open(FILE1, 'r', encoding='utf-8') as f:
    content = f.read()
old = "  ensureTerminalTab: () => void\n"
new = "  ensureTerminalTab: () => void\n  ensureWorkbenchTab: (sessionId?: string | null) => void\n"
if old in content:
    content = content.replace(old, new)
    with open(FILE1, 'w', encoding='utf-8') as f:
        f.write(content)
    print('interface: Done')
else:
    print('interface: NOT FOUND')

FILE2 = r'src/renderer/src/stores/ui-store.ts'
with open(FILE2, 'r', encoding='utf-8') as f:
    content = f.read()

old_impl = "  ensureTerminalTab: () => set((state: any) => {"
new_impl = (
    "  ensureWorkbenchTab: (sessionId: any) =>\n"
    "    set((state: any) => {\n"
    "      const existing = state.rightPanelTabs.find((tab: any) => tab.kind === 'workbench')\n"
    "      if (existing) {\n"
    "        if (sessionId && existing.sessionId !== sessionId) {\n"
    "          const rightPanelTabs = state.rightPanelTabs.map((tab: any) =>\n"
    "            tab.id === existing.id ? { ...tab, sessionId } : tab\n"
    "          )\n"
    "          return { rightPanelTabs }\n"
    "        }\n"
    "        return {}\n"
    "      }\n"
    "      const tab: RightPanelTabInstance = {\n"
    "        id: 'workbench',\n"
    "        kind: 'workbench',\n"
    "        title: 'Workbench',\n"
    "        closable: true,\n"
    "        sessionId: sessionId ?? null,\n"
    "      }\n"
    "      return {\n"
    "        rightPanelTabs: ensureRightPanelTabs([...state.rightPanelTabs, tab]),\n"
    "      }\n"
    "    }),\n"
    "  ensureTerminalTab: () => set((state: any) => {"
)

if old_impl in content:
    content = content.replace(old_impl, new_impl)
    with open(FILE2, 'w', encoding='utf-8') as f:
        f.write(content)
    print('store impl: Done')
else:
    print('store impl: NOT FOUND')
