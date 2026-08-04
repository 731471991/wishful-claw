import pathlib

p = pathlib.Path('src/main/index.ts')
content = p.read_text(encoding='utf-8-sig')

# 1. Add channel imports after ssh-fs-handlers import line
old_import = "import { registerSshFsHandlers } from './ipc/ssh-fs-handlers'\r\nimport { safeSendMessagePackToWindow } from './window-ipc'"
if old_import not in content:
    old_import = "import { registerSshFsHandlers } from './ipc/ssh-fs-handlers'\nimport { safeSendMessagePackToWindow } from './window-ipc'"

new_import = (
    "import { registerSshFsHandlers } from './ipc/ssh-fs-handlers'\n"
    "import { ChannelManager } from './channels/channel-manager'\n"
    "import { registerBuiltInChannelProviders } from './channels/register-providers'\n"
    "import { registerChannelHandlers, autoStartChannels } from './ipc/channel-handlers'\n"
    "import { setPluginManager } from './channels/auto-reply'\n"
    "import { safeSendMessagePackToWindow } from './window-ipc'"
)

assert old_import in content, "Import block not found!"
content = content.replace(old_import, new_import, 1)

# 2. Add channelManager variable
old_var = "let mainWindow: BrowserWindow | null = null"
new_var = "let mainWindow: BrowserWindow | null = null\nlet channelManager: ChannelManager | null = null"
assert old_var in content, "mainWindow variable not found!"
content = content.replace(old_var, new_var, 1)

# 3. Add channel init block after registerSkillHandlers() call
skill_call = "  registerSkillHandlers()\n"
idx = content.find(skill_call)
assert idx != -1, "registerSkillHandlers() call not found!"

channel_init = (
    "  registerSkillHandlers()\n\n"
    "  // -- Channel system initialization --\n"
    "  channelManager = new ChannelManager()\n"
    "  registerBuiltInChannelProviders(channelManager)\n"
    "  registerChannelHandlers(channelManager)\n"
    "  setPluginManager(channelManager)\n"
    "  logInfo('main', 'Channel system initialized')\n"
)

content = content[:idx] + channel_init + content[idx + len(skill_call):]

# 4. Add autoStartChannels after createWindow()
old_create = "  createWindow()\n"
idx2 = content.rfind(old_create)
assert idx2 != -1, "createWindow() call not found!"

auto_start = (
    "  createWindow()\n\n"
    "  // Auto-start enabled channels after window is ready\n"
    "  if (channelManager) {\n"
    "    void autoStartChannels(channelManager)\n"
    "  }\n"
)

content = content[:idx2] + auto_start + content[idx2 + len(old_create):]

# 5. Add channelManager.stopAll() in before-quit
old_quit_patterns = [
    "app.on('before-quit', () => {\r\n  cleanupSshHandlers()\r\n})",
    "app.on('before-quit', () => {\n  cleanupSshHandlers()\n})",
]
new_quit = (
    "app.on('before-quit', () => {\n"
    "  cleanupSshHandlers()\n"
    "  if (channelManager) {\n"
    "    void channelManager.stopAll()\n"
    "  }\n"
    "})"
)

found_quit = False
for old_quit in old_quit_patterns:
    if old_quit in content:
        content = content.replace(old_quit, new_quit, 1)
        found_quit = True
        break

assert found_quit, "before-quit handler not found!"

p.write_text(content, encoding='utf-8')
print(f"Done! File now has {content.count(chr(10)) + 1} lines")
