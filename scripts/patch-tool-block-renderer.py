#!/usr/bin/env python3
"""Patch tool-block-renderer.tsx to pass mode through to ToolCallCard."""

FILE = r'src/renderer/src/components/chat/AssistantMessage/tool-block-renderer.tsx'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

changes = []

# 1. Add mode to ToolBlockRendererProps
old_props = "  trackedChangeByToolUseId: Map<string, AgentRunFileChange>\n  t: TFunction\n}"
new_props = "  trackedChangeByToolUseId: Map<string, AgentRunFileChange>\n  mode?: 'compact' | 'full'\n  t: TFunction\n}"
if old_props in content:
    content = content.replace(old_props, new_props)
    changes.append('props: OK')
else:
    changes.append('props: NOT FOUND')

# 2. Add mode to destructuring
old_destructure = """  sessionId,
  trackedChangeByToolUseId,
}: ToolBlockRendererProps): React.JSX.Element | null {"""
new_destructure = """  sessionId,
  trackedChangeByToolUseId,
  mode,
}: ToolBlockRendererProps): React.JSX.Element | null {"""
if old_destructure in content:
    content = content.replace(old_destructure, new_destructure)
    changes.append('destructure: OK')
else:
    changes.append('destructure: NOT FOUND')

# 3. Add mode to all ToolCallCard calls (3 places, each ends with forceOpen=...)
old_force = "          forceOpen={executionItem?.forceExpanded}\n        />"
new_force = "          forceOpen={executionItem?.forceExpanded}\n          mode={mode}\n        />"
count = content.count(old_force)
content = content.replace(old_force, new_force)
changes.append(f'ToolCallCard calls: {count} replaced')

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

for c in changes:
    print(c)
