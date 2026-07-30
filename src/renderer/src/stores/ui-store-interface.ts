// Extracted from ui-store.ts — UIStore interface definition

import type React from 'react'
import type {
  AppMode,
  AutoModelRoutingState,
  AutoModelSelectionStatus,
  AgentFilesChangeSource,
  AgentFilesTab,
  ChatView,
  DetailPanelContent,
  MessageListViewState,
  NavItem,
  RightPanelSection,
  RightPanelTabInstance,
  SettingsTab
} from './ui-types'
import type { BrowserErrorInfo, BrowserPanelSessionState } from './browser-session-helpers'
import type { PreviewPanelState, PreviewPanelTab, OpenDiffParams } from './preview-panel-helpers'

// ─── Store Interface ───
