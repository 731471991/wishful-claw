import { GitStatusFile } from '../../stores/git-store-types'
import { AggregatedFileChange } from '../chat/file-change-utils'
export type GitSection = 'staged' | 'unstaged' | 'untracked' | 'conflicted'

export interface GitChangeRow {
  source: 'git'
  key: string
  section: GitSection
  file: GitStatusFile
  filePath: string
  added: number
  deleted: number
}

export interface AgentChangeRow {
  source: 'agent'
  key: string
  change: AggregatedFileChange
  filePath: string
  added: number
  deleted: number
}

export type ChangeRow = GitChangeRow | AgentChangeRow

export const EMPTY_DIFF_BY_KEY: Record<string, string> = {}
export const MAX_PRELOAD_DIFFS = 12
export const DIFF_PRELOAD_BATCH_SIZE = 2
