"""Extract PreviewPanel implementation from ui-store.ts into preview-panel-slice.ts"""
import pathlib

store_path = pathlib.Path('src/renderer/src/stores/ui-store.ts')
content = store_path.read_text(encoding='utf-8-sig')
content = content.replace('\r\n', '\n')
lines = content.split('\n')

# Find the PreviewPanel block: from "// Preview panel" to "// Hovering state"
preview_start = None
preview_end = None
for i, line in enumerate(lines):
    if '// Preview panel' in line:
        preview_start = i
    if preview_start and '// Hovering state' in line:
        preview_end = i
        break

print(f"Preview block: lines {preview_start+1}-{preview_end}")

# Extract the preview methods
preview_lines = lines[preview_start:preview_end]

# Build the slice file
# The slice needs: set, get, state type, RightPanelTabInstance, ensureRightPanelTabs,
# resolvePanelScope, and all the preview-panel-helpers imports

slice_content = """// Preview panel store slice — extracted from ui-store.ts
// Contains all PreviewPanel state and methods to keep ui-store.ts under 500 lines

import type { UIStore } from './ui-store-interface'
import type { RightPanelTabInstance } from './ui-types'
import type { PreviewPanelState, PreviewPanelTab, OpenDiffParams } from './preview-panel-helpers'
import {
  buildFilePreviewState,
  previewTabTitle,
  withPreviewTab,
  withPreviewScope,
  activatePreviewTab,
  rightPanelPreviewTabId
} from './preview-panel-helpers'
import { resolvePanelScope } from './browser-session-helpers'
import { ensureRightPanelTabs } from './right-panel-tab-factories'

type SetFn = (partial: Partial<UIStore> | ((state: UIStore) => Partial<UIStore>)) => void
type GetFn = () => UIStore

export function createPreviewPanelSlice(set: SetFn, get: GetFn) {
  return {
"""
# Add the preview lines, indented properly
for line in preview_lines:
    # Skip the comment line and trailing empty line
    if '// Preview panel' in line:
        continue
    if '// Hovering state' in line:
        continue
    if line.strip() == '':
        continue
    slice_content += '    ' + line + '\n'

slice_content += "  }\n}\n"

# Write the slice file
pathlib.Path('src/renderer/src/stores/preview-panel-slice.ts').write_text(
    slice_content, encoding='utf-8'
)

# Now replace the preview block in ui-store.ts with a spread of the slice
new_lines = lines[:preview_start]
new_lines.append('  // Preview panel (extracted to preview-panel-slice.ts)')
new_lines.append('  ...createPreviewPanelSlice(set, get),')
new_lines.append('')
new_lines.extend(lines[preview_end:])

new_content = '\n'.join(new_lines)

# Add import for createPreviewPanelSlice
old_import = "} from './preview-panel-helpers'"
new_import = """} from './preview-panel-helpers'
import { createPreviewPanelSlice } from './preview-panel-slice'"""
new_content = new_content.replace(old_import, new_import, 1)

# Write back with BOM + CRLF
new_content = new_content.replace('\r\n', '\n')
new_content = new_content.replace('\n', '\r\n')
if not new_content.startswith('\ufeff'):
    new_content = '\ufeff' + new_content
store_path.write_bytes(new_content.encode('utf-8'))

# Check line counts
import subprocess
for name in ['ui-store.ts', 'preview-panel-slice.ts']:
    path = f'src/renderer/src/stores/{name}'
    result = subprocess.run(['wc', '-l', path], capture_output=True, text=True)
    print(f"  {result.stdout.strip()}")

print("Done!")
