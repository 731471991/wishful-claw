"""Move Plus button to left side in BottomTerminalDock.tsx"""
import sys

filepath = r'D:\claw\wishful-claw\src\renderer\src\components\terminal\BottomTerminalDock.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

# Detect line ending
le = b'\r\n' if b'\r\n' in content else b'\n'

# 1. Add Plus button before the tabs div (left side)
old1 = (b'      {/* Tab bar */}\n'
        b'      <div className="flex h-9 shrink-0 items-center gap-1 border-b bg-background/70 px-2">\n'
        b'        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden pb-0.5 [scrollbar-width:none]">').replace(b'\n', le)

new1 = (b'      {/* Tab bar */}\n'
        b'      <div className="flex h-9 shrink-0 items-center gap-1 border-b bg-background/70 px-2">\n'
        b'        {/* New terminal button (left side) */}\n'
        b'        <Tooltip>\n'
        b'          <TooltipTrigger asChild>\n'
        b'            <Button\n'
        b'              variant="ghost"\n'
        b'              size="icon"\n'
        b'              className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"\n'
        b'              onClick={handleCreate}\n'
        b'              title={t(\'terminal.newTerminal\', { defaultValue: \'New terminal\' })}\n'
        b'            >\n'
        b'              <Plus className="size-3.5" />\n'
        b'            </Button>\n'
        b'          </TooltipTrigger>\n'
        b'          <TooltipContent>{t(\'terminal.newTerminal\', { defaultValue: \'New terminal\' })}</TooltipContent>\n'
        b'        </Tooltip>\n'
        b'\n'
        b'        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden pb-0.5 [scrollbar-width:none]">').replace(b'\n', le)

if old1 in content:
    content = content.replace(old1, new1, 1)
    print("Step 1: Added Plus button to left side")
else:
    print("ERROR: Could not find tab bar opening")
    sys.exit(1)

# 2. Remove the old Plus button (right side, before the ml-auto div)
old2 = (b'        <Tooltip>\n'
        b'          <TooltipTrigger asChild>\n'
        b'            <Button\n'
        b'              variant="ghost"\n'
        b'              size="icon"\n'
        b'              className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"\n'
        b'              onClick={handleCreate}\n'
        b'              title={t(\'terminal.newTerminal\', { defaultValue: \'New terminal\' })}\n'
        b'            >\n'
        b'              <Plus className="size-3.5" />\n'
        b'            </Button>\n'
        b'          </TooltipTrigger>\n'
        b'          <TooltipContent>{t(\'terminal.newTerminal\', { defaultValue: \'New terminal\' })}</TooltipContent>\n'
        b'        </Tooltip>\n'
        b'\n'
        b'        <div className="ml-auto flex items-center gap-1">').replace(b'\n', le)

new2 = (b'\n'
        b'        <div className="ml-auto flex items-center gap-1">').replace(b'\n', le)

if old2 in content:
    content = content.replace(old2, new2, 1)
    print("Step 2: Removed old Plus button from right side")
else:
    print("ERROR: Could not find old Plus button")
    sys.exit(1)

with open(filepath, 'wb') as f:
    f.write(content)

print("Successfully moved Plus button to left side")
