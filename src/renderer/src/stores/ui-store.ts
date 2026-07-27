import type React from 'react'
import { create } from 'zustand'
import {
  LEFT_SIDEBAR_DEFAULT_WIDTH,
  RIGHT_PANEL_DEFAULT_WIDTH,
  clampLeftSidebarWidth,
  clampRightPanelWidth
} from '@renderer/components/layout/right-panel-defs'
import { useChatStore } from '@renderer/stores/chat-store'
import {
  type BrowserErrorInfo,
  type BrowserPanelSessionState,
  DEFAULT_BROWSER_STATE,
  getBrowserScopeKey,
  getBrowserSessionKey,
  getBrowserStateFromMap,
  isActiveBrowserScope,
  resolvePanelScope,
  updateBrowserStateForSession
} from './browser-session-helpers'
import {
  type PreviewPanelState,
  type PreviewPanelTab,
  buildFilePreviewState,
  previewTabTitle,
  withPreviewTab,
  withPreviewScope,
  activatePreviewTab,
  rightPanelPreviewTabId
} from './preview-panel-helpers'
import { createPreviewPanelSlice } from './preview-panel-slice'
import type { UIStore } from './ui-store-interface'
import {
  CHAT_SURFACE_NAV_RESET,
  closeRightSidePanels,
  ensureRightPanelTabs,
  getDefaultRightPanelTabs
} from './right-panel-tab-factories'

// Re-export types for backward compatibility
export type {
  AppMode,
  AutoModelRoute,
  AutoModelTaskType,
  AutoModelConfidence,
  AutoModelDecisionSource,
  AutoModelRoutingComplexity,
  AutoModelRoutingRisk,
  AutoModelSelectionStatus,
  AutoModelRoutingState,
  ChatView,
  RightPanelSection,
  AgentFilesTab,
  AgentFilesChangeSource,
  RightPanelTabKind,
  RightPanelTabInstance,
  SettingsTab,
  DetailPanelContent
} from './ui-types'
import { RightPanelTabInstance } from './ui-types'
export type { PreviewPanelState, PreviewPanelTab, OpenDiffParams } from './preview-panel-helpers'

// ─── Store Implementation ───



export const useUIStore = create<UIStore>((set, get) => ({
  // Top-level view
  view: 'splash',
  setView: (view) => set({ view }),
  enterMain: () => set({ view: 'main' }),
  openSettings: (tab) => set({ view: 'settings', settingsTab: tab ?? 'provider' }),
  closeSettings: () => set({ view: 'main' }),

  // Selected provider
  selectedProvider: null,
  setSelectedProvider: (provider) => set({ selectedProvider: provider }),

  // Mode
  mode: 'chat',
  setMode: (mode) => set({ mode }),

  // Navigation rail
  activeNavItem: 'chat',
  setActiveNavItem: (item) =>
    set({ activeNavItem: item, leftSidebarOpen: true, ...closeRightSidePanels() }),

  // Left sidebar
  leftSidebarOpen: true,
  leftSidebarWidth: LEFT_SIDEBAR_DEFAULT_WIDTH,
  toggleLeftSidebar: () => set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen, ...closeRightSidePanels() })),
  setLeftSidebarOpen: (open) => set({ leftSidebarOpen: open, ...(open ? closeRightSidePanels() : {}) }),
  setLeftSidebarWidth: (width) => set({ leftSidebarWidth: clampLeftSidebarWidth(width) }),

  // Conversation panel
  conversationPanelFullWidth: false,
  setConversationPanelFullWidth: (fullWidth) => set({ conversationPanelFullWidth: fullWidth }),

  // Right panel
  rightPanelOpen: false,
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  rightPanelWidth: RIGHT_PANEL_DEFAULT_WIDTH,
  setRightPanelWidth: (width) => set({ rightPanelWidth: clampRightPanelWidth(width) }),
  rightPanelTab: 'preview',
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  rightPanelSection: 'execution',
  setRightPanelSection: (section) => set({ rightPanelSection: section }),
  rightPanelTabs: getDefaultRightPanelTabs(),
  rightPanelActiveTabId: '',
  setRightPanelActiveTab: (tabId) => set({ rightPanelActiveTabId: tabId }),
  closeRightPanelTab: (tabId) => {
    const tabs = get().rightPanelTabs.filter((t) => t.id !== tabId)
    const nextActive = tabs.length > 0 ? tabs[Math.max(0, tabs.length - 1)].id : ''
    set({ rightPanelTabs: tabs.length > 0 ? tabs : getDefaultRightPanelTabs(), rightPanelActiveTabId: nextActive })
  },
  rightPanelRailWidth: 48,

  // Runtime status panel
  runtimeStatusPanelOpen: false,
  toggleRuntimeStatusPanel: () => set((state) => ({ runtimeStatusPanelOpen: !state.runtimeStatusPanelOpen })),
  setRuntimeStatusPanelOpen: (open) => set({ runtimeStatusPanelOpen: open }),

  // Auto model selection
  autoModelSelectionsBySession: {},
  autoModelRoutingStatesBySession: {},
  setAutoModelSelection: (sessionId, status) =>
    set((state) => ({
      autoModelSelectionsBySession: { ...state.autoModelSelectionsBySession, [sessionId]: status }
    })),
  setAutoModelRoutingState: (sessionId, status) =>
    set((state) => ({
      autoModelRoutingStatesBySession: { ...state.autoModelRoutingStatesBySession, [sessionId]: status }
    })),

  // Settings page
  settingsPageOpen: false,
  settingsTab: 'provider',
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  openSettingsPage: (tab) => set({ settingsPageOpen: true, settingsTab: tab ?? 'provider' }),
  closeSettingsPage: () => set({ settingsPageOpen: false }),

  // Feature page toggles
  skillsPageOpen: false,
  openSkillsPage: () => set({ skillsPageOpen: true }),
  closeSkillsPage: () => set({ skillsPageOpen: false }),
  soulsPageOpen: false,
  openSoulsPage: () => set({ soulsPageOpen: true }),
  closeSoulsPage: () => set({ soulsPageOpen: false }),
  syncPageOpen: false,
  openSyncPage: () => set({ syncPageOpen: true }),
  closeSyncPage: () => set({ syncPageOpen: false }),
  resourcesPageOpen: false,
  openResourcesPage: () => set({ resourcesPageOpen: true }),
  closeResourcesPage: () => set({ resourcesPageOpen: false }),
  translatePageOpen: false,
  openTranslatePage: () => set({ translatePageOpen: true }),
  closeTranslatePage: () => set({ translatePageOpen: false }),
  drawPageOpen: false,
  openDrawPage: () => set({ drawPageOpen: true }),
  closeDrawPage: () => set({ drawPageOpen: false }),
  tasksPageOpen: false,
  openTasksPage: () => set({ tasksPageOpen: true }),
  closeTasksPage: () => set({ tasksPageOpen: false }),
  codeGraphPageOpen: false,
  openCodeGraphPage: () => set({ codeGraphPageOpen: true }),
  closeCodeGraphPage: () => set({ codeGraphPageOpen: false }),

  // Dialogs
  shortcutsOpen: false,
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  conversationGuideOpen: false,
  setConversationGuideOpen: (open) => set({ conversationGuideOpen: open }),
  changelogDialogOpen: false,
  setChangelogDialogOpen: (open) => set({ changelogDialogOpen: open }),
  pendingInsertText: null,
  setPendingInsertText: (text) => set({ pendingInsertText: text }),

  // Detail panel
  detailPanelOpen: false,
  detailPanelContent: null,
  openDetailPanel: (content) => set({ detailPanelOpen: true, detailPanelContent: content }),
  closeDetailPanel: () => set({ detailPanelOpen: false, detailPanelContent: null }),

  // Agent files
  agentFilesActiveTab: 'files',
  setAgentFilesActiveTab: (tab) => set({ agentFilesActiveTab: tab }),
  agentFilesSelectedChangeKey: null,
  setAgentFilesSelectedChangeKey: (key) => set({ agentFilesSelectedChangeKey: key }),
  agentFilesChangeSource: 'all',
  setAgentFilesChangeSource: (source) => set({ agentFilesChangeSource: source }),

  // Bottom terminal dock
  bottomTerminalDockOpenByProjectId: {},
  setBottomTerminalDockOpen: (projectId, open) =>
    set((state) => ({ bottomTerminalDockOpenByProjectId: { ...state.bottomTerminalDockOpenByProjectId, [projectId]: open } })),
  toggleBottomTerminalDock: (projectId) =>
    set((state) => ({
      bottomTerminalDockOpenByProjectId: {
        ...state.bottomTerminalDockOpenByProjectId,
        [projectId]: !state.bottomTerminalDockOpenByProjectId[projectId]
      }
    })),
  isBottomTerminalDockOpen: (projectId) => {
    if (!projectId) return false
    return !!get().bottomTerminalDockOpenByProjectId[projectId]
  },
  bottomTerminalDockHeight: 220,
  setBottomTerminalDockHeight: (height) => set({ bottomTerminalDockHeight: Math.min(560, Math.max(160, height)) }),

  // SubAgent execution detail
  subAgentExecutionDetailOpen: false,
  subAgentExecutionDetailToolUseId: null,
  subAgentExecutionDetailInlineText: null,
  openSubAgentExecutionDetail: (toolUseId, inlineText, _title, sessionId) =>
    get().ensureSubAgentTab(toolUseId, inlineText ?? null, _title ?? null, sessionId),
  closeSubAgentExecutionDetail: () =>
    set({ subAgentExecutionDetailOpen: false, subAgentExecutionDetailToolUseId: null, subAgentExecutionDetailInlineText: null }),
  selectedSubAgentToolUseId: null,
  setSelectedSubAgentToolUseId: (toolUseId) => set({ selectedSubAgentToolUseId: toolUseId }),

  // Orchestration console
  selectedOrchestrationRunId: null,
  setSelectedOrchestrationRunId: (runId) => set({ selectedOrchestrationRunId: runId }),
  selectedOrchestrationMemberId: null,
  setSelectedOrchestrationMemberId: (memberId) => set({ selectedOrchestrationMemberId: memberId }),
  orchestrationConsoleOpen: false,
  orchestrationConsoleView: 'overview',
  openOrchestrationPanel: (runId, memberId) =>
    set({ orchestrationConsoleOpen: true, selectedOrchestrationRunId: runId ?? null, selectedOrchestrationMemberId: memberId ?? null }),
  closeOrchestrationPanel: () => set({ orchestrationConsoleOpen: false }),
  openOrchestrationMember: (runId, memberId) => set({ orchestrationConsoleOpen: true, selectedOrchestrationRunId: runId, selectedOrchestrationMemberId: memberId }),

  // Plan mode
  planMode: false,
  enterPlanMode: () => set({ planMode: true }),
  exitPlanMode: () => set({ planMode: false }),
  planModesBySession: {},
  isPlanModeEnabled: (sessionId) => {
    if (!sessionId) return get().planMode
    return get().planModesBySession[sessionId] ?? false
  },

  // Browser panel (session-scoped)
  browserStatesBySession: {},
  browserWebviewRefsBySession: {},
  browserUrl: '',
  setBrowserUrl: (url, sessionId, projectId) =>
    set((state) => updateBrowserStateForSession(state, sessionId, { url }, projectId)),
  browserLoading: false,
  setBrowserLoading: (loading, sessionId, projectId) =>
    set((state) => updateBrowserStateForSession(state, sessionId, { loading }, projectId)),
  browserPageTitle: '',
  setBrowserPageTitle: (pageTitle, sessionId, projectId) =>
    set((state) => updateBrowserStateForSession(state, sessionId, { pageTitle }, projectId)),
  browserCanGoBack: false,
  setBrowserCanGoBack: (canGoBack, sessionId, projectId) =>
    set((state) => updateBrowserStateForSession(state, sessionId, { canGoBack }, projectId)),
  browserCanGoForward: false,
  setBrowserCanGoForward: (canGoForward, sessionId, projectId) =>
    set((state) => updateBrowserStateForSession(state, sessionId, { canGoForward }, projectId)),
  browserErrorInfo: null,
  setBrowserErrorInfo: (errorInfo, sessionId, projectId) =>
    set((state) => updateBrowserStateForSession(state, sessionId, { errorInfo }, projectId)),
  browserWebviewRef: null,

  // Selected files
  selectedFiles: [],
  setSelectedFiles: (files) => set({ selectedFiles: files }),
  toggleFileSelection: (filePath) =>
    set((state) => ({
      selectedFiles: state.selectedFiles.includes(filePath)
        ? state.selectedFiles.filter((f) => f !== filePath)
        : [...state.selectedFiles, filePath]
    })),
  clearSelectedFiles: () => set({ selectedFiles: [] }),

  // Preview panel (extracted to preview-panel-slice.ts)
  ...createPreviewPanelSlice(set, get),

  // Hovering state
  isHoveringRightPanel: false,
  setIsHoveringRightPanel: (hovering) => set({ isHoveringRightPanel: hovering }),
  runtimeStatusPanelTriggerHovered: false,
  setRuntimeStatusPanelTriggerHovered: (hovering) => set({ runtimeStatusPanelTriggerHovered: hovering }),

  // Session-scoped state
  activeScopedSessionId: null,
  activeScopedProjectId: null,
  syncSessionScopedState: (sessionId, projectId) =>
    set({ activeScopedSessionId: sessionId, activeScopedProjectId: projectId ?? null }),
  messageListViewStatesBySession: {},
  setMessageListViewState: (sessionId, state) =>
    set((s) => ({
      messageListViewStatesBySession: {
        ...s.messageListViewStatesBySession,
        [sessionId]: state ?? undefined
      }
    })),
  getMessageListViewState: (sessionId) => {
    if (!sessionId) return null
    return get().messageListViewStatesBySession[sessionId] ?? null
  },
  releaseDormantSessionUiState: (sessionId) => {
    if (!sessionId) return
    set((s) => {
      const next = { ...s.messageListViewStatesBySession }
      delete next[sessionId]
      return { messageListViewStatesBySession: next }
    })
  },

  // Chat view navigation
  chatView: 'home',
  navigateToHome: () => {
    if (useChatStore.getState().activeSessionId) {
      useChatStore.getState().setActiveSession(null)
    }
    set({ activeNavItem: 'chat', chatView: 'home', ...CHAT_SURFACE_NAV_RESET })
  },
  navigateToProject: (projectId) => {
    const resolvedProjectId = projectId ?? useChatStore.getState().activeProjectId ?? null
    set({ activeNavItem: 'chat', chatView: 'project', ...CHAT_SURFACE_NAV_RESET })
    void resolvedProjectId
  },
  navigateToArchive: (projectId) => {
    const resolvedProjectId = projectId ?? useChatStore.getState().activeProjectId ?? null
    set({ activeNavItem: 'chat', chatView: 'archive', ...CHAT_SURFACE_NAV_RESET })
    void resolvedProjectId
  },
  navigateToChannels: (projectId) => {
    const resolvedProjectId = projectId ?? useChatStore.getState().activeProjectId ?? null
    set({ activeNavItem: 'chat', chatView: 'channels', ...CHAT_SURFACE_NAV_RESET })
    void resolvedProjectId
  },
  navigateToGit: (projectId) => {
    const resolvedProjectId = projectId ?? useChatStore.getState().activeProjectId ?? null
    set({ activeNavItem: 'chat', chatView: 'git', ...CHAT_SURFACE_NAV_RESET })
    void resolvedProjectId
  },
  navigateToPersona: (projectId) => {
    const resolvedProjectId = projectId ?? useChatStore.getState().activeProjectId ?? null
    set({ activeNavItem: 'chat', chatView: 'persona', ...CHAT_SURFACE_NAV_RESET })
    void resolvedProjectId
  },
  navigateToSession: (sessionId) => {
    const store = useChatStore.getState()
    const resolvedSessionId = sessionId ?? store.activeSessionId ?? null
    if (resolvedSessionId) {
      store.setActiveSession(resolvedSessionId)
    }
    set({ activeNavItem: 'chat', chatView: 'session', ...CHAT_SURFACE_NAV_RESET })
  },
  applyRouteFromLocation: () => {
    // Placeholder: no URL routing for now. Navigation is driven by state.
  },
  applyChatRouteFromLocation: () => {
    // Placeholder - will be implemented when routing is migrated
  },

  // Browser tab management
  ensureBrowserTab: (url, sessionId, projectId, options) =>
    set((state) => {
      const existing = state.rightPanelTabs.find((tab) => tab.kind === 'browser')
      const tab: RightPanelTabInstance = existing ?? {
        id: 'browser',
        kind: 'browser',
        title: 'Browser',
        closable: true,
        createdAt: Date.now()
      }
      const rightPanelTabs = existing
        ? ensureRightPanelTabs(state.rightPanelTabs)
        : ensureRightPanelTabs([...state.rightPanelTabs, tab])
      const browserStatePatch = updateBrowserStateForSession(
        state,
        sessionId,
        {
          errorInfo: null,
          ...(url !== undefined ? { url } : {})
        },
        projectId
      )
      if (options?.background) {
        return {
          rightPanelTabs,
          ...browserStatePatch
        }
      }
      return {
        rightPanelTabs,
        rightPanelActiveTabId: tab.id,
        rightPanelOpen: true,
        ...browserStatePatch
      }
    }),

  ensureSubAgentTab: (toolUseId, inlineText, _title, requestedSessionId) =>
    set((state) => {
      const sessionId =
        normalizeScopeId(requestedSessionId) ??
        state.activeScopedSessionId ??
        useChatStore.getState().activeSessionId ??
        null
      const tabScopeId = sessionId ?? 'global'
      const tabId = `subagent:${tabScopeId}:overview`
      const existing = state.rightPanelTabs.find(
        (tab) => tab.kind === 'subagent' && (tab.sessionId ?? null) === sessionId
      )
      const tab: RightPanelTabInstance = existing
        ? {
            ...existing,
            id: tabId,
            sessionId: sessionId ?? existing.sessionId ?? null,
            title: 'SubAgents',
            toolUseId: toolUseId ?? null,
            inlineText: inlineText?.trim() ? inlineText : null
          }
        : {
            id: tabId,
            kind: 'subagent',
            title: 'SubAgents',
            closable: true,
            sessionId,
            toolUseId: toolUseId ?? null,
            inlineText: inlineText?.trim() ? inlineText : null,
            createdAt: Date.now()
          }
      const tabsWithoutScopedDuplicates = state.rightPanelTabs.filter(
        (item) =>
          item.kind !== 'subagent' ||
          item === existing ||
          (item.sessionId ?? null) !== sessionId
      )
      const rightPanelTabs = ensureRightPanelTabs(
        existing
          ? tabsWithoutScopedDuplicates.map((item) => (item === existing ? tab : item))
          : [...tabsWithoutScopedDuplicates, tab]
      )
      return {
        selectedSubAgentToolUseId: toolUseId ?? null,
        subAgentExecutionDetailOpen: false,
        subAgentExecutionDetailToolUseId: toolUseId ?? null,
        subAgentExecutionDetailInlineText: inlineText?.trim() ? inlineText : null,
        rightPanelTabs,
        rightPanelActiveTabId: tabId,
        rightPanelOpen: true
      }
    }),

  openSubAgentsPanel: (toolUseId, sessionId) =>
    get().ensureSubAgentTab(toolUseId ?? null, null, null, sessionId),

  getBrowserState: (sessionId, projectId) => {
    const state = get()
    const scope = resolvePanelScope(state, sessionId, projectId)
    return getBrowserStateFromMap(
      state.browserStatesBySession,
      scope.sessionId,
      scope.projectId
    )
  },

  patchBrowserState: (sessionId, patch, projectId) =>
    set((state) => updateBrowserStateForSession(state, sessionId, patch, projectId)),

  openBrowserTab: (url, sessionId, projectId, options) =>
    get().ensureBrowserTab(url, sessionId, projectId, options),

  getBrowserWebviewRef: (sessionId, projectId) => {
    const state = get()
    const scope = resolvePanelScope(state, sessionId, projectId)
    return state.browserWebviewRefsBySession[getBrowserScopeKey(scope)] ?? null
  },

  setBrowserWebviewRef: (ref, sessionId, projectId) =>
    set((state) => {
      const scope = resolvePanelScope(state, sessionId, projectId)
      const key = getBrowserScopeKey(scope)
      const browserWebviewRefsBySession = { ...state.browserWebviewRefsBySession }
      if (ref) {
        browserWebviewRefsBySession[key] = ref
      } else {
        delete browserWebviewRefsBySession[key]
      }
      return {
        browserWebviewRefsBySession,
        ...(isActiveBrowserScope(state, scope) ? { browserWebviewRef: ref } : {})
      }
    }),
}))
