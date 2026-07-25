"""
Reliable split of PreviewPanel.tsx:
1. Extract utility functions to preview-utils.ts (already done, redo from clean)
2. Extract save logic to use-preview-save.ts (already done, redo from clean)
3. Extract toolbar JSX to preview-toolbar.tsx
The goal is to get PreviewPanel.tsx under 500 lines.
"""
import pathlib
import re

p = pathlib.Path('src/renderer/src/components/layout/PreviewPanel.tsx')
raw = p.read_bytes()
if raw.startswith(b'\xef\xbb\xbf'):
    raw = raw[3:]
text = raw.decode('utf-8').replace('\r\n', '\n').replace('\r', '\n')

# --- Step 1: Extract utility functions ---
# Match from "function fileName" to just before "export function PreviewPanel"
utils_match = re.search(r'(function fileName.*?)(export function PreviewPanel)', text, re.DOTALL)
if not utils_match:
    print("ERROR: Could not find utility functions")
    exit(1)

utils_text = utils_match.group(1).rstrip('\n')
# Remove the lazy import line if it's in there
# Actually the lazy import is before the functions

utils_content = """// Utility functions and helpers for PreviewPanel

import type React from 'react'
import { Bot, File, FileDiff, Globe } from 'lucide-react'
import type { PreviewPanelTab } from '@renderer/stores/preview-panel-helpers'

""" + utils_text + '\n'

pathlib.Path('src/renderer/src/components/layout/preview-utils.ts').write_text(
    utils_content, encoding='utf-8'
)

# --- Step 2: Extract save logic to use-preview-save.ts ---
save_match = re.search(
    r'(  const saveTab = async.*?)(  const handleSave = async.*?)(\n  const handleSaveDialogOpenChange)',
    text, re.DOTALL
)
if not save_match:
    print("ERROR: Could not find saveTab")
    exit(1)

save_tab_fn = save_match.group(1).rstrip()
handle_save_fn = save_match.group(2).rstrip()

hook_content = """// Save logic extracted from PreviewPanel to keep it under 500 lines

import type { PreviewPanelTab } from '@renderer/stores/preview-panel-helpers'
import { useUIStore } from '@renderer/stores/ui-store'
import { useGitStore } from '@renderer/stores/git-store'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'

interface UsePreviewSaveOptions {
  activeTab: PreviewPanelTab | null
  content: string
  setContent: (value: string) => void
}

export function usePreviewSave({ activeTab, content, setContent }: UsePreviewSaveOptions) {
  const updatePreviewTab = useUIStore((s) => s.updatePreviewTab)

""" + save_tab_fn + '\n\n' + handle_save_fn + '\n\n  return { saveTab, handleSave }\n}\n'

pathlib.Path('src/renderer/src/components/layout/use-preview-save.ts').write_text(
    hook_content, encoding='utf-8'
)

# --- Step 3: Build new PreviewPanel.tsx ---
# Replace utility functions with import
new_text = text[:utils_match.start()] + text[utils_match.start(2):]

# Replace saveTab + handleSave with hook call
# Find the save block in new_text
save_block = save_tab_fn + '\n\n' + handle_save_fn + '\n'
hook_call = "  const { saveTab, handleSave } = usePreviewSave({ activeTab, content, setContent })\n"

new_text = new_text.replace(save_block, hook_call)

# Add imports for new modules
# Find the last import line
import_lines = []
for line in new_text.split('\n'):
    if line.startswith('import '):
        import_lines.append(line)

last_import = import_lines[-1] if import_lines else ''
new_text = new_text.replace(
    last_import,
    last_import + "\nimport {\n  fileName,\n  relativePath,\n  breadcrumbParts,\n  fileExtension,\n  isExternalUrl,\n  shouldReadPreviewText,\n  tabTitle,\n  tabPathTitle,\n  TabIcon\n} from './preview-utils'\nimport { usePreviewSave } from './use-preview-save'"
)

# Also remove now-unused imports that moved to preview-utils
# (Bot, File, FileDiff, Globe are used by TabIcon which moved)
# Check if they're still used in the main file
for icon in ['Bot', 'File ', 'FileDiff', 'Globe']:
    # Don't remove if still used in JSX
    pass  # Let's not touch imports for now, tsc will tell us

# Write with BOM + CRLF
new_text = new_text.replace('\r\n', '\n').replace('\r', '\n')
new_text = new_text.replace('\n', '\r\n')
if not new_text.startswith('\ufeff'):
    new_text = '\ufeff' + new_text
p.write_bytes(new_text.encode('utf-8'))

# Count lines
import subprocess
for name in ['PreviewPanel.tsx', 'preview-utils.ts', 'use-preview-save.ts']:
    path = f'src/renderer/src/components/layout/{name}'
    result = subprocess.run(['wc', '-l', path], capture_output=True, text=True)
    print(f"  {result.stdout.strip()}")

print("Done!")
