#!/usr/bin/env python3
"""Add onCompactClick callback to ToolCallCard for workbench linking."""

# 1. types.ts: add onCompactClick to ToolCallCardProps
FILE1 = r'src/renderer/src/components/chat/ToolCallCard/types.ts'
with open(FILE1, 'r', encoding='utf-8') as f:
    content = f.read()
old = "  mode?: 'compact' | 'full'\n}"
new = "  mode?: 'compact' | 'full'\n  onCompactClick?: () => void\n}"
content = content.replace(old, new)
with open(FILE1, 'w', encoding='utf-8') as f:
    f.write(content)
print('types.ts: Done')

# 2. index.tsx: use onCompactClick in compact mode
FILE2 = r'src/renderer/src/components/chat/ToolCallCard/index.tsx'
with open(FILE2, 'r', encoding='utf-8') as f:
    content = f.read()

old_destructure = "  mode = 'full'\n}: ToolCallCardProps): React.JSX.Element {\n  const isCompact = mode === 'compact'"
new_destructure = "  mode = 'full',\n  onCompactClick\n}: ToolCallCardProps): React.JSX.Element {\n  const isCompact = mode === 'compact'"
content = content.replace(old_destructure, new_destructure)

old_click = "      <button\n        onClick={toggleOpen}"
new_click = "      <button\n        onClick={isCompact && onCompactClick ? onCompactClick : toggleOpen}"
content = content.replace(old_click, new_click)

with open(FILE2, 'w', encoding='utf-8') as f:
    f.write(content)
print('index.tsx: Done')

# 3. tool-block-renderer.tsx: add onCompactClick to props and pass through
FILE3 = r'src/renderer/src/components/cha
