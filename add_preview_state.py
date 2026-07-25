"""
Add PreviewPanel state to wishful-claw's ui-store system.

Creates:
  - stores/preview-panel-helpers.ts — PreviewPanelState, PreviewPanelTab types + helper functions
Modifies:
  - stores/ui-types.ts — add PreviewSource, DiffSource, GitChangeSection types
  - stores/ui-store-interface.ts — add PreviewPanel fields/methods to UIStore interface
  - stores/ui-store.ts — add PreviewPanel state implementation + fix openFilePreview
"""
import pathlib

# --- 1. Create preview-panel-helpers.ts ---
helpers_content = """// Preview panel state types and helper functions
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
  const onlineOfficeFile = /^https:\/\/\\S+/i.test(filePath)

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
  const name = state.filePath.split(/[\\\\/]/).pop() || state.filePath
  if (state.source === 'diff') return `${name} \\u21c4`
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
"""

pathlib.Path('src/renderer/src/stores/preview-panel-helpers.ts').write_text(
    helpers_content, encoding='utf-8'
)
print("Created preview-panel-helpers.ts")

# --- 2. Add types to ui-types.ts ---
types_path = pathlib.Path('src/renderer/src/stores/ui-types.ts')
types_content = types_path.read_text(encoding='utf-8-sig')

# Add PreviewSource, DiffSource, GitChangeSection before the DetailPanelContent type
new_types = """export type PreviewSource = 'file' | 'dev-server' | 'markdown' | 'diff'
export type DiffSource = 'git' | 'agent'
export type GitChangeSection = 'staged' | 'unstaged' | 'untracked' | 'conflicted'

export type DetailPanelContent ="""

types_content = types_content.replace(
    "export type DetailPanelContent =",
    new_types
)

# Also add MessageListViewState export (it's currently private)
if 'export interface MessageListViewState' not in types_content:
    types_content = types_content.replace(
        'interface MessageListViewState {',
        'export interface MessageListViewState {'
    )

types_path.write_text(types_content, encoding='utf-8')
print("Updated ui-types.ts")

# --- 3. Add PreviewPanel fields to ui-store-interface.ts ---
iface_path = pathlib.Path('src/renderer/src/stores/ui-store-interface.ts')
iface_content = iface_path.read_text(encoding='utf-8-sig')

# Add imports
old_import = "import type { BrowserErrorInfo, BrowserPanelSessionState } from './browser-session-helpers'"
new_import = """import type { BrowserErrorInfo, BrowserPanelSessionState } from './browser-session-helpers'
import type { PreviewPanelState, PreviewPanelTab, OpenDiffParams } from './preview-panel-helpers'"""
iface_content = iface_content.replace(old_import, new_import)

# Replace the stub openFilePreview with full PreviewPanel interface
old_preview = """  // File preview
  openFilePreview: (
    filePath: string,
    viewMode?: 'split' | 'inline' | 'preview' | 'code',
    sshConnectionId?: string | null,
    sessionId?: string | null,
    targetLine?: number,
    targetColumn?: number
  ) => void"""

new_preview = """  // Preview panel
  previewPanelOpen: boolean
  previewPanelState: PreviewPanelTab | null
  previewPanelTabs: PreviewPanelTab[]
  activePreviewPanelTabId: string | null
  openFilePreview: (
    filePath: string,
    viewMode?: 'preview' | 'code',
    sshConnectionId?: string | null,
    sessionId?: string | null,
    targetLine?: number,
    targetColumn?: number
  ) => void
  openPreviewTab: (
    state: PreviewPanelState,
    preserveExistingViewMode?: boolean,
    mirrorToRightPanel?: boolean
  ) => void
  openDiff: (params: OpenDiffParams) => void
  openDevServerPreview: (projectDir: string, port: number, sessionId?: string | null) => void
  openMarkdownPreview: (title: string, content: string, sessionId?: string | null) => void
  closePreviewTab: (tabId: string) => void
  closePreviewPanel: () => void
  setActivePreviewTab: (tabId: string | null) => void
  updatePreviewTab: (tabId: string, patch: Partial<PreviewPanelTab>) => void
  setPreviewViewMode: (mode: 'preview' | 'code', sessionId?: string | null) => void"""

iface_content = iface_content.replace(old_preview, new_preview)

iface_path.write_text(iface_content, encoding='utf-8')
print("Updated ui-store-interface.ts")

# --- 4. Add implementation to ui-store.ts ---
store_path = pathlib.Path('src/renderer/src/stores/ui-store.ts')
store_content = store_path.read_text(encoding='utf-8-sig')

# Add import for preview-panel-helpers
old_browser_import = "} from './browser-session-helpers'"
new_imports_block = """} from './browser-session-helpers'
import {
  type PreviewPanelState,
  type PreviewPanelTab,
  buildFilePreviewState,
  previewTabTitle,
  withPreviewTab,
  withPreviewScope,
  activatePreviewTab,
  rightPanelPreviewTabId
} from './preview-panel-helpers'"""
store_content = store_content.replace(
    old_browser_import,
    new_imports_block,
    1  # only first occurrence
)

# Also add PanelScope import from browser-session-helpers (needed by preview-panel-helpers, not directly by ui-store)
# No change needed - preview-panel-helpers imports PanelScope itself

# Replace the stub openFilePreview + openMarkdownPreview with full implementation
old_impl = """  // File preview (stub — opens file via shell)
  openFilePreview: (filePath) => {
    // Stub: will be implemented with proper preview panel later
    console.log('[UIStore] openFilePreview stub:', filePath)
  },
  openMarkdownPreview: (_title, _content, _sessionId) => {
    // Stub: will be implemented with proper preview panel later
  },"""

new_impl = """  // Preview panel
  previewPanelOpen: false,
  previewPanelState: null,
  previewPanelTabs: [],
  activePreviewPanelTabId: null,
  openPreviewTab: (previewState, preserveExistingViewMode = false, mirrorToRightPanel = true) =>
    set((state) => {
      const scope = resolvePanelScope(state, previewState.sessionId, previewState.projectId)
      const scopedPreviewState = withPreviewScope(previewState, scope)
      const nextTab = withPreviewTab(scopedPreviewState)
      const existing = state.previewPanelTabs.find((tab) => tab.id === nextTab.id)
      const nextTabs = existing
        ? state.previewPanelTabs.map((tab) =>
            tab.id === nextTab.id
              ? {
                  ...tab,
                  ...nextTab,
                  viewMode: preserveExistingViewMode ? tab.viewMode : nextTab.viewMode,
                  modified: tab.modified,
                  draftContent: tab.draftContent
                }
              : tab
          )
        : [...state.previewPanelTabs, nextTab]
      const activePreviewPanelTabId = nextTab.id
      const previewBase = {
        previewPanelOpen: true,
        previewPanelTabs: nextTabs,
        activePreviewPanelTabId,
        previewPanelState: activatePreviewTab(nextTabs, activePreviewPanelTabId),
        detailPanelOpen: false,
        detailPanelContent: null
      }
      if (!mirrorToRightPanel) return previewBase

      const previewRightPanelTabId = rightPanelPreviewTabId(nextTab.id)
      const existingRightPanelTab = state.rightPanelTabs.find(
        (tab) => tab.id === previewRightPanelTabId
      )
      const rightPanelTab: RightPanelTabInstance = {
        ...(existingRightPanelTab ?? {
          id: previewRightPanelTabId,
          kind: 'preview' as const,
          closable: true,
          createdAt: Date.now()
        }),
        title: previewTabTitle(nextTab),
        sessionId: scope.sessionId,
        projectId: scope.projectId,
        previewTabId: nextTab.id,
        modified: existing?.modified ?? nextTab.modified ?? false
      }
      const rightPanelTabs = ensureRightPanelTabs(
        existingRightPanelTab
          ? state.rightPanelTabs.map((tab) =>
              tab.id === previewRightPanelTabId ? rightPanelTab : tab
            )
          : [...state.rightPanelTabs, rightPanelTab]
      )
      return {
        ...previewBase,
        rightPanelTabs,
        rightPanelActiveTabId: previewRightPanelTabId,
        rightPanelOpen: true
      }
    }),
  openDiff: (params) =>
    get().openPreviewTab(
      {
        source: 'diff',
        filePath: params.filePath,
        viewMode: 'code',
        viewerType: 'diff',
        sshConnectionId: params.sshConnectionId || undefined,
        sessionId: params.sessionId,
        projectId: params.projectId,
        diffSource: params.diffSource,
        diffOriginal: params.original,
        diffModified: params.modified,
        diffLanguage: params.language,
        diffModifiedEditable: params.modifiedEditable ?? false,
        diffIsBinary: params.isBinary ?? false,
        diffOriginalRef: params.diffOriginalRef,
        gitRepoPath: params.gitRepoPath,
        gitSection: params.gitSection,
        agentRunId: params.agentRunId,
        agentChangeId: params.agentChangeId
      },
      false,
      params.mirrorToRightPanel ?? true
    ),
  openDevServerPreview: (projectDir, port, sessionId) =>
    get().openPreviewTab({
      source: 'dev-server',
      filePath: '',
      viewMode: 'preview',
      viewerType: 'dev-server',
      port,
      projectDir,
      sessionId
    }),
  openMarkdownPreview: (title, content, sessionId) =>
    get().openPreviewTab({
      source: 'markdown',
      filePath: '',
      viewMode: 'preview',
      viewerType: 'markdown',
      markdownContent: content,
      markdownTitle: title,
      sessionId
    }),
  closePreviewPanel: () => set({ previewPanelOpen: false }),
  closePreviewTab: (tabId) =>
    set((state) => {
      const index = state.previewPanelTabs.findIndex((tab) => tab.id === tabId)
      if (index < 0) return {}
      const nextTabs = state.previewPanelTabs.filter((tab) => tab.id !== tabId)
      const rpTabId = rightPanelPreviewTabId(tabId)
      const nextRightPanelTabs = ensureRightPanelTabs(
        state.rightPanelTabs.filter((tab) => tab.id !== rpTabId)
      )
      const nextActiveId =
        state.activePreviewPanelTabId === tabId
          ? (nextTabs[Math.min(index, nextTabs.length - 1)]?.id ?? null)
          : state.activePreviewPanelTabId
      return {
        previewPanelTabs: nextTabs,
        activePreviewPanelTabId: nextActiveId,
        previewPanelState: activatePreviewTab(nextTabs, nextActiveId),
        previewPanelOpen: nextTabs.length > 0 ? state.previewPanelOpen : false,
        rightPanelTabs: nextRightPanelTabs,
        rightPanelActiveTabId:
          state.rightPanelActiveTabId === rpTabId
            ? (nextRightPanelTabs.length > 0
                ? nextRightPanelTabs[nextRightPanelTabs.length - 1].id
                : 'activity')
            : state.rightPanelActiveTabId
      }
    }),
  setActivePreviewTab: (tabId) =>
    set((state) => {
      const rpTabId = tabId ? rightPanelPreviewTabId(tabId) : null
      return {
        activePreviewPanelTabId: tabId,
        previewPanelState: activatePreviewTab(state.previewPanelTabs, tabId),
        previewPanelOpen: tabId ? true : state.previewPanelOpen,
        detailPanelOpen: tabId ? false : state.detailPanelOpen,
        detailPanelContent: tabId ? null : state.detailPanelContent,
        ...(rpTabId && state.rightPanelTabs.some((tab) => tab.id === rpTabId)
          ? {
              rightPanelActiveTabId: rpTabId,
              rightPanelOpen: true
            }
          : {})
      }
    }),
  updatePreviewTab: (tabId, patch) =>
    set((state) => {
      const nextTabs = state.previewPanelTabs.map((tab) =>
        tab.id === tabId ? { ...tab, ...patch } : tab
      )
      const updatedTab = nextTabs.find((tab) => tab.id === tabId)
      const rpTabId = rightPanelPreviewTabId(tabId)
      return {
        previewPanelTabs: nextTabs,
        previewPanelState: activatePreviewTab(nextTabs, state.activePreviewPanelTabId),
        rightPanelTabs: updatedTab
          ? state.rightPanelTabs.map((tab) =>
              tab.id === rpTabId
                ? {
                    ...tab,
                    title: previewTabTitle(updatedTab),
                    modified: updatedTab.modified ?? false
                  }
                : tab
            )
          : state.rightPanelTabs
      }
    }),
  openFilePreview: (filePath, viewMode, sshConnectionId, sessionId, targetLine, targetColumn) =>
    get().openPreviewTab(
      buildFilePreviewState(
        filePath,
        viewMode === 'split' || viewMode === 'inline' ? undefined : viewMode,
        sshConnectionId,
        sessionId,
        undefined,
        targetLine,
        targetColumn
      ),
      viewMode === undefined && !targetLine
    ),
  setPreviewViewMode: (mode) =>
    set((state) => ({
      previewPanelTabs: state.previewPanelTabs.map((tab) =>
        tab.id === state.activePreviewPanelTabId ? { ...tab, viewMode: mode } : tab
      ),
      previewPanelState: state.previewPanelState
        ? { ...state.previewPanelState, viewMode: mode }
        : null
    })),"""

store_content = store_content.replace(old_impl, new_impl)

# Also re-export PreviewPanelTab for backward compat
old_reexport = "  DetailPanelContent\n} from './ui-types'"
new_reexport = "  DetailPanelContent\n} from './ui-types'\nexport type { PreviewPanelState, PreviewPanelTab, OpenDiffParams } from './preview-panel-helpers'"
store_content = store_content.replace(old_reexport, new_reexport)

store_path.write_text(store_content, encoding='utf-8')
print("Updated ui-store.ts")

print("\nDone! Run tsc to verify.")
