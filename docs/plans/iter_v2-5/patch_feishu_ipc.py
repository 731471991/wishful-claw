import pathlib

p = pathlib.Path('src/main/ipc/channel-handlers/channel-feishu-handlers.ts')
content = p.read_text(encoding='utf-8-sig')

# 1. Add import for feishu-install
old_import = (
    "import {\n"
    "  activeChannelManager,\n"
    "  registerChannelMessagePackHandler,\n"
    "  readBinarySource\n"
    "} from './channel-handler-utils'"
)
new_import = (
    "import {\n"
    "  activeChannelManager,\n"
    "  registerChannelMessagePackHandler,\n"
    "  readBinarySource\n"
    "} from './channel-handler-utils'\n"
    "import { startFeishuInstall, pollFeishuInstall } from '../../channels/providers/feishu/feishu-install'"
)
assert old_import in content, "import block not found"
content = content.replace(old_import, new_import, 1)

# 2. Add install handlers before executeFeishuChannelTool
old_end = "export async function executeFeishuChannelTool"
install_handlers = (
    "  // -- Feishu OAuth Device Flow: scan-to-bind --\n"
    "  registerChannelMessagePackHandler<{ domain?: 'feishu' | 'lark' }>(\n"
    "    'plugin:feishu:install-start',\n"
    "    async (args) => {\n"
    "      return await startFeishuInstall(args?.domain ?? 'feishu')\n"
    "    }\n"
    "  )\n\n"
    "  registerChannelMessagePackHandler<string>(\n"
    "    'plugin:feishu:install-poll',\n"
    "    async (installId) => {\n"
    "      return await pollFeishuInstall(installId)\n"
    "    }\n"
    "  )\n"
    "}\n\n"
    "export async function executeFeishuChannelTool"
)

assert old_end in content, "executeFeishuChannelTool not found"
content = content.replace(old_end, install_handlers, 1)

p.write_text(content, encoding='utf-8')
print("Feishu install IPC handlers added")
