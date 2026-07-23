import { create } from 'zustand'
import {
  LEFT_SIDEBAR_DEFAULT_WIDTH,
  RIGHT_PANEL_DEFAULT_WIDTH,
  clampLeftSidebarWidth,
  clampRightPanelWidth
} from '@renderer/components/layout/right-panel-defs'
import { useChatStore } from '@renderer/stores/chat-store'

// ─── Types ───

export type AppMode = 'chat' | 'clarify' | 'cowork' | 'code' | 'acp'

export type NavItem =
  | 'chat'
  | 'channels'
  | 'resources'
  | 'skills'
  | 'souls'
  | 'sync'
  | 'draw'
  | 'translate'
  | 'tasks'
  | 'codegraph'


export type AutoModelRoute = 'main' | 'fast'
export type AutoModelTaskType = string
export type AutoModelConfidence = string
export type AutoModelDecisionSource = string
export type AutoModelRoutingComplexity = string
export type AutoModelRoutingRisk = string

export interface AutoModelSelectionStatus {
  source: 'auto'
  mode?: string
  target: AutoModelRoute
  providerId?: string
  modelId?: string
  providerName?: string
  modelName?: string
  taskType?: AutoModelTaskType
  confidence?: AutoModelConfidence
  decisionSource?: AutoModelDecisionSource
  toolsAllowed?: boolean
  complexity?: AutoModelRoutingComplexity
  risk?: AutoModelRoutingRisk
  reasons?: string[]
  classifierRoute?: AutoModelRoute
  heuristicRoute?: AutoModelRoute
  fallbackReason?: string
  routingDurationMs?: number
  selectedAt: number
}

export type AutoModelRoutingState = 'idle' | 'routing'

export type ChatView = 'home' | 'project' | 'archive' | 'channels' | 'git' | 'session' | 'persona'

export type RightPanelSection = 'execution' | 'resources' | 'collaboration' | 'monitoring'
export type AgentFilesTab = 'files' | 'changes'
export type AgentFilesChangeSource = 'all' | 'agent' | 'git'
export type RightPanelTabKind =
  | 'context'
  | 'review'
  | 'files'
  | 'preview'
  | 'browser'
  | 'subagent'
  | 'terminal'

export interface RightPanelTabInstance {
  id: string
  kind: RightPanelTabKind
  title: string
  closable: boolean
  sessionId?: string | null
  toolUseId?: string | null
  inlineText?: string | null
  processId?: string
  terminalSource?: 'local' | 'ssh'
  localTabId?: string
  sshTabId?: string
  previewTabId?: string
  projectId?: string | null
  initialChangeId?: string | null
  selectionRequestId?: number
  modified?: boolean
  createdAt: number
}

export type SettingsTab =
  | 'provider'
  | 'modelManagement'
  | 'general'
  | 'persona'
  | 'about'

export type DetailPanelContent =
  | { type: 'team' }
  | { type: 'subagent'; toolUseId?: string; text?: string }
  | { type: 'terminal'; processId: string }
  | { type: 'change-review'; runId: string; initialChangeId?: string | null }
  | { type: 'document'; title: string; content: string }
  | { type: 'report'; title: string; data: unknown }

interface MessageListViewState {
  scrollOffset: number
  messageCount: number
  loadedRangeStart: number
  loadedRangeEnd: number
}


const RIGHT_PANEL_REVIEW_TAB_ID = 'review'

function createReviewTab(): RightPanelTabInstance {
  return { id: RIGHT_PANEL_REVIEW_TAB_ID, kind: 'review', title: 'Review', closable: true, createdAt: 0 }
}

function getDefaultRightPanelTabs(): RightPanelTabInstance[] {
  return [createReviewTab()]
}

function closeRightSidePanels(): { rightPanelOpen: false } {
  return { rightPanelOpen: false }
}

const CHAT_SURFACE_NAV_RESET = {
  settingsPageOpen: false,
  skillsPageOpen: false,
  soulsPageOpen: false,
  syncPageOpen: false,
  resourcesPageOpen: false,
  translatePageOpen: false,
  drawPageOpen: false,
  tasksPageOpen: false,
  codeGraphPageOpen: false,
  ...closeRightSidePanels()
} as const

// ─── Store Interface ───

interface UIStore {
  // Top-level view (splash / main / settings)
  view: 'splash' | 'main' | 'settings'
  setView: (view: 'splash' | 'main' | 'settings') => void
  enterMain: () => void
  openSettings: (tab?: SettingsTab) => void
  closeSettings: () => void

  // Selected provider (for ModelSwitcher)
  selectedProvider: Record<string, unknown> | null
  setSelectedProvider: (provider: Record<string, unknown> | null) => void

  // Mode
  mode: AppMode
  setMode: (mode: AppMode) => void

  // Navigation rail
  activeNavItem: NavItem
  setActiveNavItem: (item: NavItem) => void

  // Left sidebar
  leftSidebarOpen: boolean
  leftSidebarWidth: number
  toggleLeftSidebar: () => void
  setLeftSidebarOpen: (open: boolean) => void
  setLeftSidebarWidth: (width: number) => void

  // Conversation panel
  conversationPanelFullWidth: boolean
  setConversationPanelFullWidth: (fullWidth: boolean) => void

  // Right panel
  rightPanelOpen: boolean
  toggleRightPanel: () => void
  setRightPanelOpen: (open: boolean) => void
  rightPanelWidth: number
  setRightPanelWidth: (width: number) => void
  rightPanelTab: string
  setRightPanelTab: (tab: string) => void
  rightPanelSection: RightPanelSection
  setRightPanelSection: (section: RightPanelSection) => void
  rightPanelTabs: RightPanelTabInstance[]
  rightPanelActiveTabId: string
  setRightPanelActiveTab: (tabId: string) => void
  closeRightPanelTab: (tabId: string) => void
  rightPanelRailWidth: number

  // Runtime status panel
  runtimeStatusPanelOpen: boolean
  toggleRuntimeStatusPanel: () => void
  setRuntimeStatusPanelOpen: (open: boolean) => void

  // Auto model selection (from OpenCowork)
  autoModelSelectionsBySession: Record<string, AutoModelSelectionStatus | null>
  autoModelRoutingStatesBySession: Record<string, AutoModelRoutingState>
  setAutoModelSelection: (sessionId: string, status: AutoModelSelectionStatus | null) => void
  setAutoModelRoutingState: (sessionId: string, status: AutoModelRoutingState) => void

  // Settings page
  settingsPageOpen: boolean
  settingsTab: SettingsTab
  setSettingsTab: (tab: SettingsTab) => void
  openSettingsPage: (tab?: SettingsTab) => void
  closeSettingsPage: () => void

  // Feature page toggles (all preserved as entry points)
  skillsPageOpen: boolean
  openSkillsPage: () => void
  closeSkillsPage: () => void
  soulsPageOpen: boolean
  openSoulsPage: () => void
  closeSoulsPage: () => void
  syncPageOpen: boolean
  openSyncPage: () => void
  closeSyncPage: () => void
  resourcesPageOpen: boolean
  openResourcesPage: () => void
  closeResourcesPage: () => void
  translatePageOpen: boolean
  openTranslatePage: () => void
  closeTranslatePage: () => void
  drawPageOpen: boolean
  openDrawPage: () => void
  closeDrawPage: () => void
  tasksPageOpen: boolean
  openTasksPage: () => void
  closeTasksPage: () => void
  codeGraphPageOpen: boolean
  openCodeGraphPage: () => void
  closeCodeGraphPage: () => void

  // Dialogs
  shortcutsOpen: boolean
  setShortcutsOpen: (open: boolean) => void
  conversationGuideOpen: boolean
  setConversationGuideOpen: (open: boolean) => void
  changelogDialogOpen: boolean
  setChangelogDialogOpen: (open: boolean) => void
  pendingInsertText: string | null
  setPendingInsertText: (text: string | null) => void

  // Detail panel
  detailPanelOpen: boolean
  detailPanelContent: DetailPanelContent | null
  openDetailPanel: (content: DetailPanelContent) => void
  closeDetailPanel: () => void

  // Agent files
  agentFilesActiveTab: AgentFilesTab
  setAgentFilesActiveTab: (tab: AgentFilesTab) => void
  agentFilesSelectedChangeKey: string | null
  setAgentFilesSelectedChangeKey: (key: string | null) => void
  agentFilesChangeSource: AgentFilesChangeSource
  setAgentFilesChangeSource: (source: AgentFilesChangeSource) => void

  // Bottom terminal dock
  bottomTerminalDockOpenByProjectId: Record<string, boolean>
  setBottomTerminalDockOpen: (projectId: string, open: boolean) => void
  toggleBottomTerminalDock: (projectId: string) => void
  isBottomTerminalDockOpen: (projectId?: string | null) => boolean
  bottomTerminalDockHeight: number
  setBottomTerminalDockHeight: (height: number) => void

  // SubAgent execution detail
  subAgentExecutionDetailOpen: boolean
  subAgentExecutionDetailToolUseId: string | null
  subAgentExecutionDetailInlineText: string | null
  openSubAgentExecutionDetail: (toolUseId: string, inlineText?: string | null) => void
  closeSubAgentExecutionDetail: () => void
  selectedSubAgentToolUseId: string | null
  setSelectedSubAgentToolUseId: (toolUseId: string | null) => void

  // Orchestration console
  selectedOrchestrationRunId: string | null
  setSelectedOrchestrationRunId: (runId: string | null) => void
  selectedOrchestrationMemberId: string | null
  setSelectedOrchestrationMemberId: (memberId: string | null) => void
  orchestrationConsoleOpen: boolean
  orchestrationConsoleView: 'overview' | 'member' | 'tasks'
  openOrchestrationPanel: (runId?: string | null, memberId?: string | null) => void
  closeOrchestrationPanel: () => void

  // Plan mode
  planMode: boolean
  enterPlanMode: (sessionId?: string | null) => void
  exitPlanMode: (sessionId?: string | null) => void
  planModesBySession: Record<string, boolean>
  isPlanModeEnabled: (sessionId?: string | null) => boolean

  // Browser panel (placeholder state)
  browserUrl: string
  setBrowserUrl: (url: string) => void
  browserLoading: boolean
  setBrowserLoading: (loading: boolean) => void
  browserPageTitle: string
  setBrowserPageTitle: (title: string) => void

  // Selected files
  selectedFiles: string[]
  setSelectedFiles: (files: string[]) => void
  toggleFileSelection: (filePath: string) => void
  clearSelectedFiles: () => void

  // File preview
  openFilePreview: (
    filePath: string,
    viewMode?: 'split' | 'inline',
    sshConnectionId?: string | null,
    sessionId?: string | null,
    targetLine?: number,
    targetColumn?: number
  ) => void

  // Hovering state
  isHoveringRightPanel: boolean
  setIsHoveringRightPanel: (hovering: boolean) => void
  runtimeStatusPanelTriggerHovered: boolean
  setRuntimeStatusPanelTriggerHovered: (hovering: boolean) => void

  // Session-scoped state
  activeScopedSessionId: string | null
  activeScopedProjectId: string | null
  syncSessionScopedState: (sessionId: string | null, projectId?: string | null) => void
  messageListViewStatesBySession: Record<string, MessageListViewState | undefined>
  setMessageListViewState: (sessionId: string, state: MessageListViewState | null) => void
  getMessageListViewState: (sessionId?: string | null) => MessageListViewState | null
  releaseDormantSessionUiState: (sessionId?: string | null) => void

  // Chat view navigation
  chatView: ChatView
  navigateToHome: () => void
  navigateToProject: (projectId?: string | null) => void
  navigateToArchive: (projectId?: string | null) => void
  navigateToChannels: (projectId?: string | null) => void
  navigateToGit: (projectId?: string | null) => void
  navigateToPersona: (projectId?: string | null) => void
  navigateToSession: (sessionId?: string | null) => void
  applyRouteFromLocation: () => void
  applyChatRouteFromLocation: () => void
}

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
  rightPanelActiveTabId: RIGHT_PANEL_REVIEW_TAB_ID,
  setRightPanelActiveTab: (tabId) => set({ rightPanelActiveTabId: tabId }),
  closeRightPanelTab: (tabId) => {
    const tabs = get().rightPanelTabs.filter((t) => t.id !== tabId)
    const nextActive = tabs.length > 0 ? tabs[Math.max(0, tabs.length - 1)].id : RIGHT_PANEL_REVIEW_TAB_ID
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
  openSubAgentExecutionDetail: (toolUseId, inlineText) =>
    set({ subAgentExecutionDetailOpen: true, subAgentExecutionDetailToolUseId: toolUseId, subAgentExecutionDetailInlineText: inlineText ?? null }),
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

  // Plan mode
  planMode: false,
  enterPlanMode: () => set({ planMode: true }),
  exitPlanMode: () => set({ planMode: false }),
  planModesBySession: {},
  isPlanModeEnabled: (sessionId) => {
    if (!sessionId) return get().planMode
    return get().planModesBySession[sessionId] ?? false
  },

  // Browser panel (placeholder)
  browserUrl: '',
  setBrowserUrl: (url) => set({ browserUrl: url }),
  browserLoading: false,
  setBrowserLoading: (loading) => set({ browserLoading: loading }),
  browserPageTitle: '',
  setBrowserPageTitle: (title) => set({ browserPageTitle: title }),

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

  // File preview (stub — opens file via shell)
  openFilePreview: (filePath) => {
    // Stub: will be implemented with proper preview panel later
    console.log('[UIStore] openFilePreview stub:', filePath)
  },

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
    // Placeholder
  }
}))
