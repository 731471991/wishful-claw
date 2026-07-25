import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'
import { getParentPath, type EditorWorkspace } from './workspace'

type ImportMatch = {
  specifier: string
  startColumn: number
  endColumn: number
}

type ResolveImportTargetOptions = {
  currentFilePath: string
  specifier: string
  workspace?: EditorWorkspace | null
}

const SOURCE_FILE_EXTENSIONS = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.d.ts'
]

const INDEX_FILE_EXTENSIONS = [
  '/index.ts',
  '/index.tsx',
  '/index.js',
  '/index.jsx',
  '/index.mjs',
  '/index.cjs',
  '/index.d.ts'
]

const IMPORT_PATTERNS: Array<{ regex: RegExp; specifierGroup: number }> = [
  {
    regex: /(?:import|export)\s+[\s\S]*?from\s+(['"])([^'"]+)\1/g,
    specifierGroup: 2
  },
  {
    regex: /import\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
    specifierGroup: 2
  },
  {
    regex: /require\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
    specifierGroup: 2
  }
]

export function findImportPathAtPosition(lineText: string, column: number): ImportMatch | null {
  for (const pattern of IMPORT_PATTERNS) {
    pattern.regex.lastIndex = 0
    let match: RegExpExecArray | null = pattern.regex.exec(lineText)
    while (match) {
      const specifier = match[pattern.specifierGroup]
      if (!specifier) {
        match = pattern.regex.exec(lineText)
        continue
      }

      const specifierOffset = match[0].lastIndexOf(specifier)
      if (specifierOffset < 0) {
        match = pattern.regex.exec(lineText)
        continue
      }

      const startColumn = match.index + specifierOffset + 1
      const endColumn = startColumn + specifier.length
      if (column >= startColumn && column <= endColumn) {
        return {
          specifier,
          startColumn,
          endColumn
        }
      }

      match = pattern.regex.exec(lineText)
    }
  }

  return null
}

export async function resolveImportTarget(
  options: ResolveImportTargetOptions
): Promise<string | null> {
  const { currentFilePath, specifier, workspace } = options
  if (!isNavigableSpecifier(specifier) || !workspace) return null

  const candidateBases = buildCandidateBases(currentFilePath, specifier, workspace)
  for (const candidateBase of candidateBases) {
    for (const candidatePath of expandCandidatePaths(candidateBase)) {
      const exists =
        workspace.kind === 'ssh'
          ? await sshFileExists(workspace.connectionId, candidatePath)
          : await localFileExists(candidatePath)
      if (exists) return candidatePath
    }
  }

  return null
}

function isNavigableSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('@renderer/')
  )
}

function buildCandidateBases(
  currentFilePath: string,
  specifier: string,
  workspace: EditorWorkspace
): string[] {
  if (specifier.startsWith('@renderer/')) {
    const rootPath = trimTrailingSeparator(workspace.rootPath, workspace.kind === 'ssh')
    const aliasPath = specifier.slice('@renderer/'.length)
    return [
      joinPath(
        rootPath,
        ['src', 'renderer', 'src', ...aliasPath.split('/')],
        workspace.kind === 'ssh'
      )
    ]
  }

  const parentPath = getParentPath(currentFilePath)
  if (!parentPath) return []

  return [joinRelativePath(parentPath, specifier, workspace.kind === 'ssh')]
}

function expandCandidatePaths(candidateBase: string): string[] {
  const candidates = new Set<string>()
  const normalizedBase = candidateBase.replace(/\\/g, '/')
  const hasExtension = /\.[^./\\]+$/.test(normalizedBase)

  if (hasExtension) {
    candidates.add(candidateBase)
  } else {
    for (const extension of SOURCE_FILE_EXTENSIONS) {
      candidates.add(`${candidateBase}${extension}`)
    }
    for (const extension of INDEX_FILE_EXTENSIONS) {
      candidates.add(`${candidateBase}${extension}`)
    }
  }

  return Array.from(candidates)
}

function joinRelativePath(basePath: string, specifier: string, isRemote: boolean): string {
  const separator = isRemote ? '/' : detectSeparator(basePath)
  const baseSegments = splitPath(basePath)
  const relativeSegments = specifier.split('/').filter(Boolean)
  const combined = [...baseSegments]

  for (const segment of relativeSegments) {
    if (segment === '.') continue
    if (segment === '..') {
      if (combined.length > 0 && combined[combined.length - 1] !== '..') {
        combined.pop()
      }
      continue
    }
    combined.push(segment)
  }

  return joinPathFromSegments(basePath, combined, separator)
}

function joinPath(rootPath: string, segments: string[], isRemote: boolean): string {
  const separator = isRemote ? '/' : detectSeparator(rootPath)
  const baseSegments = splitPath(rootPath)
  const normalizedSegments = segments.filter(Boolean)
  return joinPathFromSegments(rootPath, [...baseSegments, ...normalizedSegments], separator)
}

function joinPathFromSegments(originalBase: string, segments: string[], separator: string): string {
  const hasDriveLetter = /^[A-Za-z]:/.test(originalBase)
  const hasLeadingSlash = originalBase.startsWith('/')
  const drivePrefix = hasDriveLetter ? originalBase.slice(0, 2) : ''
  const joined = segments.join(separator)

  if (hasDriveLetter) {
    const withoutDrive = joined.replace(/^[A-Za-z]:[\\/]?/, '')
    return `${drivePrefix}${separator}${withoutDrive}`
  }

  if (hasLeadingSlash) {
    return `${separator}${joined}`.replace(
      new RegExp(`${escapeForRegExp(separator)}+`, 'g'),
      separator
    )
  }

  return joined
}

function splitPath(filePath: string): string[] {
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+/g, '/')
  const withoutDrive = normalized.replace(/^[A-Za-z]:\/?/, '')
  return withoutDrive.split('/').filter(Boolean)
}

function detectSeparator(filePath: string): string {
  return filePath.includes('\\') ? '\\' : '/'
}

function trimTrailingSeparator(filePath: string, isRemote: boolean): string {
  if (isRemote) {
    return filePath.length > 1 ? filePath.replace(/\/+$/, '') : filePath
  }
  return filePath.length > 3 ? filePath.replace(/[\\/]+$/, '') : filePath
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function localFileExists(filePath: string): Promise<boolean> {
  const result = await ipcClient.invoke(IPC.FS_READ_FILE, { path: filePath })
  return !hasIpcError(result)
}

async function sshFileExists(connectionId: string, filePath: string): Promise<boolean> {
  const result = await ipcClient.invoke(IPC.SSH_FS_READ_FILE, {
    connectionId,
    path: filePath
  })
  return !hasIpcError(result)
}

function hasIpcError(result: unknown): boolean {
  if (result && typeof result === 'object' && 'error' in result) return true
  if (typeof result !== 'string') return false
  if (!result.trim().startsWith('{')) return false

  try {
    const parsed = JSON.parse(result) as { error?: unknown }
    return typeof parsed.error === 'string' && parsed.error.length > 0
  } catch {
    return false
  }
}
