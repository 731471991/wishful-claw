// File system IPC handlers — extracted from main/index.ts

import * as fs from 'fs'
import { registerMessagePackHandler } from './messagepack-handler'

export function registerFsHandlers(): void {
    registerMessagePackHandler<{ path: string; maxLines?: number }, string>(
      'fs:read-file',
      async (args) => {
        try {
          const content = await fs.promises.readFile(args.path, 'utf-8')
          return content
        } catch (err) {
          // Return empty string for missing files instead of throwing
          const code = (err as NodeJS.ErrnoException).code
          if (code === 'ENOENT' || code === 'EISDIR') return ''
          throw new Error(String(err))
        }
      }
    )

    registerMessagePackHandler<{ path: string; content: string; encoding?: BufferEncoding }, void>(
      'fs:write-file',
      async (args) => {
        await fs.promises.writeFile(args.path, args.content, args.encoding ?? 'utf-8')
      }
    )

    registerMessagePackHandler<{ path: string }, { isDirectory: boolean; isFile: boolean; size: number; mtime: number } | null>(
      'fs:stat-path',
      async (args) => {
        try {
          const stat = await fs.promises.stat(args.path)
          return {
            isDirectory: stat.isDirectory(),
            isFile: stat.isFile(),
            size: stat.size,
            mtime: stat.mtimeMs
          }
        } catch {
          return null
        }
      }
    )

    registerMessagePackHandler<{ path: string }, { name: string; isDirectory: boolean; isFile: boolean; size: number }[]>(
      'fs:list-dir',
      async (args) => {
        try {
          const entries = await fs.promises.readdir(args.path, { withFileTypes: true })
          return entries.map((entry) => ({
            name: entry.name,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            size: 0
          }))
        } catch {
          return []
        }
      }
    )

    registerMessagePackHandler<{ path: string; recursive?: boolean }, void>(
      'fs:mkdir',
      async (args) => {
        await fs.promises.mkdir(args.path, { recursive: args.recursive ?? true })
      }
    )

    registerMessagePackHandler<{ path: string }, void>(
      'fs:delete',
      async (args) => {
        await fs.promises.unlink(args.path)
      }
    )

    registerMessagePackHandler<{ from: string; to: string }, void>(
      'fs:move',
      async (args) => {
        await fs.promises.rename(args.from, args.to)
      }
    )

    registerMessagePackHandler<{ path: string }, string | null>(
      'fs:read-text-file-lines',
      async (args) => {
        try {
          const content = await fs.promises.readFile(args.path, 'utf-8')
          return content
        } catch {
          return null
        }
      }
    )

    registerMessagePackHandler<{ path: string }, ArrayBuffer | null>(
      'fs:read-file-binary',
      async (args) => {
        try {
          const buffer = await fs.promises.readFile(args.path)
          return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        } catch {
          return null
        }
      }
    )

    registerMessagePackHandler<{ path: string; content: Buffer | ArrayBuffer | Uint8Array }, void>(
      'fs:write-file-binary',
      async (args) => {
        const data = Buffer.isBuffer(args.content)
          ? args.content
          : args.content instanceof ArrayBuffer
            ? Buffer.from(args.content)
            : Buffer.from(args.content)
        await fs.promises.writeFile(args.path, data)
      }
    )

    // Glob - simple pattern matching (supports * and **)
    registerMessagePackHandler<{ pattern: string; cwd?: string }, { path: string; name: string; isDirectory: boolean }[]>(
      'fs:glob',
      async (args) => {
        try {
          const cwd = args.cwd ?? process.cwd()
          const pattern = args.pattern.replace(/\\/g, '/')
          const results: { path: string; name: string; isDirectory: boolean }[] = []
          const globToRegex = (p: string): RegExp => {
            let re = p.replace(/[.+^${}()|[\]]/g, '\\$&')
            re = re.replace(/\*\*/g, '<<GLOBSTAR>>')
            re = re.replace(/\*/g, '[^/]*')
            re = re.replace(/<<GLOBSTAR>>/g, '.*')
            re = re.replace(/\?/g, '.')
            return new RegExp('^' + re + '$')
          }
          const regex = globToRegex(pattern)
          const walk = async (dir: string, depth: number): Promise<void> => {
            if (depth > 8 || results.length > 500) return
            let entries: fs.Dirent[]
            try { entries = await fs.promises.readdir(dir, { withFileTypes: true }) } catch { return }
            for (const entry of entries) {
              if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
              const fullPath = join(dir, entry.name)
              const relPath = fullPath.replace(cwd, '').replace(/^[\\/]+/, '').replace(/\\/g, '/')
              if (regex.test(relPath) || regex.test(entry.name)) {
                results.push({ path: fullPath, name: entry.name, isDirectory: entry.isDirectory() })
              }
              if (entry.isDirectory() && depth < 8) {
                await walk(fullPath, depth + 1)
              }
            }
          }
          await walk(cwd, 0)
          return results
        } catch {
          return []
        }
      }
    )

    // Grep - search file contents
    registerMessagePackHandler<{ pattern: string; path?: string; glob?: string }, { file: string; line: number; text: string }[]>(
      'fs:grep',
      async (args) => {
        try {
          const cwd = args.path ?? process.cwd()
          const results: { file: string; line: number; text: string }[] = []
          const regex = new RegExp(args.pattern, 'i')
          const fileList: string[] = []
          const walk = async (dir: string, depth: number): Promise<void> => {
            if (depth > 6 || fileList.length > 1000) return
            let entries: fs.Dirent[]
            try { entries = await fs.promises.readdir(dir, { withFileTypes: true }) } catch { return }
            for (const entry of entries) {
              if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
              const fullPath = join(dir, entry.name)
              if (entry.isFile()) {
                fileList.push(fullPath)
              } else if (entry.isDirectory() && depth < 6) {
                await walk(fullPath, depth + 1)
              }
            }
          }
          await walk(cwd, 0)
          for (const file of fileList) {
            try {
              const content = await fs.promises.readFile(file, 'utf-8')
              const lines = content.split('\n')
              for (let i = 0; i < lines.length; i++) {
                if (regex.test(lines[i])) {
                  results.push({ file, line: i + 1, text: lines[i].trim() })
                  if (results.length >= 200) return results
                }
              }
            } catch {
              // skip binary files
            }
          }
          return results
        } catch {
          return []
        }
      }
    )

    // Search files by name
    registerMessagePackHandler<{ query: string; path?: string }, { path: string; name: string }[]>(
      'fs:search-files',
      async (args) => {
        try {
          const cwd = args.path ?? process.cwd()
          const query = args.query.toLowerCase()
          const results: { path: string; name: string }[] = []
          const walk = async (dir: string, depth: number): Promise<void> => {
            if (depth > 5 || results.length > 200) return
            const entries = await fs.promises.readdir(dir, { withFileTypes: true })
            for (const entry of entries) {
              if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
              const fullPath = join(dir, entry.name)
              if (entry.name.toLowerCase().includes(query)) {
                results.push({ path: fullPath, name: entry.name })
              }
              if (entry.isDirectory() && depth < 5) {
                await walk(fullPath, depth + 1)
              }
            }
          }
          await walk(cwd, 0)
          return results
        } catch {
          return []
        }
      }
    )

    // Ensure default chat working folder exists (Documents/<date>/Chat)
    registerMessagePackHandler<void, { path?: string; error?: string }>(
      'fs:default-chat-working-folder',
      async () => {
        try {
          const folderPath = join(app.getPath('documents'), formatLocalDateFolderName(), 'Chat')
          await fs.promises.mkdir(folderPath, { recursive: true })
          return { path: folderPath }
        } catch (err) {
          return { error: String(err) }
        }
      }
    )

}
