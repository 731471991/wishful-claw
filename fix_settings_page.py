import pathlib

p = pathlib.Path(r"D:\claw\wishful-claw\src\renderer\src\components\settings\SettingsPage.tsx")
text = p.read_text(encoding="utf-8")

replacements = []

# 1. Add Cable to imports
replacements.append((
    "import { ArrowLeft, Server, Info, Settings, User, MessageCircle, Search, Puzzle } from 'lucide-react'",
    "import { ArrowLeft, Server, Info, Settings, User, MessageCircle, Search, Puzzle, Cable } from 'lucide-react'"
))

# 2. Add McpPanel import
replacements.append((
    "import { SkillPanel } from '@renderer/components/settings/skill-panel'",
    "import { SkillPanel } from '@renderer/components/settings/skill-panel'\nimport { McpPanel } from '@renderer/components/settings/mcp-panel'"
))

# 3. Add MCP menu item to extensions group
replacements.append((
    """        { id: 'skills', icon: <Puzzle className="size-4" />, label: t('tabs.skills.label', { defaultValue: 'Skills' }) }
      ]""",
    """        { id: 'skills', icon: <Puzzle className="size-4" />, label: t('tabs.skills.label', { defaultValue: 'Skills' }) },
        { id: 'mcp', icon: <Cable className="size-4" />, label: t('tabs.mcp.label', { defaultValue: 'MCP' }) }
      ]"""
))

# 4. Add MCP render branch
replacements.append((
    """            ) : settingsTab === 'skills' ? (
              <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
                <SkillPanel />
              </div>
            ) : (""",
    """            ) : settingsTab === 'skills' ? (
              <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
                <SkillPanel />
              </div>
            ) : settingsTab === 'mcp' ? (
              <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
                <McpPanel />
              </div>
            ) : ("""
))

for i, (old, new) in enumerate(replacements):
    if old in text:
        text = text.replace(old, new, 1)
        print(f"Replacement {i+1}: OK (LF)")
    elif old.replace('\n', '\r\n') in text:
        text = text.replace(old.replace('\n', '\r\n'), new.replace('\n', '\r\n'), 1)
        print(f"Replacement {i+1}: OK (CRLF)")
    else:
        print(f"Replacement {i+1}: NOT FOUND")
        exit(1)

p.write_text(text, encoding="utf-8")
print("All done")
