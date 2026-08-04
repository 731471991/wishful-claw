#!/usr/bin/env python3
"""Patch RightPanel.tsx to add workbench tab rendering."""

FILE = r'src/renderer/src/components/layout/RightPanel.tsx'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

changes = []

# 1. Add import for WorkbenchPanel
old_import = "from './SessionChangeReviewPanel'"
new_import = "from './SessionChangeReviewPanel'\nimport { WorkbenchPanel } from './WorkbenchPanel'"
if old_import in content:
    content = content.replace(old_import, new_import)
    changes.append('import: OK')
else:
    changes.append('import: NOT FOUND')

# 2. Add workbench tab title in tabs useMemo
old_title = """      if (tab.kind === 'browser') {
        return { ...tab, title: t('rightPanel.browser', { defaultValue: 'Browser' }) }
      }"""
new_title = """      if (tab.kind === 'browser') {
        return { ...tab, title: t('rightPanel.browser', { defaultValue: 'Browser' }) }
      }
      if (tab.kind === 'workbench') {
        return { ...tab, title: t('rightPanel.workbench', { defaultValue: 'Workbench' }) }
      }"""
if old_title in content:
    content = content.replace(old_title, new_title)
    changes.append('title: OK')
else:
    changes.append('title: NOT FOUND')

# 3. Add workbench rendering in renderActivePanel
old_render = "    if (tab.kind === 'review') return <SessionChangeReviewPanel sessionId={tab.sessionId ?? panelSessionId} />"
new_render = """    if (tab.kind === 'review') return <SessionChangeReviewPanel sessionId={tab.sessionId ?? panelSessionId} />
    if (tab.kind === 'workbench') return <WorkbenchPanel sessionId={tab.sessionId ?? panelSessionId} />"""
if old_render in content:
    content = content.replace(old_render, new_render)
    changes.append('render: OK')
else:
    changes.append('render: NOT FOUND')

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

for c in changes:
    print(c)
