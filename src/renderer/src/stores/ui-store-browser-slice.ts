// Browser slice — extracted from ui-store.ts
// Contains browser state management methods to keep ui-store.ts under 500 lines

import type { UIStore } from './ui-store-interface'
import {
  getBrowserScopeKey,
  getBrowserStateFromMap,
  isActiveBrowserScope,
  resolvePanelScope,
  updateBrowserStateForSession
} from './browser-session-helpers'

type SetFn = (partial: Partial<UIStore> | ((state: UIStore) => Partial<UIStore>)) => void
type GetFn = () => UIStore

export function createBrowserSlice(set: SetFn, get: GetFn) {
  return {
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
  }
}
