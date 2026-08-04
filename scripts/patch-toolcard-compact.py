#!/usr/bin/env python3
"""Patch ToolCallCard/index.tsx to add compact mode support."""

FILE = r'src/renderer/src/components/chat/ToolCallCard/index.tsx'

with open(FILE, 'r', encoding='utf-8') as f:
    content = f.read()

changes = []

# 1. Add mode to destructuring (default 'full')
old_destructure = """  toolUseId,
  name,
  input,
  output,
  status,
  error,
  startedAt,
  completedAt,
  forceOpen = false
}: ToolCallCardProps): React.JSX.Element {"""
new_destructure = """  toolUseId,
  name,
  input,
  output,
  status,
  error,
  startedAt,
  completedAt,
  forceOpen = false,
  mode = 'full'
}: ToolCallCardProps): React.JSX.Element {
  const isCompact = mode === 'compact'"""

if old_destructure in content:
    content = content.replace(old_destructure, new_destructure)
    changes.append('destructure: OK')
else:
    changes.append('destructure: NOT FOUND')

# 2. In compact mode, make toggleOpen a no-op
old_toggle = """  const toggleOpen = React.useCallback(() => {
    if (forceOpen) return
    if (isLiveCommandTool) return"""
new_toggle = """  const toggleOpen = React.useCallback(() => {
    if (forceOpen || isCompact) return
    if (isLiveCommandTool) return"""

if old_toggle in content:
    content = content.replace(old_toggle, new_toggle)
    changes.append('toggleOpen: OK')
else:
    changes.append('toggleOpen: NOT FOUND')

# 3. Wrap CollapsibleHeightPanel in condition
old_panel = "      <CollapsibleHeightPanel\n        open={open}"
new_panel = "      {!isCompact && (\n      <CollapsibleHeightPanel\n        open={open}"

if old_panel in content:
    content = content.replace(old_panel, new_panel, 1)
    changes.append('panel-open: OK')
else:
    changes.append('panel-open: NOT FOUND')

# Close the condition after CollapsibleHeightPanel
old_close = """      </CollapsibleHeightPanel>
    </div>
  )
}

export const ToolCallCard"""
new_close = """      </CollapsibleHeightPanel>
      )}
    </div>
  )
}

export const ToolCallCard"""

if old_close in content:
    content = content.replace(old_close, new_close)
    changes.append('panel-close: OK')
else:
    changes.append('panel-close: NOT FOUND')

with open(FILE, 'w', encoding='utf-8') as f:
    f.write(content)

for c in changes:
    print(c)
