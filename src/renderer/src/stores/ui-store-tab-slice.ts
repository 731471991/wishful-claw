// Tab slice — extracted from ui-store.ts
// Contains right panel tab management methods to keep ui-store.ts under 500 lines

import type { UIStore } from './ui-store-interface'
import type { RightPanelTabInstance } from './ui-types'
import { useChatStore } from '@renderer/stores/chat-store'
import { ensureRightPanelTabs } from './right-panel-tab-factories'

type SetFn = (partial: Partial<UIStore> | ((state: UIStore) => Partial<UIStore>)) => void
type GetFn = () => UIStore

export function createTabSlice(set: SetFn, get: GetFn) {
  return {
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

    openGoalPanel: (
      sessionId?: string | null,
      projectId?: string | null,
      goalId?: string | null
    ) =>
      set((state: any) => {
        const session = sessionId
          ? useChatStore.getState().sessions.find((item) => item.id === sessionId)
          : null
        const resolvedProjectId = projectId ?? session?.projectId ?? useChatStore.getState().activeProjectId ?? null
        const tabId = `goal:${resolvedProjectId ?? 'global'}`
        const existing = state.rightPanelTabs.find(
          (tab: any) => tab.kind === 'goal' && (tab.projectId ?? null) === resolvedProjectId
        )
        if (existing) {
          const rightPanelTabs = state.rightPanelTabs.map((tab: RightPanelTabInstance) =>
            tab === existing
              ? { ...tab, sessionId: sessionId ?? tab.sessionId ?? null, goalId: goalId ?? tab.goalId ?? null }
              : tab
          )
          return { rightPanelTabs, rightPanelActiveTabId: existing.id, rightPanelOpen: true }
        }
        const tab: RightPanelTabInstance = {
          id: tabId,
          kind: 'goal',
          title: 'Goals',
          closable: true,
          sessionId: sessionId ?? null,
          projectId: resolvedProjectId,
          goalId: goalId ?? null,
          createdAt: Date.now()
        }
        const rightPanelTabs = ensureRightPanelTabs([...state.rightPanelTabs, tab])
        return { rightPanelTabs, rightPanelActiveTabId: tabId, rightPanelOpen: true }
      }),

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
  }
}
