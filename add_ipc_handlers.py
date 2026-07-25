"""Add fs:watch-file, fs:unwatch-file, fs:select-file, shell:openPath handlers to main/index.ts"""
import pathlib

p = pathlib.Path('src/main/index.ts')
content = p.read_text(encoding='utf-8-sig')

old = """  // -- Shell handlers --
  registerMessagePackHandler<string, void>(
    'shell:openExternal',
    async (args) => {
      await shell.openExternal(args)
    }
  )"""

new = """  // -- Shell handlers --
  registerMessagePackHandler<string, void>(
    'shell:openExternal',
    async (args) => {
      await shell.openExternal(args)
    }
  )

  registerMessagePackHandler<string, void>(
    'shell:openPath',
    async (args) => {
      await shell.openPath(args)
    }
  )

  // -- File selection dialog --
  registerMessagePackHandler<{ multiSelections?: boolean }, { canceled: boolean; path: string; paths: string[] }>(
    'fs:select-file',
    async (args) => {
      const properties: ('openFile' | 'multiSelections')[] = ['openFile']
      if (args?.multiSelections) properties.push('multiSelections')
      const result = await dialog.showOpenDialog(mainWindow!, {
        properties: properties as ('openFile' | 'multiSelections')[]
      })
      return {
        canceled: result.canceled,
        path: result.filePaths[0] ?? '',
        paths: result.filePaths
      }
    }
  )

  // -- File watch handlers --
  const watchedFiles = new Map<string, fs.FSWatcher>()

  registerMessagePackHandler<{ path: string }, { path: string }>(
    'fs:watch-file',
    async (args) => {
      const filePath = args.path
      if (watchedFiles.has(filePath)) {
        return { path: filePath }
      }
      try {
        const watcher = fs.watch(filePath, { persistent: false }, (eventType) => {
          if (eventType === 'change') {
            safeSendMessagePackToWindow(mainWindow!, 'fs:file-changed', { path: filePath })
          }
        })
        watcher.on('error', () => {
          watchedFiles.delete(filePath)
        })
        watchedFiles.set(filePath, watcher)
        return { path: filePath }
      } catch {
        return { path: filePath }
      }
    }
  )

  registerMessagePackHandler<{ path: string }, void>(
    'fs:unwatch-file',
    async (args) => {
      const watcher = watchedFiles.get(args.path)
      if (watcher) {
        watcher.close()
        watchedFiles.delete(args.path)
      }
    }
  )"""

if old not in content:
    print("ERROR: Could not find target text!")
    print("Searching for partial match...")
    if "shell:openExternal" in content:
        print("Found 'shell:openExternal' in file")
    raise SystemExit(1)

content = content.replace(old, new)
p.write_text(content, encoding='utf-8')
print("Done! Added 4 new IPC handlers.")
