path = r'D:\claw\wishful-claw\src\renderer\src\components\chat\ChatHomePage.tsx'
with open(path, 'r', encoding='utf-8', newline='') as f:
    content = f.read()

# Update handleCreateProjectWithDirectory signature and name logic
old = "    async (folderPath: string, connectionId: string | null): Promise<void> => {\r\n      const chatStore = useChatStore.getState()\r\n      const projectId = await chatStore.createProject({\r\n        name: deriveProjectNameFromFolder(\r\n          folderPath,\r\n          t('input.newProject', { defaultValue: 'New project' })\r\n        ),\r\n        workingFolder: folderPath,\r\n        sshConnectionId: connectionId ?? undefined\r\n      })"

new = "    async (folderPath: string, connectionId: string | null, projectName?: string): Promise<void> => {\r\n      const chatStore = useChatStore.getState()\r\n      const projectId = await chatStore.createProject({\r\n        name: projectName?.trim() || deriveProjectNameFromFolder(\r\n          folderPath,\r\n          t('input.newProject', { defaultValue: 'New project' })\r\n        ),\r\n        workingFolder: folderPath,\r\n        sshConnectionId: connectionId ?? undefined\r\n      })"

if old in content:
    content = content.replace(old, new, 1)
    print("OK: updated handleCreateProjectWithDirectory")
else:
    print("FAIL: could not find handleCreateProjectWithDirectory")

# Update onSelectLocalFolder callback to pass projectName
old_cb = "        onSelectLocalFolder={(folderPath) => handleCreateProjectWithDirectory(folderPath, null)}"
new_cb = "        onSelectLocalFolder={(folderPath, projectName) => handleCreateProjectWithDirectory(folderPath, null, projectName)}"

if old_cb in content:
    content = content.replace(old_cb, new_cb, 1)
    print("OK: updated onSelectLocalFolder callback")
else:
    print("FAIL: could not find onSelectLocalFolder callback")

# Update onSelectSshFolder callback to pass projectName
old_ssh = "        onSelectSshFolder={(folderPath, connectionId) =>\n          handleCreateProjectWithDirectory(folderPath, connectionId)\n        }"
new_ssh = "        onSelectSshFolder={(folderPath, connectionId, projectName) =>\n          handleCreateProjectWithDirectory(folderPath, connectionId, projectName)\n        }"

# Try CRLF version
old_ssh_crlf = old_ssh.replace('\n', '\r\n')
new_ssh_crlf = new_ssh.replace('\n', '\r\n')

if old_ssh_crlf in content:
    content = content.replace(old_ssh_crlf, new_ssh_crlf, 1)
    print("OK: updated onSelectSshFolder callback")
else:
    print("FAIL: could not find onSelectSshFolder callback")

with open(path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
print("Done")
