// Preview panel state types and helper functions
// Extracted to keep ui-store.ts under 500 lines

import type {
  PreviewSource,
  DiffSource,
  GitChangeSection
} from './ui-types'
import type { PanelScope } from './browser-session-helpers'

export interface PreviewPanelState {
  source: PreviewSource
  filePath: string
  viewMode: 'preview' | 'code'
  viewerType: string
  sshConnectionId?: string
  port?: number
  projectDir?: string
  markdownContent?: string
  markdownTitle?: string
  sessionId?: string | null
  projectId?: string | null
  targetLine?: number
  targetColumn?: number
  targetPositionKey?: number
  // Diff tabs (source === 'diff')
  diffSource?: DiffSource
  diffOriginal?: string
  diffModified?: string
  diffLanguage?: string
  diffModifiedEditable?: boolean
  diffIsBinary?: boolean
  diffOriginalRef?: string
  gitRepoPath?: string
  gitSection?: GitChangeSection
  agentRunId?: string
  agentChangeId?: string
}

export interface PreviewPanelTab extends PreviewPanelState {
  id: string
  title: string
  modified?: boolean
  draftContent?: string
}

export interface OpenDiffParams {
  filePath: string
  diffSource: DiffSource
  original: string
  modified: string
  modifiedEditable?: boolean
  isBinary?: boolean
  language?: string
  sshConnectionId?: string
  sessionId?: string | null
  projectId?: string | null
  diffOriginalRef?: string
  gitRepoPath?: string
  gitSection?: GitChangeSection
  agentRunId?: string
  agentChangeId?: string
  mirrorToRightPanel?: boolean
}

function normalizeScopeId(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed || null
}

const EXT_SETS: Record<string, Set<string>> = {
  preview: new Set(['.html', '.htm', '.xhtml', '.shtml']),
  spreadsheet: new Set(['.csv', '.tsv', '.xls', '.xlsx', '.xlsm', '.xlsb', '.ods']),
  markdown: new Set(['.md', '.mdx', '.markdown', '.mdown', '.mkd', '.mkdn', '.mdwn']),
  image: new Set([
    '.png', '.jpg', '.jpeg', '.jfif', '.pjpeg', '.pjp', '.gif', '.apng',
    '.bmp', '.webp', '.avif', '.ico', '.cur', '.tif', '.tiff', '.heic', '.heif', '.jxl'
  ]),
  video: new Set([
    '.mp4', '.webm', '.ogv', '.mov', '.m4v', '.mkv', '.avi',
    '.mpeg', '.mpg', '.3gp', '.3g2', '.mts', '.m2ts'
  ]),
  audio: new Set([
    '.mp3', '.wav', '.wave', '.ogg', '.oga', '.m4a', '.aac',
    '.flac', '.opus', '.weba', '.aif', '.aiff'
  ]),
  svg: new Set(['.svg']),
  font: new Set(['.ttf', '.otf', '.woff', '.woff2']),
  docx: new Set(['.docx', '.docm', '.dotx', '.dotm']),
  officeOnline: new Set([
    '.doc', '.docx', '.docm', '.dotx', '.dotm', '.ppt', '.pptx',
    '.pps', '.ppsx', '.odp', '.odt', '.ott', '.rtf', '.xls', '.xlsx', '.xlsm'
  ]),
  pdf: new Set(['.pdf']),
  binary: new Set([
    '.zip', '.rar', '.7z', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.zst',
    '.jar', '.war', '.ear', '.dmg', '.iso', '.img', '.exe', '.msi', '.dll',
    '.so', '.dylib', '.bin', '.dat', '.sqlite', '.sqlite3', '.db'
  ])
}

const PREVIEW_TYPES = new Set([
  'html', 'markdown', 'svg', 'docx', 'office-online', 'pdf',
  'image', 'video', 'audio', 'font', 'binary', 'spreadsheet'
])

export function buildFilePreviewState(
  filePath: string,
  viewMode?: 'preview' | 'code',
  sshConnectionId?: string,
  sessionId?: string | null,
  projectId?: string | null,
  targetLine?: number,
  targetColumn?: number
): PreviewPanelState {
  const pathWithoutQuery = filePath.split(/[?#]/)[0] ?? filePath
  const ext =
    pathWithoutQuery.lastIndexOf('.') >= 0
      ? pathWithoutQuery.slice(pathWithoutQuery.lastIndexOf('.')).toLowerCase()
      : ''
  const onlineOfficeFile = /^https:\/\/\S+/i.test(filePath)

  let viewerType = 'fallback'
  if (onlineOfficeFile && EXT_SETS.officeOnline.has(ext)) viewerType = 'office-online'
  else if (EXT_SETS.preview.has(ext)) viewerType = 'html'
  else if (EXT_SETS.spreadsheet.has(ext)) viewerType = 'spreadsheet'
  else if (EXT_SETS.markdown.has(ext)) viewerType = 'markdown'
  else if (EXT_SETS.svg.has(ext)) viewerType = 'svg'
  else if (EXT_SETS.image.has(ext)) viewerType = 'image'
  else if (EXT_SETS.video.has(ext)) viewerType = 'video'
  else if (EXT_SETS.audio.has(ext)) viewerType = 'audio'
  else if (EXT_SETS.font.has(ext)) viewerType = 'font'
  else if (EXT_SETS.docx.has(ext)) viewerType = 'docx'
  else if (EXT_SETS.officeOnline.has(ext)) viewerType = 'office-online'
  else if (EXT_SETS.pdf.has(ext)) viewerType = 'pdf'
  else if (EXT_SETS.binary.has(ext)) viewerType = 'binary'

  const defaultMode = PREVIEW_TYPES.has(viewerType) ? 'preview' : 'code'

  return {
    source: 'file',
    filePath,
    viewMode: viewMode ?? (targetLine ? 'code' : defaultMode),
    viewerType,
    sshConnectionId: sshConnectionId || undefined,
    sessionId: sessionId === undefined ? undefined : normalizeScopeId(sessionId),
    projectId: projectId === undefined ? undefined : normalizeScopeId(projectId),
    targetLine,
    targetColumn,
    targetPositionKey: targetLine ? Date.now() : undefined
  }
}

export function previewScopeKey(state: Pick<PreviewPanelState, 'sessionId' | 'projectId'>): string {
  const sessionId = normalizeScopeId(state.sessionId)
  if (sessionId) return `session:${sessionId}`
  const projectId = normalizeScopeId(state.projectId)
  return projectId ? `project:${projectId}` : 'global'
}

export function previewTabId(state: PreviewPanelState): string {
  const scopeKey = previewScopeKey(state)
  if (state.source === 'file') {
    return `file:${scopeKey}:${state.sshConnectionId ?? 'local'}:${state.filePath}`
  }
  if (state.source === 'dev-server') {
    return `dev-server:${scopeKey}:${state.projectDir ?? ''}:${state.port ?? ''}`
  }
  if (state.source === 'diff') {
    const variant = state.gitSection ?? state.agentRunId ?? state.diffSource ?? 'git'
    return `diff:${scopeKey}:${variant}:${state.filePath}`
  }
  return `markdown:${scopeKey}:${state.markdownTitle ?? ''}`
}

export function previewTabTitle(state: PreviewPanelState): string {
  if (state.source === 'markdown') return state.markdownTitle || 'Markdown Preview'
  if (state.source === 'dev-server') return state.port ? `localhost:${state.port}` : 'Dev Server'
  const name = state.filePath.split(/[\\/]/).pop() || state.filePath
  if (state.source === 'diff') return `${name} \u21c4`
  return name
}

export function withPreviewTab(state: PreviewPanelState): PreviewPanelTab {
  return {
    ...state,
    id: previewTabId(state),
    title: previewTabTitle(state)
  }
}

export function withPreviewScope(state: PreviewPanelState, scope: PanelScope): PreviewPanelState {
  return {
    ...state,
    sessionId: scope.sessionId,
    projectId: scope.projectId
  }
}

export function activatePreviewTab(
  tabs: PreviewPanelTab[],
  activeId: string | null
): PreviewPanelTab | null {
  if (!activeId) return null
  return tabs.find((tab) => tab.id === activeId) ?? null
}

export function rightPanelPreviewTabId(previewTabId: string): string {
  return `preview:${previewTabId}`
}
