"""Add terminal store init to App.tsx"""
import sys

filepath = r'D:\claw\wishful-claw\src\renderer\src\App.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

# Try with CRLF
target = b"    // Pre-fetch tool definitions in background so first message doesn't wait\r\n    fetchToolDefinitions('chat')\r\n  }, [])"
replacement = b"    // Initialize terminal store early \xe2\x80\x94 registers SSH exec output listener\r\n    // so Agent SSH commands show in terminal even before user opens the panel\r\n    useTerminalStore.getState().init()\r\n\r\n    // Pre-fetch tool definitions in background so first message doesn't wait\r\n    fetchToolDefinitions('chat')\r\n  }, [])"

if target in content:
    content = content.replace(target, replacement, 1)
    with open(filepath, 'wb') as f:
        f.write(content)
    print("Successfully added terminal store init to App.tsx")
else:
    # Try with LF
    target2 = target.replace(b'\r\n', b'\n')
    replacement2 = replacement.replace(b'\r\n', b'\n')
    if target2 in content:
        content = content.replace(target2, replacement2, 1)
        with open(filepath, 'wb') as f:
            f.write(content)
        print("Successfully added terminal store init to App.tsx (LF)")
    else:
        print("ERROR: Could not find target text in App.tsx")
        # Debug: print surrounding bytes
        idx = content.find(b'fetchToolDefinitions')
        if idx >= 0:
            print(f"Found 'fetchToolDefinitions' at index {idx}")
            print(f"Context: {content[idx-100:idx+100]}")
        sys.exit(1)
