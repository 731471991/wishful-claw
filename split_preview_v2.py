"""Extract PreviewTabStrip and PreviewEmptyState from PreviewPanel.tsx"""
import pathlib

p = pathlib.Path('src/renderer/src/components/layout/PreviewPanel.tsx')
raw = p.read_bytes()
if raw.startswith(b'\xef\xbb\xbf'):
    raw = raw[3:]
text = raw.decode('utf-8').replace('\r\n', '\n').replace('\r', '\n')
lines = text.split('\n')

# Find the empty state block: from "if (!activeTab) {" to the closing "}" before "return ("
empty_start = None
empty_end = None
for i, line in enumerate(lines):
    if 'if (!activeTab) {' in line:
        empty_start = i
    if empty_start is not None and i > empty_start and line.strip() == '}' and lines[i+1].strip() == '':
        empty_end = i + 1
        break

print(f"Empty state: {empty_start+1}-{empty_end}")

# Find the tab strip JSX block
# It starts with "showTabStrip ? (" and ends with ": null)" before the toolbar div
tabstrip_start = None
tabstrip_end = None
brace_depth = 0
for i, line in enumerate(lines):
    if 'showTabStrip ? (' in line:
        tabstrip_start = i
        brace_depth = 0
    if tabstrip_start is not None and i >= tabstrip_start:
        brace_depth += line.count('{') - line.count('}')
        if i > tabstrip_start + 2 and line.strip().startswith(': null)'):
            tabstrip_end = i + 1
            break

print(f"Tab strip: {tabstrip_start+1}-{tabstrip_end}")

# Extract empty state block
empty_lines = lines[empty_start:empty_end]
# Extract tab strip block  
tabstrip_lines = lines[tabstrip_start:tabstrip_end]

# Build PreviewEmptyState component
empty_state_content = """// Empty state for PreviewPanel when no tab is active

import { useTranslation } from 'react-i18next'
import { FolderOpen, PanelRightClose, Plus } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'

interface PreviewEmptyStateProps {
  showTabStrip: boolean
  onOpenLocalFiles: () => void
  onClosePanel: () => void
}

export function PreviewEmptyState({ showTabStrip, onOpenLocalFiles, onClosePanel }: PreviewEmptyStateProps): React.JSX.Element {
  const { t } = useTranslation('layout')
  return (
"""
# Add the empty state JSX (skip the if condition, just the return content)
# Find "return (" in empty_lines
ret_idx = None
for i, line in enumerate(empty_lines):
    if 'return (' in line:
        ret_idx = i + 1
        break
# Find closing ")" 
end_idx = None
for i in range(len(empty_lines) - 1, ret_idx, -1):
    if empty_lines[i].strip() == ')':
        end_idx = i
        break

empty_jsx = empty_lines[ret_idx:end_idx]
# Indent properly (already has indentation from original)
empty_state_content += '\n'.join(empty_jsx) + '\n}\n'

pathlib.Path('src/renderer/src/components/layout/preview-empty-state.tsx').write_text(
    empty_state_content, encoding='utf-8'
)

# Build PreviewTabStrip component
tabstrip_content = """// Tab strip for PreviewPanel — extracted to keep main file under 500 lines

import { useTranslation } from 'react-i18next'
import { FolderOpen, Globe, FileOutput, PanelRightClose, Plus, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import type { PreviewPanelTab } from '@renderer/stores/preview-panel-helpers'
import { cn } from '@renderer/lib/utils'
import { TabIcon, tabTitle, tabPathTitle } from './preview-utils'

interface PreviewTabStripProps {
  tabs: PreviewPanelTab[]
  activeTabId: string
  browserPluginEnabled: boolean
  onSelectTab: (tabId: string) => void
  onRequestCloseTab: (tab: PreviewPanelTab) => void
  onOpenLocalFiles: () => void
  onSwitchToBrowser: () => void
  onSwitchToArtifacts: () => void
  onClosePanel: () => void
}

export function PreviewTabStrip({
  tabs,
  activeTabId,
  browserPluginEnabled,
  onSelectTab,
  onRequestCloseTab,
  onOpenLocalFiles,
  onSwitchToBrowser,
  onSwitchToArtifacts,
  onClosePanel
}: PreviewTabStripProps): React.JSX.Element {
  const { t } = useTranslation('layout')
  return (
"""
# Extract the JSX from tabstrip_lines (the content between "showTabStrip ? (" and ": null)")
# Find the actual JSX content
jsx_start = None
for i, line in enumerate(tabstrip_lines):
    if '<div' in line:
        jsx_start = i
        break

# The JSX is everything from jsx_start to end (excluding ": null)")
jsx_lines = tabstrip_lines[jsx_start:]
# Remove last line if it's ": null)"
if jsx_lines and ': null)' in jsx_lines[-1]:
    jsx_lines = jsx_lines[:-1]

tabstrip_content += '\n'.join(jsx_lines) + '\n}\n'

pathlib.Path('src/renderer/src/components/layout/preview-tab-strip.tsx').write_text(
    tabstrip_content, encoding='utf-8'
)

# --- Rebuild PreviewPanel.tsx ---
# Replace empty state block with component call
# Replace tab strip block with component call

new_lines = lines[:empty_start]
# Add empty state replacement
new_lines.append('  if (!activeTab) {')
new_lines.append('    return (')
new_lines.append('      <PreviewEmptyState')
new_lines.append('        showTabStrip={showTabStrip}')
new_lines.append('        onOpenLocalFiles={handleOpenLocalFiles}')
new_lines.append('        onClosePanel={() => setRightPanelOpen(false)}')
new_lines.append('      />')
new_lines.append('    )')
new_lines.append('  }')
new_lines.append('')
new_lines.extend(lines[empty_end:tabstrip_start])
# Add tab strip replacement
new_lines.append('      {showTabStrip ? (')
new_lines.append('        <PreviewTabStrip')
new_lines.append('          tabs={tabs}')
new_lines.append('          activeTabId={activeTab.id}')
new_lines.append('          browserPluginEnabled={browserPluginEnabled}')
new_lines.append('          onSelectTab={setActivePreviewTab}')
new_lines.append('          onRequestCloseTab={requestCloseTab}')
new_lines.append('          onOpenLocalFiles={handleOpenLocalFiles}')
new_lines.append('          onSwitchToBrowser={() => setRightPanelTab(\'browser\')}')
new_lines.append('          onSwitchToArtifacts={() => setRightPanelTab(\'artifacts\')}')
new_lines.append('          onClosePanel={() => setRightPanelOpen(false)}')
new_lines.append('        />')
new_lines.append('      ) : null}')
new_lines.extend(lines[tabstrip_end:])

# Add imports for new components
# Find the last import line
last_import = 0
for i, line in enumerate(new_lines):
    if line.startswith('import '):
        last_import = i

new_lines.insert(last_import + 1, "import { PreviewEmptyState } from './preview-empty-state'")
new_lines.insert(last_import + 2, "import { PreviewTabStrip } from './preview-tab-strip'")

# Write back
content = '\n'.join(new_lines)
content = content.replace('\r\n', '\n').replace('\r', '\n')
content = content.replace('\n', '\r\n')
if not content.startswith('\ufeff'):
    content = '\ufeff' + content
p.write_bytes(content.encode('utf-8'))

# Count lines
import subprocess
for name in ['PreviewPanel.tsx', 'preview-empty-state.tsx', 'preview-tab-strip.tsx', 'preview-utils.ts', 'use-preview-save.ts']:
    path = f'src/renderer/src/components/layout/{name}'
    result = subprocess.run(['wc', '-l', path], capture_output=True, text=True)
    print(f"  {result.stdout.strip()}")

print("Done!")
