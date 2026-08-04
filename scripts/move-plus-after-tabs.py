"""Move Plus button from far-left to right-after-tabs (like OpenCowork)"""
import sys

filepath = r'D:\claw\wishful-claw\src\renderer\src\components\terminal\BottomTerminalDock.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

le = b'\r\n' if b'\r\n' in content else b'\n'

# Step 1: Remove the Plus button that's before the tabs div
old_plus_block = (
    b'        {/* New terminal button (left side) */}' + le +
    b'        <Tooltip>' + le +
    b'          <TooltipTrigger asChild>' + le +
    b'            <Button' + le +
    b'              variant="ghost"' + le +
    b'              size="icon"' + le +
    b'              className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"' + le +
    b'              onClick={handleCreate}' + le +
    b'              title={t(\'terminal.newTerminal\', { defaultValue: \'New terminal\' })}' + le +
    b'            >' + le +
    b'              <Plus className="size-3.5" />' + le +
    b'            </Button>' + le +
    b'          </TooltipTrigger>' + le +
    b'          <TooltipContent>{t(\'terminal.newTerminal\', { defaultValue: \'New terminal\' })}</TooltipContent>' + le +
    b'        </Tooltip>' + le +
    le
)

if old_plus_block in content:
    content = content.replace(old_plus_block, b'', 1)
    print("Step 1: Removed Plus button from far-left position")
else:
    print("ERROR: Could not find Plus button block to remove")
    sys.exit(1)

# Step 2: Add Plus button inside tabs div, right after the tabs mapping
# Find the closing of the tabs container: the `)}` that ends the map, followed by `</div>`
old_tabs_end = (
    b'          )}' + le +
    b'        </div>' + le
)

# The Plus button to add right before `</div>` (tabs container close)
plus_button = (
    b'          )}' + le +
    b'          {/* New terminal button (right after tabs) */}' + le +
    b'          <Tooltip>' + le +
    b'            <TooltipTrigger asChild>' + le +
    b'              <Button' + le +
    b'                variant="ghost"' + le +
    b'                size="icon"' + le +
    b'                className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"' + le +
    b'                onClick={handleCreate}' + le +
    b'                title={t(\'terminal.newTerminal\', { defaultValue: \'New terminal\' })}' + le +
    b'              >' + le +
    b'                <Plus className="size-3.5" />' + le +
    b'              </Button>' + le +
    b'            </TooltipTrigger>' + le +
    b'            <TooltipContent>{t(\'terminal.newTerminal\', { defaultValue: \'New terminal\' })}</TooltipContent>' + le +
    b'          </Tooltip>' + le +
    b'        </div>' + le
)

if old_tabs_end in content:
    content = content.replace(old_tabs_end, plus_button, 1)
    print("Step 2: Added Plus button after tabs")
else:
    print("ERROR: Could not find tabs closing div")
    sys.exit(1)

with open(filepath, 'wb') as f:
    f.write(content)

print("Successfully moved Plus button to after tabs (OpenCowork style)")
