import re

path = r'D:\claw\wishful-claw\src\renderer\src\components\chat\WorkingFolderSelectorDialog.tsx'
with open(path, 'r', encoding='utf-8', newline='') as f:
    content = f.read()

# 1. Change props signature
old_props = "  onSelectLocalFolder: (folderPath: string) => void | Promise<void>\r\n  onSelectSshFolder: (folderPath: string, connectionId: string) => void | Promise<void>\r\n}"
new_props = "  onSelectLocalFolder: (folderPath: string, projectName?: string) => void | Promise<void>\r\n  onSelectSshFolder: (folderPath: string, connectionId: string, projectName?: string) => void | Promise<void>\r\n}"
content = content.replace(old_props, new_props, 1)
print("Step 1: updated props signature")

# 2. Add customProjectName state after creatingProject state
old_state = "  const [creatingProject, setCreatingProject] = React.useState(false)\r\n"
new_state = "  const [creatingProject, setCreatingProject] = React.useState(false)\r\n  const [customProjectName, setCustomProjectName] = React.useState('')\r\n"
content = content.replace(old_state, new_state, 1)
print("Step 2: added customProjectName state")

# 3. Reset customProjectName when dialog opens
old_effect = "    if (!open) return\r\n    setCreatingProject(false)\r\n"
new_effect = "    if (!open) return\r\n    setCreatingProject(false)\r\n    setCustomProjectName('')\r\n"
content = content.replace(old_effect, new_effect, 1)
print("Step 3: added customProjectName reset")

# 4. Update displayedProjectName to use customProjectName if set
old_displayed = "  const displayedProjectName = pendingSelection\r\n    ? deriveProjectNameFromFolder(pendingSelection.folderPath, suggestedProjectName)\r\n    : suggestedProjectName"
new_displayed = "  const autoProjectName = pendingSelection\r\n    ? deriveProjectNameFromFolder(pendingSelection.folderPath, suggestedProjectName)\r\n    : suggestedProjectName\r\n  const displayedProjectName = customProjectName.trim() || autoProjectName"
content = content.replace(old_displayed, new_displayed, 1)
print("Step 4: updated displayedProjectName")

# 5. Update handleCreateProject to pass projectName
old_create = "      if (pendingSelection.kind === 'ssh') {\r\n        await onSelectSshFolder(pendingSelection.folderPath, pendingSelection.connectionId)\r\n      } else {\r\n        updateSettings({\r\n          lastProjectDirectory: deriveBaseDirectoryFromSelectedFolder(pendingSelection.folderPath)\r\n        })\r\n        await onSelectLocalFolder(pendingSelection.folderPath)\r\n      }"
new_create = "      const finalProjectName = customProjectName.trim() || autoProjectName\r\n      if (pendingSelection.kind === 'ssh') {\r\n        await onSelectSshFolder(pendingSelection.folderPath, pendingSelection.connectionId, finalProjectName)\r\n      } else {\r\n        updateSettings({\r\n          lastProjectDirectory: deriveBaseDirectoryFromSelectedFolder(pendingSelection.folderPath)\r\n        })\r\n        await onSelectLocalFolder(pendingSelection.folderPath, finalProjectName)\r\n      }"
content = content.replace(old_create, new_create, 1)
print("Step 5: updated handleCreateProject")

# 6. Replace the static project name display with an editable input
old_name_display = """                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground/70">{t('input.projectName')}</p>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-foreground">
                    <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{displayedProjectName}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground/60">
                    {t('input.createProjectSubtitle', {
                      defaultValue:
                        'Choose a local or SSH folder. The project name follows the folder name.'
                    })}
                  </p>
                </div>"""

new_name_display = """                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted-foreground/70">{t('input.projectName')}</p>
                  <Input
                    className="mt-1 h-8 text-[13px] font-medium"
                    value={customProjectName}
                    onChange={(e) => setCustomProjectName(e.target.value)}
                    placeholder={autoProjectName}
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground/60">
                    {t('input.createProjectSubtitle', {
                      defaultValue:
                        'Choose a local or SSH folder. Project name defaults to the folder name but you can customize it.'
                    })}
                  </p>
                </div>"""

content = content.replace(old_name_display, new_name_display, 1)
print("Step 6: replaced static name display with editable input")

with open(path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
print("Done")
