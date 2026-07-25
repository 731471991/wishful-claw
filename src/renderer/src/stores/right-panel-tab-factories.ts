// Extracted from ui-store.ts — Right panel tab factory functions and constants

import type { RightPanelTabInstance } from './ui-types'

const RIGHT_PANEL_REVIEW_TAB_ID = 'review'

function createReviewTab(): RightPanelTabInstance {
  return { id: RIGHT_PANEL_REVIEW_TAB_ID, kind: 'review', title: 'Review', closable: true, createdAt: 0 }
}

function createActivityTab(): RightPanelTabInstance {
  return { id: 'activity', kind: 'activity', title: 'Activity', closable: false, createdAt: 0 }
}

function createMemoryTab(): RightPanelTabInstance {
  return { id: 'memory', kind: 'memory', title: 'Memory', closable: false, createdAt: 0 }
}

export function ensureRightPanelTabs(
  tabs: RightPanelTabInstance[] | null | undefined
): RightPanelTabInstance[] {
  return tabs ?? []
}

export function getDefaultRightPanelTabs(): RightPanelTabInstance[] {
  return [createActivityTab(), createMemoryTab()]
}

export function closeRightSidePanels(): { rightPanelOpen: false } {
  return { rightPanelOpen: false }
}

export const CHAT_SURFACE_NAV_RESET = {
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