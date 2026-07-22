filepath = r'D:\claw\wishful-claw\src\renderer\src\assets\main.css'
with open(filepath, 'r', encoding='utf-8', newline='') as f:
    content = f.read()

# 1. Add light theme composer variables after --app-background in :root
light_marker = "  --app-background: var(--background);\r\n}\r\n\r\n.dark {"
light_composer = """  --app-background: var(--background);\r
\r
  /* Composer shell variables (light) */\r
  --composer-shell-top: #ffffff;\r
  --composer-shell-bottom: #ffffff;\r
  --composer-shell-border: #dedee3;\r
  --composer-shell-border-focus: color-mix(in srgb, var(--ring) 28%, var(--border));\r
  --composer-shell-shadow:\r
    0 10px 24px -18px color-mix(in srgb, var(--foreground) 18%, transparent),\r
    0 1px 2px color-mix(in srgb, var(--foreground) 6%, transparent);\r
  --composer-shell-shadow-focus:\r
    0 12px 28px -18px color-mix(in srgb, var(--foreground) 16%, transparent),\r
    0 0 0 3px color-mix(in srgb, var(--ring) 12%, transparent);\r
  --composer-shell-glow: transparent;\r
  --composer-editor-surface: transparent;\r
  --composer-editor-surface-strong: transparent;\r
  --composer-editor-border: transparent;\r
  --composer-toolbar-border: #ededf0;\r
  --composer-panel-bg: #ffffff;\r
  --composer-panel-border: #dedee3;\r
  --composer-panel-shadow:\r
    0 20px 38px -28px rgba(0, 0, 0, 0.22), 0 1px 2px rgba(0, 0, 0, 0.06);\r
  --composer-control-bg: transparent;\r
  --composer-control-bg-hover: #f0f0f2;\r
  --composer-control-border: transparent;\r
  --composer-control-shadow: none;\r
  --composer-control-active-bg: transparent;\r
  --composer-control-active-border: transparent;\r
  --composer-control-active-text: var(--foreground);\r
  --composer-send-start: var(--foreground);\r
  --composer-send-end: var(--foreground);\r
  --composer-send-shadow: 0 8px 20px -12px color-mix(in srgb, var(--foreground) 20%, transparent);\r
  --composer-send-shadow-hover: 0 10px 22px -12px color-mix(in srgb, var(--foreground) 24%, transparent);\r
  --composer-send-foreground: var(--background);\r
  --composer-chip-bg: transparent;\r
  --composer-chip-border: #dedee3;\r
  --composer-chip-text: color-mix(in srgb, var(--foreground) 72%, var(--muted-foreground) 28%);\r
  --composer-chip-hover: #f0f0f2;\r
  --composer-drop-bg: #e8e9ed;\r
  --composer-placeholder: color-mix(in srgb, var(--muted-foreground) 82%, transparent);\r
  --composer-suggestion: color-mix(in srgb, var(--muted-foreground) 54%, transparent);\r
}\r
\r
.dark {"""

# Find the first occurrence (light theme)
idx = content.find(light_marker)
if idx < 0:
    # Try without the .dark part
    light_marker2 = "  --app-background: var(--background);\r\n}\r\n"
    idx = content.find(light_marker2)
    if idx < 0:
        print("FAIL: could not find light theme --app-background")
        import sys; sys.exit(1)
    # Find the next .dark
    dark_idx = content.find("\r\n.dark {", idx)
    if dark_idx < 0:
        print("FAIL: could not find .dark after light theme")
        import sys; sys.exit(1)
    # Replace the section between --app-background and .dark
    before = content[:idx]
    after = content[dark_idx:]
    content = before + light_composer + after
else:
    content = content.replace(light_marker, light_composer, 1)
print("Step 1: added light theme composer variables")

# 2. Add dark theme composer variables after --app-background in .dark
dark_marker = "  --app-background: var(--background);\r\n}\r\n\r\n@layer base"
dark_composer = """  --app-background: var(--background);\r
\r
  /* Composer shell variables (dark) */\r
  --composer-shell-top: #303030;\r
  --composer-shell-bottom: #303030;\r
  --composer-shell-border: color-mix(in srgb, var(--border) 74%, transparent);\r
  --composer-shell-border-focus: color-mix(in srgb, var(--ring) 24%, var(--border));\r
  --composer-shell-shadow: 0 18px 32px -24px rgba(0, 0, 0, 0.55), 0 1px 2px rgba(0, 0, 0, 0.35);\r
  --composer-shell-shadow-focus:\r
    0 20px 36px -24px rgba(0, 0, 0, 0.6), 0 0 0 3px color-mix(in srgb, var(--ring) 10%, transparent);\r
  --composer-shell-glow: transparent;\r
  --composer-editor-surface: transparent;\r
  --composer-editor-surface-strong: transparent;\r
  --composer-editor-border: transparent;\r
  --composer-toolbar-border: color-mix(in srgb, var(--border) 74%, black 26%);\r
  --composer-panel-bg: #303030;\r
  --composer-panel-border: color-mix(in srgb, var(--border) 82%, black 18%);\r
  --composer-panel-shadow: 0 20px 38px -28px rgba(0, 0, 0, 0.72), 0 1px 2px rgba(0, 0, 0, 0.4);\r
  --composer-control-bg: transparent;\r
  --composer-control-bg-hover: color-mix(in srgb, var(--accent) 82%, black 18%);\r
  --composer-control-border: transparent;\r
  --composer-control-shadow: none;\r
  --composer-control-active-bg: transparent;\r
  --composer-control-active-border: transparent;\r
  --composer-control-active-text: var(--foreground);\r
  --composer-send-start: color-mix(in srgb, var(--foreground) 88%, black 12%);\r
  --composer-send-end: color-mix(in srgb, var(--foreground) 88%, black 12%);\r
  --composer-send-shadow: 0 10px 22px -14px rgba(0, 0, 0, 0.45);\r
  --composer-send-shadow-hover: 0 12px 24px -14px rgba(0, 0, 0, 0.52);\r
  --composer-send-foreground: var(--background);\r
  --composer-chip-bg: transparent;\r
  --composer-chip-border: color-mix(in srgb, var(--border) 82%, black 18%);\r
  --composer-chip-text: color-mix(in srgb, var(--foreground) 78%, var(--muted-foreground) 22%);\r
  --composer-chip-hover: color-mix(in srgb, var(--accent) 82%, black 18%);\r
  --composer-drop-bg: color-mix(in srgb, var(--accent) 78%, black 22%);\r
  --composer-placeholder: color-mix(in srgb, var(--muted-foreground) 72%, transparent);\r
  --composer-suggestion: color-mix(in srgb, var(--muted-foreground) 46%, transparent);\r
}\r
\r
@layer base"""

if dark_marker in content:
    content = content.replace(dark_marker, dark_composer, 1)
    print("Step 2: added dark theme composer variables")
else:
    print("WARN: dark theme marker not found, trying alternative")
    # Find the second occurrence of --app-background
    idx1 = content.find("--app-background: var(--background);")
    idx2 = content.find("--app-background: var(--background);", idx1 + 1)
    if idx2 < 0:
        print("FAIL: could not find second --app-background")
        import sys; sys.exit(1)
    # Find the closing } and @layer base after it
    close_idx = content.find("}", idx2)
    layer_idx = content.find("@layer base", close_idx)
    if layer_idx < 0:
        print("FAIL: could not find @layer base after dark theme")
        import sys; sys.exit(1)
    before = content[:idx2]
    after = content[layer_idx:]
    content = before + dark_composer.replace("\r\n}\r\n\r\n@layer base", "\r\n}\r\n\r\n@layer base") + after
    print("Step 2: added dark theme composer variables (alternative)")

# 3. Append composer CSS rules at the end
composer_rules = """
\r
/* ── Composer shell styles ── */\r
.composer-shell {\r
  position: relative;\r
  isolation: isolate;\r
  border: 1px solid var(--composer-shell-border);\r
  background: linear-gradient(\r
    180deg,\r
    var(--composer-shell-top) 0%,\r
    var(--composer-shell-bottom) 100%\r
  );\r
  box-shadow: var(--composer-shell-shadow);\r
}\r
\r
.composer-shell::before {\r
  display: none;\r
}\r
\r
.composer-shell::after {\r
  display: none;\r
}\r
\r
.composer-shell:focus-within {\r
  border-color: var(--composer-shell-border-focus);\r
  box-shadow: var(--composer-shell-shadow-focus);\r
}\r
\r
.composer-shell[data-composer-variant='project'] {\r
  border-radius: 1.375rem;\r
}\r
\r
.composer-shell[data-composer-variant='session'] {\r
  border-radius: 1.0625rem;\r
}\r
\r
.composer-shell.composer-shell--attached-footer {\r
  border-bottom-right-radius: 0;\r
  border-bottom-left-radius: 0;\r
}\r
\r
.composer-drag-handle {\r
  position: relative;\r
  z-index: 1;\r
  background: transparent;\r
}\r
\r
.composer-drag-grip {\r
  background: color-mix(in srgb, var(--border) 88%, transparent);\r
  box-shadow: none;\r
}\r
\r
.composer-editor-region::before {\r
  display: none;\r
}\r
\r
.composer-toolbar {\r
  position: relative;\r
  z-index: 1;\r
  background: transparent;\r
}\r
\r
.composer-panel {\r
  border: 1px solid var(--composer-panel-border);\r
  background: var(--composer-panel-bg);\r
  box-shadow: var(--composer-panel-shadow);\r
}\r
\r
.composer-cardlet {\r
  border: 1px solid color-mix(in srgb, var(--composer-panel-border) 88%, transparent);\r
  background: color-mix(in srgb, var(--muted) 22%, transparent);\r
  box-shadow: none;\r
}\r
\r
.composer-shell [data-slot='button'].composer-control {\r
  border: 0;\r
  background: var(--composer-control-bg);\r
  color: color-mix(in srgb, var(--foreground) 70%, var(--muted-foreground) 30%);\r
  box-shadow: none;\r
}\r
\r
.composer-shell [data-slot='button'].composer-control:hover:not(:disabled) {\r
  background: var(--composer-control-bg-hover);\r
  color: var(--foreground);\r
}\r
\r
.composer-shell [data-slot='button'].composer-control[data-active='true'] {\r
  background: var(--composer-control-active-bg);\r
  color: var(--composer-control-active-text);\r
}\r
\r
.composer-shell [data-slot='button'].composer-control[data-tone='warning'] {\r
  background: transparent;\r
  color: color-mix(in srgb, #b45309 76%, var(--foreground));\r
}\r
\r
.composer-shell [data-slot='button'].composer-control[data-tone='warning']:hover:not(:disabled) {\r
  background: color-mix(in srgb, #f59e0b 12%, var(--composer-control-bg-hover));\r
  color: color-mix(in srgb, #92400e 82%, var(--foreground));\r
}\r
\r
.dark .composer-shell [data-slot='button'].composer-control[data-tone='warning'] {\r
  color: color-mix(in srgb, #fbbf24 78%, var(--foreground));\r
}\r
\r
.dark .composer-shell [data-slot='button'].composer-control[data-tone='warning']:hover:not(:disabled) {\r
  color: color-mix(in srgb, #fde68a 82%, var(--foreground));\r
}\r
\r
.composer-shell [data-slot='button'].composer-control[data-tone='danger'] {\r
  background: transparent;\r
  color: color-mix(in srgb, #b91c1c 74%, var(--foreground));\r
}\r
\r
.composer-shell [data-slot='button'].composer-control[data-tone='danger']:hover:not(:disabled) {\r
  background: color-mix(in srgb, #ef4444 12%, var(--composer-control-bg-hover));\r
  color: color-mix(in srgb, #991b1b 80%, var(--foreground));\r
}\r
\r
.dark .composer-shell [data-slot='button'].composer-control[data-tone='danger'] {\r
  color: color-mix(in srgb, #fca5a5 82%, var(--foreground));\r
}\r
\r
.dark .composer-shell [data-slot='button'].composer-control[data-tone='danger']:hover:not(:disabled) {\r
  color: color-mix(in srgb, #fecaca 86%, var(--foreground));\r
}\r
\r
.composer-shell [data-slot='button'].composer-send {\r
  border: 0;\r
  background: var(--composer-send-start);\r
  color: var(--composer-send-foreground);\r
  box-shadow: var(--composer-send-shadow);\r
}\r
\r
.composer-shell [data-slot='button'].composer-send:hover:not(:disabled) {\r
  box-shadow: var(--composer-send-shadow-hover);\r
  filter: brightness(1.04);\r
}\r
\r
.composer-status-pill {\r
  display: inline-flex;\r
  align-items: center;\r
  gap: 0.375rem;\r
  border: 1px solid var(--composer-chip-border);\r
  background: var(--composer-chip-bg);\r
  color: var(--composer-chip-text);\r
  box-shadow: none;\r
}\r
\r
.composer-skill-tag {\r
  border: 1px solid var(--composer-chip-border);\r
  background: var(--composer-chip-bg);\r
  color: var(--composer-chip-text);\r
  box-shadow: none;\r
}\r
\r
.composer-image-thumb {\r
  border: 1px solid var(--composer-panel-border);\r
  background: transparent;\r
  box-shadow: none;\r
}\r
\r
.composer-drop-overlay {\r
  background: color-mix(in srgb, var(--composer-drop-bg) 78%, transparent);\r
}\r
\r
.composer-flyout {\r
  border: 1px solid var(--composer-panel-border);\r
  background: var(--composer-panel-bg);\r
  box-shadow: var(--composer-panel-shadow);\r
}\r
\r
.composer-flyout-header {\r
  border-bottom: 1px solid var(--composer-toolbar-border);\r
  background: transparent;\r
}\r
\r
.composer-editor-placeholder {\r
  color: var(--composer-placeholder);\r
}\r
\r
.composer-editor-suggestion {\r
  color: var(--composer-suggestion);\r
}\r
\r
.composer-editor-content {\r
  position: relative;\r
  z-index: 1;\r
  color: var(--foreground);\r
}\r
\r
.composer-file-ref {\r
  border: 1px solid var(--composer-chip-border);\r
  background: color-mix(in srgb, var(--muted) 46%, transparent);\r
  color: var(--composer-chip-text);\r
  box-shadow: none;\r
}\r
\r
.composer-file-ref:hover {\r
  background: color-mix(in srgb, var(--muted) 70%, transparent);\r
  color: var(--foreground);\r
}\r
\r
.composer-file-ref--highlighted {\r
  box-shadow:\r
    0 0 0 1px color-mix(in srgb, var(--primary) 26%, transparent),\r
    0 0 0 4px color-mix(in srgb, var(--primary) 8%, transparent);\r
}\r
\r
.composer-file-ref-action {\r
  color: color-mix(in srgb, var(--composer-chip-text) 82%, transparent);\r
}\r
\r
.composer-file-ref-action:hover {\r
  background: var(--composer-chip-hover);\r
  color: var(--foreground);\r
}\r
\r
textarea.composer-aux-textarea {\r
  border-color: var(--composer-chip-border);\r
  background: transparent;\r
  box-shadow: none;\r
}\r
"""

content = content.rstrip() + composer_rules
print("Step 3: appended composer CSS rules")

with open(filepath, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
print("Done - file written")
