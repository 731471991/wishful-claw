import pathlib

p = pathlib.Path('src/main/ipc/channel-handlers/channel-feishu-handlers.ts')
content = p.read_text(encoding='utf-8-sig')

old = (
    "  })\n"
    "}\n\n"
    "// \u2500\u2500 Channel-specific tool executor (used by reverse-request dispatch) \u2500\u2500\n\n"
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

new = (
    "  })\n\n"
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
    "// \u2500\u2500 Channel-specific tool executor (used by reverse-request dispatch) \u2500\u2500\n\n"
    "export async function executeFeishuChannelTool"
)

assert old in content, "pattern not found"
content = content.replace(old, new, 1)
p.write_text(content, encoding='utf-8')
print("Fixed: install handlers moved inside registerFeishuHandlers")
