path = 'src/renderer/src/components/layout/RightPanel.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_block = """  // Debug: log state changes
  useEffect(() => {
    console.warn('[RightPanel] browserTabAlive:', browserTabAlive,
      'hasBrowserTab:', hasBrowserTab, 'pluginEnabled:', browserPluginEnabled,
      'rightPanelOpen:', rightPanelOpen, 'activeTabKind:', activeTab?.kind,
      'panelSessionId:', panelSessionId)
  }, [browserTabAlive, hasBrowserTab, browserPluginEnabled, rightPanelOpen, activeTab])
"""

new_block = """  // Debug: log state changes
  useEffect(() => {
    console.warn('[RightPanel] browserTabAlive:', browserTabAlive,
      'hasBrowserTab:', hasBrowserTab, 'pluginEnabled:', browserPluginEnabled,
      'rightPanelOpen:', rightPanelOpen, 'activeTabKind:', activeTab?.kind,
      'panelSessionId:', panelSessionId)
  }, [browserTabAlive, hasBrowserTab, browserPluginEnabled, rightPanelOpen, activeTab, panelSessionId])
"""

# Remove old block
content = content.replace(old_block, '')

# Insert after browserVisible line
insert_after = "  const browserVisible = rightPanelOpen && activeTab?.kind === 'browser'\n"
content = content.replace(insert_after, insert_after + "\n" + new_block)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('OK')
