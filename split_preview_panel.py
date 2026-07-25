"""Split PreviewPanel.tsx (744 lines) into focused modules:
1. preview-utils.ts — utility functions + TabIcon
2. preview-tab-strip.tsx — tab strip + "+" menu (JSX sub-component)
3. preview-toolbar.tsx — breadcrumb + view mode toggle + action buttons
4. preview-content.tsx — content area (diff/markdown/viewer rendering)
5. PreviewPanel.tsx — main component (orchestration only)
"""
import pathlib

p = pathlib.Path('src/renderer/src/components/layout/PreviewPanel.tsx')
raw = p.read_bytes()
if raw.startswith(b'\xef\xbb\xbf'):
    raw = raw[3:]
text = raw.decode('utf-8').replace('\r\n', '\n').replace('\r', '\n')
lines = text.split('\n')

# --- Section boundaries (0-indexed) ---
# 0-57: imports
# 59-63: MonacoDiffEditor lazy
# 65-123: utility functions + TabIcon
# 125-744: main PreviewPanel component

# Find exact lines
utils_start = None
main_start = None
for i, line in enumerate(lines):
    if line.startswith('function fileName('):
        utils_start = i
    if line.startswith('export function PreviewPanel('):
        main_start = i
        break

print(f"Utils: {utils_start+1}, Main: {main_start+1}")

# --- 1. preview-utils.ts ---
# Extract lines 65-123 (utility functions + TabIcon)
utils_lines = lines[utils_start:main_start - 1]  # up to blank line before export
# Remove trailing empty lines
while utils_lines and utils_lines[-1].strip() == '':
    utils_lines.pop()

utils_content = """// Utility functions and helpers for PreviewPanel

import type React from 'react'
import { Bot, File, FileDiff, Globe } from 'lucide-react'
import type { PreviewPanelTab } from '@renderer/stores/preview-panel-helpers'

"""
utils_content += '\n'.join(utils_lines) + '\n'

pathlib.Path('src/renderer/src/components/layout/preview-utils.ts').write_text(
    utils_content, encoding='utf-8'
)
print(f"  preview-utils.ts: {len(utils_lines) + 7} lines")

# --- 2. Extract the main component, then split its JSX ---
# The main component has these logical JSX sections:
# a) Empty state (when !activeTab) — lines ~375-414
# b) Tab strip — lines ~420-500
# c) Toolbar (breadcrumb + buttons) — lines ~502-620
# d) Content area (diff/markdown/viewer) — lines ~622-700
# e) Save dialog — lines ~702-744

# For now, the cleanest split is:
# - preview-utils.ts (done)
# - PreviewPanel.tsx stays as the main component but imports from preview-utils
# The main component is ~620 lines which is still over 500.
# Let's also extract the save logic (saveTab + save dialog handlers) into a hook.

# Find the save-related functions
save_start = None
save_end = None
for i in range(main_start, len(lines)):
    if 'const saveTab = async' in lines[i]:
        save_start = i
    if save_start and 'const handleCopyMarkdown' in lines[i]:
        save_end = i
        break

print(f"Save functions: {save_start+1}-{save_end}")

# Find handleOpenLocalFiles end
open_files_start = None
open_files_end = None
for i in range(save_end, len(lines)):
    if 'const handleOpenLocalFiles' in lines[i]:
        open_files_start = i
    if open_files_start and lines[i].strip() == '}' and i > open_files_start + 3:
        open_files_end = i + 1
        break

# Actually, let's take a simpler approach: extract the tab strip JSX and toolbar JSX
# into sub-components. But that requires passing many props. 
# 
# Simpler: just extract utility functions (done) + extract save handlers into a custom hook.

# Build the save hook
save_lines = lines[save_start:save_end]
# Remove trailing empty lines
while save_lines and save_lines[-1].strip() == '':
    save_lines.pop()

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

interface UsePreviewSaveReturn {
  saveTab: (tab: PreviewPanelTab) => Promise<boolean>
  handleSave: () => Promise<void>
}

export function usePreviewSave({ activeTab, content, setContent }: UsePreviewSaveOptions): UsePreviewSaveReturn {
  const updatePreviewTab = useUIStore((s) => s.updatePreviewTab)

  const saveTab = async (tab: PreviewPanelTab): Promise<boolean> => {
    const isEditableDiff = tab.source === 'diff' && Boolean(tab.diffModifiedEditable)
    if ((tab.source !== 'file' && !isEditableDiff) || !tab.filePath) return false

    const tabContent = isEditableDiff
      ? (tab.draftContent ?? tab.diffModified ?? '')
      : tab.id === activeTab?.id
        ? content
        : tab.draftContent
    if (tabContent === undefined) return false

    try {
      const channel = tab.sshConnectionId ? IPC.SSH_FS_WRITE_FILE : IPC.FS_WRITE_FILE
      const args = tab.sshConnectionId
        ? { connectionId: tab.sshConnectionId, path: tab.filePath, content: tabContent }
        : { path: tab.filePath, content: tabContent }
      await ipcClient.invoke(channel, args)
      if (isEditableDiff) {
        updatePreviewTab(tab.id, {
          draftContent: undefined,
          modified: false,
          diffModified: tabContent
        })
        if (tab.gitRepoPath) {
          useGitStore.getState().invalidateFileDiff(tab.gitRepoPath, tab.filePath)
          void useGitStore.getState().refreshRepository(tab.gitRepoPath, { force: true })
        }
      } else {
        if (tab.id === activeTab?.id) setContent(tabContent)
        updatePreviewTab(tab.id, {
          draftContent: undefined,
          modified: false
        })
      }
      return true
    } catch (err) {
      console.error('[PreviewPanel] Save failed:', err)
      return false
    }
  }

  const handleSave = async (): Promise<void> => {
    if (!activeTab) return
    await saveTab(activeTab)
  }

  return { saveTab, handleSave }
}
"""

pathlib.Path('src/renderer/src/components/layout/use-preview-save.ts').write_text(
    hook_content, encoding='utf-8'
)
print(f"  use-preview-save.ts: {hook_content.count(chr(10))} lines")

# --- 3. Rebuild PreviewPanel.tsx ---
# Replace the utility functions with imports
# Replace saveTab + handleSave with hook usage

# Build new imports
new_imports = """import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bot,
  Check,
  Code2,
  Columns2,
  Copy,
  ExternalLink,
  Eye,
  FileOutput,
  FolderOpen,
  Globe,
  PanelRightClose,
  Plus,
  RefreshCw,
  Rows2,
  Save,
  X
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { useChatStore } from '@renderer/stores/chat-store'
import { useAppPluginStore } from '@renderer/stores/app-plugin-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { useUIStore, type PreviewPanelTab } from '@renderer/stores/ui-store'
import { useFileWatcher } from '@renderer/hooks/use-file-watcher'
import { viewerRegistry } from '@renderer/lib/preview/viewer-registry'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'
import {
  createMarkdownComponents,
  MARKDOWN_REHYPE_PLUGINS,
  MARKDOWN_REMARK_PLUGINS
} from '@renderer/lib/preview/viewers/markdown-components'
import { BROWSER_PLUGIN_ID } from '@renderer/lib/app-plugin/types'
import { cn } from '@renderer/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import {
  fileName,
  relativePath,
  breadcrumbParts,
  fileExtension,
  isExternalUrl,
  shouldReadPreviewText,
  tabTitle,
  tabPathTitle,
  TabIcon
} from './preview-utils'
import { usePreviewSave } from './use-preview-save'

"""

# Find the main component body (from export function to end)
main_lines = lines[main_start:]

# Find and remove saveTab + handleSave from the component, replace with hook
# The save functions are at specific line offsets within main_lines
save_offset_start = save_start - main_start
save_offset_end = save_end - main_start

# Build the component with save logic replaced
before_save = main_lines[:save_offset_start]
after_save = main_lines[save_offset_end:]

# Insert hook usage after the state declarations
# Find a good insertion point — after the "content" variable
hook_insert = """  const { saveTab, handleSave } = usePreviewSave({ activeTab, content, setContent })
"""

# Find the line with "const content =" to insert after the next blank line
content_line_idx = None
for i, line in enumerate(before_save):
    if 'const content =' in line:
        content_line_idx = i
        break

if content_line_idx:
    # Find next blank line after content declaration
    insert_idx = content_line_idx + 1
    while insert_idx < len(before_save) and before_save[insert_idx].strip() != '':
        insert_idx += 1
    before_save = before_save[:insert_idx + 1] + [hook_insert] + before_save[insert_idx + 1:]

new_main = new_imports + '\n' + '\n'.join(before_save) + '\n' + '\n'.join(after_save)

# Write with BOM + CRLF
new_main = new_main.replace('\r\n', '\n').replace('\r', '\n')
new_main = new_main.replace('\n', '\r\n')
if not new_main.startswith('\ufeff'):
    new_main = '\ufeff' + new_main
p.write_bytes(new_main.encode('utf-8'))

# Count lines
import subprocess
for name in ['PreviewPanel.tsx', 'preview-utils.ts', 'use-preview-save.ts']:
    path = f'src/renderer/src/components/layout/{name}'
    result = subprocess.run(['wc', '-l', path], capture_output=True, text=True)
    print(f"  {result.stdout.strip()}")

print("Done!")
