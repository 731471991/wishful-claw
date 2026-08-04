import os

filepath = 'src/renderer/src/components/chat/ProjectArchivePage.tsx'
with open(filepath, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

# Find main component start
main_start = None
for i, line in enumerate(lines):
    if 'export function ProjectArchivePage' in line:
        main_start = i
        break

if main_start is None:
    raise Exception('Main component not found')

# Collect existing imports (lines before the types section)
# Types section starts at "// --- Types ---"
types_start = None
for i, line in enumerate(lines):
    if 'Types' in line and line.strip().startswith('//'):
        types_start = i
        break

# Get imports (everything before types section)
imports = lines[:types_start]

# Remove ipcClient and IPC imports since they're now in helpers
# But check if they're still used in the main component
main_component = ''.join(lines[main_start:])

needs_ipc = 'ipcClient' in main_component
needs_cn = 'cn(' in main_component or 'cn(' in main_component

# Build new imports
new_import_lines = []
for line in imports:
    # Skip the ipcClient import line if not needed in main
    stripped = line.strip()
    if not needs_ipc and ('ipcClient' in stripped or 'IPC }' in stripped or 'from \'@renderer/lib/ipc' in stripped):
        continue
    new_import_lines.append(line)

# Add imports for extracted modules
new_import_lines.append("import {\n")
new_import_lines.append("  type ArchiveTabId,\n")
new_import_lines.append("  type FileState,\n")
new_import_lines.append("  type PersonaSummary,\n")
new_import_lines.append("  type SshConnectionInfo,\n")
new_import_lines.append("  WISHFUL_CLAW_DIR,\n")
new_import_lines.append("  PERSONA_FILE_NAMES,\n")
new_import_lines.append("  DEFAULT_MEMORY_TEMPLATE,\n")
new_import_lines.append("  DEFAULT_DAILY_TEMPLATE,\n")
new_import_lines.append("  joinFsPath,\n")
new_import_lines.append("  getTodayDate,\n")
new_import_lines.append("  getHomeDir,\n")
new_import_lines.append("  readTextFile,\n")
new_import_lines.append("  writeTextFile,\n")
new_import_lines.append("  listDir\n")
new_import_lines.append("} from './project-archive-helpers'\n")
new_import_lines.append("import { PersonaFilePreview } from './PersonaFilePreview'\n")
new_import_lines.append('\n')

# Build output: new imports + main component
output = ''.join(new_import_lines)
output += '\n'
for i in range(main_start, len(lines)):
    output += lines[i]

with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
    f.write(output)

line_count = len(output.splitlines())
print('New file: %d lines' % line_count)
