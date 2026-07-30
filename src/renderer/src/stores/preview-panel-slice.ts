// Preview panel store slice — extracted from ui-store.ts
// Contains all PreviewPanel state and methods to keep ui-store.ts under 500 lines

import type { UIStore } from './ui-store-interface'
import type { RightPanelTabInstance } from './ui-types'
import {
  buildFilePreviewState,
  previewTabTitle,
  withPreviewTab,
  withPreviewScope,
  activatePreviewTab,
  rightPanelPreviewTabId
} from './preview-panel-helpers'
import { resolvePanelScope } from './browser-session-helpers'
import { ensureRightPanelTabs } from './right-panel-tab-factories'

type SetFn = (partial: Partial<UIStore> | ((state: UIStore) => Partial<UIStore>)) => void
type GetFn = () => UIStore

export function createPreviewPanelSlice(set: SetFn, get: GetFn) {
  return {
      previewPanelOpen: false,
      previewPanelState: null,
      previewPanelTabs: [],
      activePreviewPanelTabId: null,
      openPreviewTab: (previewState: any, preserveExistingViewMode = false, mirrorToRightPanel = true) =>
        set((state: any) => {
          const scope = resolvePanelScope(state, previewState.sessionId, previewState.projectId)
          const scopedPreviewState = withPreviewScope(previewState, scope)
          const nextTab = withPreviewTab(scopedPreviewState)
          const existing = state.previewPanelTabs.find((tab: any) => tab.id === nextTab.id)
          const nextTabs = existing
            ? state.previewPanelTabs.map((tab: any) =>
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
            (tab: any) => tab.id === previewRightPanelTabId
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
              ? state.rightPanelTabs.map((tab: any) =>
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
      openDiff: (params: any) =>
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
      openDevServerPreview: (projectDir: any, port: any, sessionId: any) =>
        get().openPreviewTab({
          source: 'dev-server',
          filePath: '',
          viewMode: 'preview',
          viewerType: 'dev-server',
          port,
          projectDir,
          sessionId
        }),
      openMarkdownPreview: (title: any, content: any, sessionId: any) =>
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
      closePreviewTab: (tabId: any) =>
        set((state: any) => {
          const index = state.previewPanelTabs.findIndex((tab: any) => tab.id === tabId)
          if (index < 0) return {}
          const nextTabs = state.previewPanelTabs.filter((tab: any) => tab.id !== tabId)
          const rpTabId = rightPanelPreviewTabId(tabId)
          const nextRightPanelTabs = ensureRightPanelTabs(
            state.rightPanelTabs.filter((tab: any) => tab.id !== rpTabId)
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
                    : '')
                : state.rightPanelActiveTabId
          }
        }),
      setActivePreviewTab: (tabId: any) =>
        set((state: any) => {
          const rpTabId = tabId ? rightPanelPreviewTabId(tabId) : null
          return {
            activePreviewPanelTabId: tabId,
            previewPanelState: activatePreviewTab(state.previewPanelTabs, tabId),
            previewPanelOpen: tabId ? true : state.previewPanelOpen,
            detailPanelOpen: tabId ? false : state.detailPanelOpen,
            detailPanelContent: tabId ? null : state.detailPanelContent,
            ...(rpTabId && state.rightPanelTabs.some((tab: any) => tab.id === rpTabId)
              ? {
                  rightPanelActiveTabId: rpTabId,
                  rightPanelOpen: true
                }
              : {})
          }
        }),
      updatePreviewTab: (tabId: any, patch: any) =>
        set((state: any) => {
          const nextTabs = state.previewPanelTabs.map((tab: any) =>
            tab.id === tabId ? { ...tab, ...patch } : tab
          )
          const updatedTab = nextTabs.find((tab: any) => tab.id === tabId)
          const rpTabId = rightPanelPreviewTabId(tabId)
          return {
            previewPanelTabs: nextTabs,
            previewPanelState: activatePreviewTab(nextTabs, state.activePreviewPanelTabId),
            rightPanelTabs: updatedTab
              ? state.rightPanelTabs.map((tab: any) =>
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
      openFilePreview: (filePath: any, viewMode: any, sshConnectionId: any, sessionId: any, targetLine: any, targetColumn: any) =>
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
      setPreviewViewMode: (mode: any) =>
        set((state: any) => ({
          previewPanelTabs: state.previewPanelTabs.map((tab: any) =>
            tab.id === state.activePreviewPanelTabId ? { ...tab, viewMode: mode } : tab
          ),
          previewPanelState: state.previewPanelState
            ? { ...state.previewPanelState, viewMode: mode }
            : null
        })),
  }
}
