#!/usr/bin/env python3
"""Scan all @renderer/ and relative imports in the given files and verify they exist."""
import re
import os
import sys

BASE = r"D:\claw\wishful-claw\src\renderer\src"

FILES = [
    r"src/renderer/src/components/chat/AssistantMessage/content-renderer.tsx",
    r"src/renderer/src/components/chat/AssistantMessage/markdown-renderer.tsx",
    r"src/renderer/src/components/chat/AssistantMessage/token-summary.tsx",
    r"src/renderer/src/components/chat/AssistantMessage/ui-buttons.tsx",
    r"src/renderer/src/components/chat/InputArea/badges.tsx",
    r"src/renderer/src/components/chat/InputArea/runtime-metrics.tsx",
    r"src/renderer/src/components/chat/InputArea/utils.ts",
    r"src/renderer/src/components/chat/MessageList/utils.ts",
    r"src/renderer/src/components/chat/ModelSwitcher/utils.ts",
    r"src/renderer/src/components/chat/ToolCallCard/utils.ts",
]

# Also check files modified in other commits during this session
EXTRA_FILES = [
    r"src/renderer/src/components/chat/MessageList.tsx",
    r"src/renderer/src/components/chat/FileChangeCard.tsx",
    r"src/renderer/src/components/chat/FileChangeCard/utils.ts",
    r"src/renderer/src/components/chat/ModelSwitcher.tsx",
    r"src/renderer/src/components/chat/InputArea/index.tsx",
    r"src/renderer/src/components/chat/GitPage.tsx",
    r"src/renderer/src/components/chat/GitPage/utils.tsx",
    r"src/renderer/src/components/chat/ToolCallCard/output-blocks/text-output.tsx",
    r"src/renderer/src/lib/agent/memory-automation.ts",
    r"src/renderer/src/lib/agent/memory-automation-utils.ts",
]

ALL_FILES = FILES + EXTRA_FILES

# Regex to match import ... from '...'
IMPORT_RE = re.compile(r"""from\s+['"]([^'"]+)['"]""")

def resolve_path(import_path, current_file):
    """Resolve an import path to a file system path and check existence."""
    # Skip node_modules packages
    if not import_path.startswith('.') and not import_path.startswith('@renderer/') and not import_path.startswith('@shared/'):
        return None  # external package, skip
    
    if import_path.startswith('@renderer/'):
        rel = import_path.replace('@renderer/', '')
        base = os.path.join(BASE, rel)
    elif import_path.startswith('@shared/'):
        rel = import_path.replace('@shared/', '')
        base = os.path.join(r'D:\claw\wishful-claw\src\shared', rel)
    else:
        # Relative import
        current_dir = os.path.dirname(current_file)
        base = os.path.normpath(os.path.join(current_dir, import_path))
    
    # Try various extensions
    extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx']
    for ext in extensions:
        if os.path.isfile(base + ext):
            return True
    
    return False

errors = []
for f in ALL_FILES:
    full_path = os.path.join(r"D:\claw\wishful-claw", f)
    if not os.path.isfile(full_path):
        print(f"WARN: File not found: {f}")
        continue
    with open(full_path, 'r', encoding='utf-8') as fh:
        content = fh.read()
    for match in IMPORT_RE.finditer(content):
        import_path = match.group(1)
        result = resolve_path(import_path, full_path)
        if result is False:
            errors.append((f, import_path))

if errors:
    print(f"\n=== FOUND {len(errors)} BROKEN IMPORTS ===\n")
    for f, imp in errors:
        short_f = f.replace("src/renderer/src/", "")
        print(f"  {short_f}")
        print(f"    -> {imp}")
        print()
else:
    print("\nAll imports resolve correctly!")
