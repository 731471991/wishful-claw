import pathlib

p = pathlib.Path('src/main/ipc/channel-handlers/channel-plugin-handlers.ts')
content = p.read_text(encoding='utf-8-sig')

old = (
    "    const plugins = await readPlugins()\n"
    "    let changed = false\n\n"
    "    // Auto-seed: ensure each provider type has exactly one global instance\n"
    "    for (const descriptor of CHANNEL_PROVIDERS) {"
)

new = (
    "    let plugins = await readPlugins()\n"
    "    let changed = false\n\n"
    "    // Deduplicate: keep only one instance per provider type (prefer projectId=null).\n"
    "    // Old OpenCowork data may have per-project instances that should be removed.\n"
    "    plugins.sort((a, b) => {\n"
    "      if (a.projectId && !b.projectId) return 1\n"
    "      if (!a.projectId && b.projectId) return -1\n"
    "      return 0\n"
    "    })\n"
    "    const _seenTypes = new Set<string>()\n"
    "    const _deduped = plugins.filter((p) => {\n"
    "      if (_seenTypes.has(p.type)) return false\n"
    "      _seenTypes.add(p.type)\n"
    "      return true\n"
    "    })\n"
    "    if (_deduped.length !== plugins.length) {\n"
    "      plugins = _deduped\n"
    "      changed = true\n"
    "    }\n\n"
    "    // Auto-seed: ensure each provider type has exactly one global instance\n"
    "    for (const descriptor of CHANNEL_PROVIDERS) {"
)

assert old in content, "pattern not found"
content = content.replace(old, new, 1)
p.write_text(content, encoding='utf-8')
print("Done")
