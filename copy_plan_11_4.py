"""
Plan 11-4: Batch copy and adapt files from OpenCowork to wishful-claw.

Step 1: Monaco lib files (5 files)
Step 2: CodeEditor + MonacoDiffEditor (2 files)
Step 3: viewer-registry + register-viewers (2 files)
Step 4: All viewer components (16 files)
Step 5: use-file-watcher hook (1 file)
"""
import pathlib
import shutil

SRC = pathlib.Path(r'D:\claw\OpenCowork\src\renderer\src')
DST = pathlib.Path(r'D:\claw\wishful-claw\src\renderer\src')

def copy_file(rel_path):
    """Copy a file from OpenCowork to wishful-claw, preserving content."""
    src = SRC / rel_path
    dst = DST / rel_path
    dst.parent.mkdir(parents=True, exist_ok=True)
    # Read as-is (preserves encoding)
    content = src.read_bytes()
    dst.write_bytes(content)
    line_count = content.count(b'\n') + 1
    print(f"  {rel_path} ({line_count} lines)")
    return dst

# --- Step 1: Monaco lib files ---
print("=== Step 1: Monaco lib ===")
monaco_files = [
    'lib/monaco/editor-options.ts',
    'lib/monaco/languages.ts',
    'lib/monaco/setup.ts',
    'lib/monaco/workspace.ts',
    'lib/monaco/source-navigation.ts',
]
for f in monaco_files:
    copy_file(f)

# --- Step 2: CodeEditor + MonacoDiffEditor ---
print("\n=== Step 2: Editor components ===")
editor_files = [
    'components/editor/CodeEditor.tsx',
    'components/editor/MonacoDiffEditor.tsx',
]
for f in editor_files:
    copy_file(f)

# --- Step 3: viewer-registry + register-viewers ---
print("\n=== Step 3: Viewer registry ===")
registry_files = [
    'lib/preview/viewer-registry.ts',
    'lib/preview/register-viewers.ts',
]
for f in registry_files:
    copy_file(f)

# --- Step 4: All viewer components ---
print("\n=== Step 4: Viewer components ===")
viewers_dir = SRC / 'lib/preview/viewers'
for viewer_file in sorted(viewers_dir.iterdir()):
    if viewer_file.is_file() and viewer_file.suffix in ('.ts', '.tsx'):
        rel = f'lib/preview/viewers/{viewer_file.name}'
        # Skip files that already exist in wishful-claw with modifications
        existing = DST / rel
        if existing.exists():
            print(f"  SKIP (already exists): {rel}")
            continue
        copy_file(rel)

# --- Step 5: use-file-watcher hook ---
print("\n=== Step 5: use-file-watcher ===")
copy_file('hooks/use-file-watcher.ts')

print("\n=== Done! ===")
