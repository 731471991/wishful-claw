import { create } from 'zustand'
import {
  LEFT_SIDEBAR_DEFAULT_WIDTH,
  RIGHT_PANEL_DEFAULT_WIDTH,
  clampLeftSidebarWidth,
  clampRightPanelWidth
} from '@renderer/components/layout/right-panel-defs'
import { useChatStore } from '@renderer/stores/chat-store'
import { getBrowserScopeKey, getBrowserStateFromMap, isActiveBrowserScope, resolvePanelScope, updateBrowserStateForSession } from './browser-session-helpers'
import { createPreviewPanelSlice } from './preview-panel-slice'
import type { UIStore } from './ui-store-interface'
import { CHAT_SURFACE_NAV_RESET, ensureRightPanelTabs, getDefaultRightPanelTabs } from './right-panel-tab-factories'

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
  setView: (view: any) => set({ view }),
  enterMain: () => set({ view: 'main' }),
  openSettings: (tab: any) => set({ view: 'settings', settingsTab: tab ?? 'provider' }),
  closeSettings: () => set({ view: 'main' }),

  // Selected provider
  selectedProvider: null,
  setSelectedProvider: (provider: any) => set({ selectedProvider: provider }),

  // Mode
  mode: 'chat',
  setMode: (mode: any) => set({ mode }),

  // Navigation rail
  activeNavItem: 'chat',
  setActiveNavItem: (item: any) =>
    set({ activeNavItem: item, leftSidebarOpen: true }),

  // Left sidebar
  leftSidebarOpen: true,
  leftSidebarWidth: LEFT_SIDEBAR_DEFAULT_WIDTH,
  toggleLeftSidebar: () => set((state: any) => ({ leftSidebarOpen: !state.leftSidebarOpen })),
  setLeftSidebarOpen: (open: any) => set({ leftSidebarOpen: open }),
  setLeftSidebarWidth: (width: any) => set({ leftSidebarWidth: clampLeftSidebarWidth(width) }),

  // Conversation panel
  conversationPanelFullWidth: false,
  setConversationPanelFullWidth: (fullWidth: any) => set({ conversationPanelFullWidth: fullWidth }),

  // Right panel
  rightPanelOpen: false,
  toggleRightPanel: () => set((state: any) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setRightPanelOpen: (open: any) => set({ rightPanelOpen: open }),
  rightPanelWidth: RIGHT_PANEL_DEFAULT_WIDTH,
  setRightPanelWidth: (width: any) => set({ rightPanelWidth: clampRightPanelWidth(width) }),
  rightPanelTab: 'preview',
  setRightPanelTab: (tab: any) => set({ rightPanelTab: tab }),
  rightPanelSection: 'execution',
  setRightPanelSection: (section: any) => set({ rightPanelSection: section }),
  rightPanelTabs: getDefaultRightPanelTabs(),
  rightPanelActiveTabId: '',
  setRightPanelActiveTab: (tabId: any) => set({ rightPanelActiveTabId: tabId }),
  closeRightPanelTab: (tabId: any) => {
    const tabs = get().rightPanelTabs.filter((t: any) => t.id !== tabId)
    if (tabs.length === 0) {
      // Last tab closed — collapse the right panel
      set({ rightPanelTabs: [], rightPanelActiveTabId: '', rightPanelOpen: false })
      return
    }
    const nextActive = tabs[Math.max(0, tabs.length - 1)].id
    set({ rightPanelTabs: tabs, rightPanelActiveTabId: nextActive })
  },
  rightPanelRailWidth: 48,

  // Runtime status panel
  runtimeStatusPanelOpen: false,
  toggleRuntimeStatusPanel: () => set((state: any) => ({ runtimeStatusPanelOpen: !state.runtimeStatusPanelOpen })),
  setRuntimeStatusPanelOpen: (open: any) => set({ runtimeStatusPanelOpen: open }),

  // Auto model selection
  autoModelSelectionsBySession: {},
  autoModelRoutingStatesBySession: {},
  setAutoModelSelection: (sessionId: any, status: any) =>
    set((state: any) => ({
      autoModelSelectionsBySession: { ...state.autoModelSelectionsBySession, [sessionId]: status }
    })),
  setAutoModelRoutingState: (sessionId: any, status: any) =>
    set((state: any) => ({
      autoModelRoutingStatesBySession: { ...state.autoModelRoutingStatesBySession, [sessionId]: status }
    })),

  // Settings page
  settingsPageOpen: false,
  settingsTab: 'provider',
  setSettingsTab: (tab: any) => set({ settingsTab: tab }),
  openSettingsPage: (tab: any) => set({ settingsPageOpen: true, settingsTab: tab ?? 'provider' }),
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
  setShortcutsOpen: (open: any) => set({ shortcutsOpen: open }),
  conversationGuideOpen: false,
  setConversationGuideOpen: (open: any) => set({ conversationGuideOpen: open }),
  changelogDialogOpen: false,
  setChangelogDialogOpen: (open: any) => set({ changelogDialogOpen: open }),
  pendingInsertText: null,
  setPendingInsertText: (text: any) => set({ pendingInsertText: text }),

  // Detail panel
  detailPanelOpen: false,
  detailPanelContent: null,
  openDetailPanel: (content: any) => set({ detailPanelOpen: true, detailPanelContent: content }),
  closeDetailPanel: () => set({ detailPanelOpen: false, detailPanelContent: null }),

  // Agent files
  agentFilesActiveTab: 'files',
  setAgentFilesActiveTab: (tab: any) => set({ agentFilesActiveTab: tab }),
  agentFilesSelectedChangeKey: null,
  setAgentFilesSelectedChangeKey: (key: any) => set({ agentFilesSelectedChangeKey: key }),
  agentFilesChangeSource: 'all',
  setAgentFilesChangeSource: (source: any) => set({ agentFilesChangeSource: source }),

  // Bottom terminal dock
  bottomTerminalDockOpenByProjectId: {},
  setBottomTerminalDockOpen: (projectId: any, open: any) =>
    set((state: any) => ({ bottomTerminalDockOpenByProjectId: { ...state.bottomTerminalDockOpenByProjectId, [projectId]: open } })),
  toggleBottomTerminalDock: (projectId: any) =>
    set((state: any) => ({
      bottomTerminalDockOpenByProjectId: {
        ...state.bottomTerminalDockOpenByProjectId,
        [projectId]: !state.bottomTerminalDockOpenByProjectId[projectId]
      }
    })),
  isBottomTerminalDockOpen: (projectId: any) => {
    if (!projectId) return false
    return !!get().bottomTerminalDockOpenByProjectId[projectId]
  },
  bottomTerminalDockHeight: 220,
  setBottomTerminalDockHeight: (height: any) => set({ bottomTerminalDockHeight: Math.min(560, Math.max(160, height)) }),

  // SubAgent execution detail
  subAgentExecutionDetailOpen: false,
  subAgentExecutionDetailToolUseId: null,
  subAgentExecutionDetailInlineText: null,
  openSubAgentExecutionDetail: (toolUseId: any, inlineText: any, _title: any, sessionId: any) =>
    get().ensureSubAgentTab(toolUseId, inlineText ?? null, _title ?? null, sessionId),
  closeSubAgentExecutionDetail: () =>
    set({ subAgentExecutionDetailOpen: false, subAgentExecutionDetailToolUseId: null, subAgentExecutionDetailInlineText: null }),
  selectedSubAgentToolUseId: null,
  setSelectedSubAgentToolUseId: (toolUseId: any) => set({ selectedSubAgentToolUseId: toolUseId }),

  // Orchestration console
  selectedOrchestrationRunId: null,
  setSelectedOrchestrationRunId: (runId: any) => set({ selectedOrchestrationRunId: runId }),
  selectedOrchestrationMemberId: null,
  setSelectedOrchestrationMemberId: (memberId: any) => set({ selectedOrchestrationMemberId: memberId }),
  orchestrationConsoleOpen: false,
  orchestrationConsoleView: 'overview',
  openOrchestrationPanel: (runId: any, memberId: any) =>
    set({ orchestrationConsoleOpen: true, selectedOrchestrationRunId: runId ?? null, selectedOrchestrationMemberId: memberId ?? null }),
  closeOrchestrationPanel: () => set({ orchestrationConsoleOpen: false }),
  openOrchestrationMember: (runId: any, memberId: any) => set({ orchestrationConsoleOpen: true, selectedOrchestrationRunId: runId, selectedOrchestrationMemberId: memberId }),

  // Plan mode
  planMode: false,
  enterPlanMode: () => set({ planMode: true }),
  exitPlanMode: () => set({ planMode: false }),
  planModesBySession: {},
  isPlanModeEnabled: (sessionId: any) => {
    if (!sessionId) return get().planMode
    return get().planModesBySession[sessionId] ?? false
  },

  // Browser panel (session-scoped)
  browserStatesBySession: {},
  browserWebviewRefsBySession: {},
  browserUrl: '',
  setBrowserUrl: (url: any, sessionId: any, projectId: any) =>
    set((state: any) => updateBrowserStateForSession(state, sessionId, { url }, projectId)),
  browserLoading: false,
  setBrowserLoading: (loading: any, sessionId: any, projectId: any) =>
    set((state: any) => updateBrowserStateForSession(state, sessionId, { loading }, projectId)),
  browserPageTitle: '',
  setBrowserPageTitle: (pageTitle: any, sessionId: any, projectId: any) =>
    set((state: any) => updateBrowserStateForSession(state, sessionId, { pageTitle }, projectId)),
  browserCanGoBack: false,
  setBrowserCanGoBack: (canGoBack: any, sessionId: any, projectId: any) =>
    set((state: any) => updateBrowserStateForSession(state, sessionId, { canGoBack }, projectId)),
  browserCanGoForward: false,
  setBrowserCanGoForward: (canGoForward: any, sessionId: any, projectId: any) =>
    set((state: any) => updateBrowserStateForSession(state, sessionId, { canGoForward }, projectId)),
  browserErrorInfo: null,
  setBrowserErrorInfo: (errorInfo: any, sessionId: any, projectId: any) =>
    set((state: any) => updateBrowserStateForSession(state, sessionId, { errorInfo }, projectId)),
  browserWebviewRef: null,

  // Selected files
  selectedFiles: [],
  setSelectedFiles: (files: any) => set({ selectedFiles: files }),
  toggleFileSelection: (filePath: any) =>
    set((state: any) => ({
      selectedFiles: state.selectedFiles.includes(filePath)
        ? state.selectedFiles.filter((f: any) => f !== filePath)
        : [...state.selectedFiles, filePath]
    })),
  clearSelectedFiles: () => set({ selectedFiles: [] }),

  // Preview panel (extracted to preview-panel-slice.ts)
  ...createPreviewPanelSlice(set, get),

  // Hovering state
  isHoveringRightPanel: false,
  setIsHoveringRightPanel: (hovering: any) => set({ isHoveringRightPanel: hovering }),
  runtimeStatusPanelTriggerHovered: false,
  setRuntimeStatusPanelTriggerHovered: (hovering: any) => set({ runtimeStatusPanelTriggerHovered: hovering }),

  // Session-scoped state
  activeScopedSessionId: null,
  activeScopedProjectId: null,
  syncSessionScopedState: (sessionId: any, projectId: any) =>
    set({ activeScopedSessionId: sessionId, activeScopedProjectId: projectId ?? null }),
  messageListViewStatesBySession: {},
  setMessageListViewState: (sessionId: any, state: any) =>
    set((s: any) => ({
      messageListViewStatesBySession: {
        ...s.messageListViewStatesBySession,
        [sessionId]: state ?? undefined
      }
    })),
  getMessageListViewState: (sessionId: any) => {
    if (!sessionId) return null
    return get().messageListViewStatesBySession[sessionId] ?? null
  },
  releaseDormantSessionUiState: (sessionId: any) => {
    if (!sessionId) return
    set((s: any) => {
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
  navigateToProject: (projectId: any) => {
    const resolvedProjectId = projectId ?? useChatStore.getState().activeProjectId ?? null
    if (resolvedProjectId) {
      useChatStore.getState().setActiveProjectHome(resolvedProjectId)
    }
    set({ activeNavItem: 'chat', chatView: 'project', ...CHAT_SURFACE_NAV_RESET })
  },
  navigateToArchive: (projectId: any) => {
    const resolvedProjectId = projectId ?? useChatStore.getState().activeProjectId ?? null
    if (resolvedProjectId) {
      useChatStore.getState().setActiveProjectHome(resolvedProjectId)
    }
    set({ activeNavItem: 'chat', chatView: 'archive', ...CHAT_SURFACE_NAV_RESET })
  },
  navigateToChannels: (projectId: any) => {
    const resolvedProjectId = projectId ?? useChatStore.getState().activeProjectId ?? null
    if (resolvedProjectId) {
      useChatStore.getState().setActiveProjectHome(resolvedProjectId)
    }
    set({ activeNavItem: 'chat', chatView: 'channels', ...CHAT_SURFACE_NAV_RESET })
  },
  navigateToGit: (projectId: any) => {
    const resolvedProjectId = projectId ?? useChatStore.getState().activeProjectId ?? null
    if (resolvedProjectId) {
      useChatStore.getState().setActiveProjectHome(resolvedProjectId)
    }
    set({ activeNavItem: 'chat', chatView: 'git', ...CHAT_SURFACE_NAV_RESET })
  },
  navigateToPersona: (projectId: any) => {
    const resolvedProjectId = projectId ?? useChatStore.getState().activeProjectId ?? null
    if (resolvedProjectId) {
      useChatStore.getState().setActiveProjectHome(resolvedProjectId)
    }
    set({ activeNavItem: 'chat', chatView: 'persona', ...CHAT_SURFACE_NAV_RESET })
  },
  navigateToSession: (sessionId: any) => {
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
  ensureBrowserTab: (url: any, sessionId: any, projectId: any, options: any) =>
    set((state: any) => {
      const existing = state.rightPanelTabs.find((tab: any) => tab.kind === 'browser')
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

  ensureSubAgentTab: (toolUseId: any, inlineText: any, title: any, requestedSessionId: any) =>
    set((state: any) => {
      const sessionId =
        (requestedSessionId?.trim() || null) ??
        state.activeScopedSessionId ??
        useChatStore.getState().activeSessionId ??
        null
      const tabScopeId = sessionId ?? 'global'
      const tabId = `subagent:${tabScopeId}:overview`
      const existing = state.rightPanelTabs.find(
        (tab: any) => tab.kind === 'subagent' && (tab.sessionId ?? null) === sessionId
      )
      const tab: RightPanelTabInstance = existing
        ? {
            ...existing,
            id: tabId,
            sessionId: sessionId ?? existing.sessionId ?? null,
            title: title?.trim() || 'SubAgents',
            toolUseId: toolUseId ?? null,
            inlineText: inlineText?.trim() ? inlineText : null
          }
        : {
            id: tabId,
            kind: 'subagent',
            title: title?.trim() || 'SubAgents',
            closable: true,
            sessionId,
            toolUseId: toolUseId ?? null,
            inlineText: inlineText?.trim() ? inlineText : null,
            createdAt: Date.now()
          }
      const tabsWithoutScopedDuplicates = state.rightPanelTabs.filter(
        (item: any) =>
          item.kind !== 'subagent' ||
          item === existing ||
          (item.sessionId ?? null) !== sessionId
      )
      const rightPanelTabs = ensureRightPanelTabs(
        existing
          ? tabsWithoutScopedDuplicates.map((item: any) => (item === existing ? tab : item))
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

  openSubAgentsPanel: (toolUseId: any, sessionId: any) =>
    get().ensureSubAgentTab(toolUseId ?? null, null, null, sessionId),

  ensureTerminalTab: () =>
    set((state: any) => {
      const existing = state.rightPanelTabs.find((tab: any) => tab.kind === 'terminal')
      if (existing) {
        return { rightPanelActiveTabId: existing.id, rightPanelOpen: true }
      }
      const tab: RightPanelTabInstance = {
        id: 'terminal',
        kind: 'terminal',
        title: 'Terminal',
        closable: true,
        createdAt: Date.now()
      }
      return {
        rightPanelTabs: ensureRightPanelTabs([...state.rightPanelTabs, tab]),
        rightPanelActiveTabId: tab.id,
        rightPanelOpen: true
      }
    }),

  ensureFilesTab: (sessionId: any) =>
    set((state: any) => {
      const existing = state.rightPanelTabs.find((tab: any) => tab.kind === 'files')
      if (existing) {
        return { rightPanelActiveTabId: existing.id, rightPanelOpen: true }
      }
      const tab: RightPanelTabInstance = {
        id: 'files',
        kind: 'files',
        title: 'Files',
        closable: true,
        createdAt: Date.now(),
        sessionId: sessionId ?? null
      }
      return {
        rightPanelTabs: ensureRightPanelTabs([...state.rightPanelTabs, tab]),
        rightPanelActiveTabId: tab.id,
        rightPanelOpen: true
      }
    }),

  getBrowserState: (sessionId: any, projectId: any) => {
    const state = get()
    const scope = resolvePanelScope(state, sessionId, projectId)
    return getBrowserStateFromMap(
      state.browserStatesBySession,
      scope.sessionId,
      scope.projectId
    )
  },

  patchBrowserState: (sessionId: any, patch: any, projectId: any) =>
    set((state: any) => updateBrowserStateForSession(state, sessionId, patch, projectId)),

  openBrowserTab: (url: any, sessionId: any, projectId: any, options: any) =>
    get().ensureBrowserTab(url, sessionId, projectId, options),

  getBrowserWebviewRef: (sessionId: any, projectId: any) => {
    const state = get()
    const scope = resolvePanelScope(state, sessionId, projectId)
    return state.browserWebviewRefsBySession[getBrowserScopeKey(scope)] ?? null
  },

  setBrowserWebviewRef: (ref: any, sessionId: any, projectId: any) =>
    set((state: any) => {
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
