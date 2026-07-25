import type { GitStatusFile, GitBranchItem } from '@renderer/stores/git-store'
import type { DiffChunk } from '@renderer/components/chat/file-change-utils'
import type { GitSection, GitChangeRow, ChangeRow } from './agent-files-types'

export function dirname(input: string): string {
  const normalized = input.replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  return index > 0 ? normalized.slice(0, index) : ''
}

export function joinPath(root: string, child: string): string {
  if (!root) return child
  if (/^(?:[a-z]:)?[\\/]/i.test(child)) return child
  const separator = root.includes('\\') && !root.includes('/') ? '\\' : '/'
  return `${root.replace(/[\\/]+$/, '')}${separator}${child}`
}

export function repoRelativePath(repoPath: string | null, filePath: string): string | null {
  if (!repoPath) return null
  const normalizedRepo = repoPath.replace(/\\/g, '/').replace(/\/+$/, '')
  const normalizedFile = filePath.replace(/\\/g, '/')
  if (normalizedFile === normalizedRepo) return ''
  if (normalizedFile.startsWith(`${normalizedRepo}/`)) {
    return normalizedFile.slice(normalizedRepo.length + 1)
  }
  if (/^(?:[a-z]:)?\//i.test(normalizedFile)) return null
  return normalizedFile
}

export function gitDiffKey(row: Pick<GitChangeRow, 'section' | 'filePath'>): string {
  return `${row.section === 'staged' ? 'staged' : 'unstaged'}:${row.filePath}`
}

export function statusLetters(file: GitStatusFile, section: GitSection): string {
  if (section === 'untracked') return 'U'
  if (section === 'conflicted') return '!'
  if (section === 'staged') return file.stagedStatus.trim() || 'M'
  return file.unstagedStatus.trim() || 'M'
}

export function gitStatusTone(section: GitSection): string {
  if (section === 'untracked') return 'text-agent-files-added'
  if (section === 'conflicted') return 'text-agent-files-conflict'
  return 'text-agent-files-modified'
}

export function summarizeUnifiedDiff(diffText: string): { added: number; deleted: number } {
  let added = 0
  let deleted = 0
  for (const line of diffText.split(/\r?\n/)) {
    if (line.startsWith('+++') || line.startsWith('---')) continue
    if (line.startsWith('+')) added += 1
    if (line.startsWith('-')) deleted += 1
  }
  return { added, deleted }
}

export function parseUnifiedDiff(diffText: string): DiffChunk[] {
  const lines: Array<{
    type: 'keep' | 'add' | 'del'
    text: string
    oldNum?: number
    newNum?: number
  }> = []
  let oldLine = 0
  let newLine = 0
  let inHunk = false

  for (const rawLine of diffText.split(/\r?\n/)) {
    if (rawLine.startsWith('@@')) {
      const match = rawLine.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/)
      oldLine = match ? Number(match[1]) : 0
      newLine = match ? Number(match[2]) : 0
      inHunk = true
      continue
    }
    if (!inHunk) continue
    if (rawLine.startsWith('+++') || rawLine.startsWith('---')) continue

    if (rawLine.startsWith('+')) {
      lines.push({ type: 'add', text: rawLine.slice(1), newNum: newLine })
      newLine += 1
      continue
    }

    if (rawLine.startsWith('-')) {
      lines.push({ type: 'del', text: rawLine.slice(1), oldNum: oldLine })
      oldLine += 1
      continue
    }

    const text = rawLine.startsWith(' ') ? rawLine.slice(1) : rawLine
    lines.push({ type: 'keep', text, oldNum: oldLine, newNum: newLine })
    oldLine += 1
    newLine += 1
  }

  if (lines.length === 0 && diffText.trim()) {
    return [{ type: 'lines', lines: [{ type: 'keep', text: diffText.trim() }] }]
  }
  return foldContext(lines)
}

export function rowOpLabel(row: ChangeRow): string {
  if (row.source === 'git')
    return row.section === 'untracked' ? 'A' : statusLetters(row.file, row.section)
  if (row.change.op === 'create') return 'A'
  if (!row.change.after.exists) return 'D'
  return 'M'
}

export function rowOpTone(row: ChangeRow): string {
  if (row.source === 'git') return gitStatusTone(row.section)
  if (row.change.op === 'create') return 'text-agent-files-added'
  if (!row.change.after.exists) return 'text-agent-files-deleted'
  return 'text-agent-files-modified'
}

export function branchItemLabel(branch: GitBranchItem): string {
  return branch.isCurrent ? `${branch.name} (HEAD)` : branch.name
}
