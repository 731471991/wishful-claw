import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ProviderType, ReasoningEffortLevel } from '../lib/api/types'
import { ipcStorage } from '../lib/ipc/ipc-storage'
import {
  DEFAULT_APP_THEME_PRESET,
  DEFAULT_SSH_TERMINAL_THEME_PRESET,
  isAppThemePreset,
  type AppThemePreset,
  type SshTerminalThemePreset
} from '../lib/theme-presets'
import {
  LEFT_SIDEBAR_DEFAULT_WIDTH,
  clampLeftSidebarWidth
} from '@renderer/components/layout/right-panel-defs'
import {
  DEFAULT_BROWSER_USER_DATA_SOURCE,
  normalizeBrowserUserDataSource,
  type BrowserUserDataSource
} from '../../../shared/browser-plugin'
import {
  detectSystemLanguage,
  normalizeLanguageCode,
  type AppLanguage
} from '@renderer/lib/i18n-language'
import {
  DEFAULT_PERMISSION_POLICY,
  sanitizePermissionPolicy,
  type PermissionPolicy
} from '../../../shared/permission-policy'
import { type ModelBinding, type SessionDefaultModelBinding, type ClaudeCodeConfig, type CodexConfig, type PromptRecommendationModelBinding, type PromptRecommendationModelBindings, type MainModelSelectionMode, type MemoryAutomationWritePolicy, type MemoryScopeMode, type ClarifyPlanModeAutoSwitchTarget, type ProjectDefaultDirectoryMode, type FileDiffViewMode, type LiveOutputAnimationStyle, type ShellExecutionEndpoint, DEFAULT_THEME_MODE, DEFAULT_SHELL_EXECUTION_ENDPOINT, DEFAULT_MAX_PARALLEL_TOOL_CALLS, DEFAULT_MAX_CONCURRENT_SUB_AGENTS, DEFAULT_MAX_TOOL_CALLS_PER_TURN, type RecentWorkingTarget, createDefaultClaudeCodeConfig, createDefaultCodexConfig, normalizeShellExecutionEndpoint, clampMaxConcurrentSubAgents, clampMaxParallelToolCalls, clampMaxToolCallsPerTurn } from './settings-store-types'

// Re-export types for consumers
export type {
  ClarifyPlanModeAutoSwitchTarget,
  ClaudeCodeConfig,
  ClaudeCodePermissionOption,
  CodexConfig,
  FileDiffViewMode,
  LiveOutputAnimationStyle,
  MainModelSelectionMode,
  MemoryAutomationWritePolicy,
  MemoryScopeMode,
  ModelBinding,
  OnboardingLanguage,
  ProjectDefaultDirectoryMode,
  PromptRecommendationModelBinding,
  PromptRecommendationModelBindings,
  RecentWorkingTarget,
  SessionDefaultModelBinding,
  ShellExecutionEndpoint,
  ThemeMode,
} from './settings-store-types'
import { isThemeSetting, normalizeWorkingFolderPath, sanitizeClaudeCodeConfigs, sanitizeCodexConfigs, sanitizeRecentWorkingTargets } from './settings-store-types'

// Re-export constants and functions for consumers
export {
  DEFAULT_MAX_CONCURRENT_SUB_AGENTS,
  DEFAULT_MAX_PARALLEL_TOOL_CALLS,
  DEFAULT_MAX_TOOL_CALLS_PER_TURN,
  DEFAULT_SHELL_EXECUTION_ENDPOINT,
  DEFAULT_THEME_MODE,
  MAX_MAX_CONCURRENT_SUB_AGENTS,
  MAX_MAX_PARALLEL_TOOL_CALLS,
  MAX_MAX_TOOL_CALLS_PER_TURN,
  MIN_MAX_CONCURRENT_SUB_AGENTS,
  MIN_MAX_PARALLEL_TOOL_CALLS,
  MIN_MAX_TOOL_CALLS_PER_TURN,
  clampMaxConcurrentSubAgents,
  clampMaxParallelToolCalls,
  clampMaxToolCallsPerTurn,
  createDefaultClaudeCodeConfig,
  createDefaultCodexConfig,
  getReasoningEffortKey,
  getRecentWorkingTargetKey,
  normalizeShellExecutionEndpoint,
  resolveReasoningEffortForModel,
  resolveShellExecutable,
} from './settings-store-types'

interface SettingsStore {
  provider: ProviderType
  apiKey: string
  baseUrl: string
  model: string
  fastModel: string
  maxTokens: number
  temperature: number
  systemPrompt: string
  theme: 'light' | 'dark' | 'system'
  themePreset: AppThemePreset
  sshTerminalThemePreset: SshTerminalThemePreset
  language: AppLanguage
  autoApprove: boolean
  permissionPolicy: PermissionPolicy
  autoUpdateEnabled: boolean
  clarifyAutoAcceptRecommended: boolean
  clarifyPlanModeAutoSwitchTarget: ClarifyPlanModeAutoSwitchTarget
  devMode: boolean
  thinkingEnabled: boolean
  fastModeEnabled: boolean
  reasoningEffort: ReasoningEffortLevel
  reasoningEffortByModel: Record<string, ReasoningEffortLevel>
  teamToolsEnabled: boolean
  builtinBrowserEnabled: boolean
  hooksEnabled: boolean
  browserUserDataReuseEnabled: boolean
  browserUserDataSource: BrowserUserDataSource
  contextCompressionEnabled: boolean
  /** Global trigger ratio shared by every chat model. */
  contextCompressionThreshold: number
  /** Dedicated summarizer model. Null keeps using the current session model. */
  contextCompressionModel: ModelBinding | null
  editorWorkspaceEnabled: boolean
  editorRemoteLanguageServiceEnabled: boolean
  maxParallelToolCalls: number
  maxToolCallsPerTurn: number
  maxConcurrentSubAgents: number
  toolResultFormat: 'toon' | 'json'
  fileDiffViewMode: FileDiffViewMode
  shellExecutionEndpoint: ShellExecutionEndpoint
  customShellExecutable: string
  shellEnvironmentVariablesText: string
  userName: string
  userAvatar: string
  onboardingCompleted: boolean
  onboardingCompletedAt: number | null
  onboardingInterests: string[]
  defaultSoulTemplateId: string
  defaultPersonaId: string
  conversationGuideSeen: boolean
  memoryAutomationEnabled: boolean
  memoryAutomationWritePolicy: MemoryAutomationWritePolicy
  memoryAutomationMainSessionsOnly: boolean
  memoryAutomationSummaryBudgetTokens: number
  memoryAutomationDailyRollupEnabled: boolean
  memoryUseMemories: boolean
  memoryGenerateMemories: boolean
  memoryScopeMode: MemoryScopeMode
  memoryMaxRolloutsPerStartup: number
  memoryMinRolloutIdleHours: number
  memoryMaxRawMemoriesForConsolidation: number
  memoryMaxUnusedDays: number
  memorySummaryBudgetTokens: number
  memoryDailyRollupEnabled: boolean

  // Appearance Settings
  backgroundColor: string
  fontFamily: string
  fontSize: number
  animationsEnabled: boolean
  liveOutputAnimationStyle: LiveOutputAnimationStyle
  toolbarCollapsedByDefault: boolean
  leftSidebarWidth: number

  // Web Search Settings
  webSearchEnabled: boolean
  webSearchProvider:
    | 'tavily'
    | 'searxng'
    | 'exa'
    | 'exa-mcp'
    | 'bocha'
    | 'zhipu'
    | 'google'
    | 'bing'
    | 'baidu'
  webSearchApiKey: string
  webSearchEngine: string
  webSearchMaxResults: number
  webSearchTimeout: number

  // CodeGraph Settings (opt-in standalone sidecar; default off)
  codegraphEnabled: boolean
  // Register the full 8-tool CodeGraph surface for agents (default: explore only,
  // matching upstream's DEFAULT_MCP_TOOLS)
  codegraphFullToolSurface: boolean

  // Network Settings
  systemProxyUrl: string

  // Skills Market Settings
  skillsMarketProvider: 'skillsmp'
  skillsMarketApiKey: string

  // Prompt Recommendation Settings
  promptRecommendationModels: PromptRecommendationModelBindings
  newSessionDefaultModel: SessionDefaultModelBinding | null
  mainModelSelectionMode: MainModelSelectionMode
  claudeCodeConfigs: ClaudeCodeConfig[]
  codexConfigs: CodexConfig[]
  projectDefaultDirectoryMode: ProjectDefaultDirectoryMode
  projectDefaultDirectory: string
  lastProjectDirectory: string
  recentWorkingTargets: RecentWorkingTarget[]
  defaultShell: string

  updateSettings: (patch: Partial<SettingsStoreData>) => void
  pushRecentWorkingTarget: (target: {
    workingFolder: string
    sshConnectionId?: string | null
  }) => void
  clearRecentWorkingTargets: () => void
}

type SettingsStoreData = Omit<
  SettingsStore,
  'updateSettings' | 'pushRecentWorkingTarget' | 'clearRecentWorkingTargets'
>

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      provider: 'anthropic',
      apiKey: '',
      baseUrl: '',
      model: 'claude-sonnet-4-20250514',
      fastModel: 'claude-3-5-haiku-20241022',
      maxTokens: 32000,
      temperature: 0.7,
      systemPrompt: '',
      theme: DEFAULT_THEME_MODE,
      themePreset: DEFAULT_APP_THEME_PRESET,
      sshTerminalThemePreset: DEFAULT_SSH_TERMINAL_THEME_PRESET,
      language: detectSystemLanguage(),
      autoApprove: false,
      permissionPolicy: { ...DEFAULT_PERMISSION_POLICY },
      autoUpdateEnabled: true,
      clarifyAutoAcceptRecommended: false,
      clarifyPlanModeAutoSwitchTarget: 'off',
      devMode: false,
      thinkingEnabled: false,
      fastModeEnabled: false,
      reasoningEffort: 'medium',
      reasoningEffortByModel: {},
      teamToolsEnabled: false,
      builtinBrowserEnabled: true,
      hooksEnabled: false,
      browserUserDataReuseEnabled: true,
      browserUserDataSource: DEFAULT_BROWSER_USER_DATA_SOURCE,
      contextCompressionEnabled: true,
      contextCompressionThreshold: 0.8,
      contextCompressionModel: null,
      editorWorkspaceEnabled: false,
      editorRemoteLanguageServiceEnabled: false,
      maxParallelToolCalls: DEFAULT_MAX_PARALLEL_TOOL_CALLS,
      maxToolCallsPerTurn: DEFAULT_MAX_TOOL_CALLS_PER_TURN,
      maxConcurrentSubAgents: DEFAULT_MAX_CONCURRENT_SUB_AGENTS,
      toolResultFormat: 'toon',
      fileDiffViewMode: 'split',
      shellExecutionEndpoint: DEFAULT_SHELL_EXECUTION_ENDPOINT,
      customShellExecutable: '',
      shellEnvironmentVariablesText: '',
      userName: '',
      userAvatar: '',
      onboardingCompleted: false,
      onboardingCompletedAt: null,
      onboardingInterests: [],
      defaultSoulTemplateId: '',
      defaultPersonaId: '',
      conversationGuideSeen: false,
      memoryAutomationEnabled: true,
      memoryAutomationWritePolicy: 'auto',
      memoryAutomationMainSessionsOnly: true,
      memoryAutomationSummaryBudgetTokens: 12_000,
      memoryAutomationDailyRollupEnabled: true,
      memoryUseMemories: true,
      memoryGenerateMemories: true,
      memoryScopeMode: 'hybrid',
      memoryMaxRolloutsPerStartup: 8,
      memoryMinRolloutIdleHours: 0,
      memoryMaxRawMemoriesForConsolidation: 500,
      memoryMaxUnusedDays: 180,
      memorySummaryBudgetTokens: 12_000,
      memoryDailyRollupEnabled: true,

      // Appearance Settings
      backgroundColor: '',
      fontFamily: '',
      fontSize: 16,
      animationsEnabled: true,
      liveOutputAnimationStyle: 'agile',
      toolbarCollapsedByDefault: false,
      leftSidebarWidth: LEFT_SIDEBAR_DEFAULT_WIDTH,

      // Web Search Settings
      webSearchEnabled: false,
      webSearchProvider: 'tavily',
      webSearchApiKey: '',
      webSearchEngine: 'google',
      webSearchMaxResults: 5,
      webSearchTimeout: 30000,

      // CodeGraph Settings (opt-in standalone sidecar; default off)
      codegraphEnabled: false,
      codegraphFullToolSurface: false,

      // Network Settings
      systemProxyUrl: '',

      // Skills Market Settings
      skillsMarketProvider: 'skillsmp',
      skillsMarketApiKey: '',

      // Prompt Recommendation Settings
      promptRecommendationModels: {
        chat: null,
        clarify: null,
        cowork: null,
        code: null,
        acp: null
      },
      newSessionDefaultModel: null,
      mainModelSelectionMode: 'auto',
      claudeCodeConfigs: [createDefaultClaudeCodeConfig()],
      codexConfigs: [createDefaultCodexConfig()],
      projectDefaultDirectoryMode: 'last-used',
      defaultShell: '',
      projectDefaultDirectory: '',
      lastProjectDirectory: '',
      recentWorkingTargets: [],

      updateSettings: (patch) =>
        set((state) => {
          const nextPatch = {
            ...patch,
            ...(patch.maxParallelToolCalls === undefined
              ? {}
              : { maxParallelToolCalls: clampMaxParallelToolCalls(patch.maxParallelToolCalls) }),
            ...(patch.maxToolCallsPerTurn === undefined
              ? {}
              : { maxToolCallsPerTurn: clampMaxToolCallsPerTurn(patch.maxToolCallsPerTurn) }),
            ...(patch.maxConcurrentSubAgents === undefined
              ? {}
              : {
                  maxConcurrentSubAgents: clampMaxConcurrentSubAgents(patch.maxConcurrentSubAgents)
                })
          }

          const hasChanges = (Object.keys(nextPatch) as Array<keyof SettingsStoreData>).some(
            (key) => !Object.is(state[key], nextPatch[key])
          )
          return hasChanges ? nextPatch : state
        }),
      pushRecentWorkingTarget: (target) =>
        set((state) => ({
          recentWorkingTargets: sanitizeRecentWorkingTargets([
            {
              workingFolder: normalizeWorkingFolderPath(target.workingFolder),
              sshConnectionId: target.sshConnectionId ?? null,
              updatedAt: Date.now()
            },
            ...state.recentWorkingTargets
          ])
        })),
      clearRecentWorkingTargets: () => set({ recentWorkingTargets: [] })
    }),
    {
      name: 'opencowork-settings',
      version: 30,
      storage: createJSONStorage(() => ipcStorage),
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>
        const matchesLegacyThemeDefaults =
          (state.theme === undefined || state.theme === LEGACY_DEFAULT_THEME_MODE) &&
          (state.themePreset === undefined ||
            state.themePreset === LEGACY_DEFAULT_APP_THEME_PRESET) &&
          (state.sshTerminalThemePreset === undefined ||
            state.sshTerminalThemePreset === LEGACY_DEFAULT_SSH_TERMINAL_THEME_PRESET)
        const matchesV17ThemeDefaults =
          (state.theme === undefined || state.theme === V17_DEFAULT_THEME_MODE) &&
          (state.themePreset === undefined || state.themePreset === V17_DEFAULT_APP_THEME_PRESET) &&
          (state.sshTerminalThemePreset === undefined ||
            state.sshTerminalThemePreset === V17_DEFAULT_SSH_TERMINAL_THEME_PRESET)
        const matchesV18ThemeDefaults =
          (state.theme === undefined || state.theme === V18_DEFAULT_THEME_MODE) &&
          (state.themePreset === undefined || state.themePreset === V18_DEFAULT_APP_THEME_PRESET) &&
          (state.sshTerminalThemePreset === undefined ||
            state.sshTerminalThemePreset === V18_DEFAULT_SSH_TERMINAL_THEME_PRESET)
        if (typeof state.language === 'string') {
          state.language = normalizeLanguageCode(state.language)
        } else {
          state.language = detectSystemLanguage()
        }
        // Add web search settings if missing
        if (state.webSearchEnabled === undefined) {
          state.webSearchEnabled = false
          state.webSearchProvider = 'tavily'
          state.webSearchApiKey = ''
          state.webSearchEngine = 'google'
          state.webSearchMaxResults = 5
          state.webSearchTimeout = 30000
        }
        if (state.systemProxyUrl === undefined) {
          state.systemProxyUrl = ''
        }
        // Add CodeGraph opt-in flag if missing (default off)
        if (state.codegraphEnabled === undefined) {
          state.codegraphEnabled = false
        }
        if (state.codegraphFullToolSurface === undefined) {
          state.codegraphFullToolSurface = false
        }
        // Add skills market settings if missing
        if (state.skillsMarketProvider === undefined || state.skillsMarketProvider !== 'skillsmp') {
          state.skillsMarketProvider = 'skillsmp'
          state.skillsMarketApiKey = state.skillsMarketApiKey ?? ''
        }
        if (state.promptRecommendationModels === undefined) {
          state.promptRecommendationModels = {
            chat: null,
            clarify: null,
            cowork: null,
            code: null,
            acp: null
          }
        } else if (
          (state.promptRecommendationModels as Record<string, unknown>).acp === undefined
        ) {
          ;(
            state.promptRecommendationModels as Record<string, PromptRecommendationModelBinding>
          ).acp = null
        }
        if (state.newSessionDefaultModel === undefined) {
          state.newSessionDefaultModel = null
        }
        if (
          typeof state.contextCompressionThreshold !== 'number' ||
          !Number.isFinite(state.contextCompressionThreshold)
        ) {
          state.contextCompressionThreshold = 0.8
        } else {
          state.contextCompressionThreshold = Math.min(
            0.9,
            Math.max(0.3, state.contextCompressionThreshold)
          )
        }
        if (
          !state.contextCompressionModel ||
          typeof state.contextCompressionModel !== 'object' ||
          Array.isArray(state.contextCompressionModel) ||
          typeof (state.contextCompressionModel as Record<string, unknown>).providerId !==
            'string' ||
          typeof (state.contextCompressionModel as Record<string, unknown>).modelId !== 'string'
        ) {
          state.contextCompressionModel = null
        }
        if (state.mainModelSelectionMode === undefined) {
          state.mainModelSelectionMode = 'auto'
        }
        state.claudeCodeConfigs = sanitizeClaudeCodeConfigs(state.claudeCodeConfigs)
        state.codexConfigs = sanitizeCodexConfigs(state.codexConfigs)
        state.permissionPolicy = sanitizePermissionPolicy(state.permissionPolicy)
        if (state.projectDefaultDirectoryMode === undefined) {
          state.projectDefaultDirectoryMode = 'last-used'
        }
        if (state.projectDefaultDirectory === undefined) {
          state.projectDefaultDirectory = ''
        }
        if (state.lastProjectDirectory === undefined) {
          state.lastProjectDirectory = ''
        }
        state.recentWorkingTargets = sanitizeRecentWorkingTargets(state.recentWorkingTargets)
        // Add appearance settings if missing
        if (!isThemeSetting(state.theme)) {
          state.theme = DEFAULT_THEME_MODE
        } else if (
          (version < 17 && matchesLegacyThemeDefaults) ||
          (version < 18 && matchesV17ThemeDefaults) ||
          (version < 19 && matchesV18ThemeDefaults)
        ) {
          state.theme = DEFAULT_THEME_MODE
        }
        if (state.backgroundColor === undefined) {
          state.backgroundColor = ''
        }
        if (!isAppThemePreset(state.themePreset)) {
          state.themePreset = DEFAULT_APP_THEME_PRESET
        } else if (
          (version < 17 && matchesLegacyThemeDefaults) ||
          (version < 18 && matchesV17ThemeDefaults) ||
          (version < 19 && matchesV18ThemeDefaults)
        ) {
          state.themePreset = DEFAULT_APP_THEME_PRESET
        }
        if (!isAppThemePreset(state.sshTerminalThemePreset)) {
          state.sshTerminalThemePreset = DEFAULT_SSH_TERMINAL_THEME_PRESET
        } else if (
          (version < 17 && matchesLegacyThemeDefaults) ||
          (version < 18 && matchesV17ThemeDefaults) ||
          (version < 19 && matchesV18ThemeDefaults)
        ) {
          state.sshTerminalThemePreset = DEFAULT_SSH_TERMINAL_THEME_PRESET
        }
        if (state.fontFamily === undefined) {
          state.fontFamily = ''
        }
        if (state.fontSize === undefined || typeof state.fontSize !== 'number') {
          state.fontSize = 16
        }
        if (state.animationsEnabled === undefined) {
          state.animationsEnabled = true
        }
        if (
          state.liveOutputAnimationStyle === undefined ||
          (state.liveOutputAnimationStyle !== 'agile' &&
            state.liveOutputAnimationStyle !== 'elegant')
        ) {
          state.liveOutputAnimationStyle = 'agile'
        }
        if (state.toolbarCollapsedByDefault === undefined) {
          state.toolbarCollapsedByDefault = false
        }
        if (state.leftSidebarWidth === undefined || typeof state.leftSidebarWidth !== 'number') {
          state.leftSidebarWidth = LEFT_SIDEBAR_DEFAULT_WIDTH
        } else {
          state.leftSidebarWidth = clampLeftSidebarWidth(state.leftSidebarWidth)
        }
        if (state.autoUpdateEnabled === undefined) {
          state.autoUpdateEnabled = true
        }
        if (state.clarifyAutoAcceptRecommended === undefined) {
          state.clarifyAutoAcceptRecommended = false
        }
        if (state.clarifyPlanModeAutoSwitchTarget === undefined) {
          state.clarifyPlanModeAutoSwitchTarget = 'off'
        }
        if (state.editorWorkspaceEnabled === undefined) {
          state.editorWorkspaceEnabled = false
        }
        if (state.editorRemoteLanguageServiceEnabled === undefined) {
          state.editorRemoteLanguageServiceEnabled = false
        }
        if (typeof state.hooksEnabled !== 'boolean') {
          state.hooksEnabled = false
        }
        if (
          state.maxParallelToolCalls === undefined ||
          typeof state.maxParallelToolCalls !== 'number'
        ) {
          state.maxParallelToolCalls = DEFAULT_MAX_PARALLEL_TOOL_CALLS
        } else {
          state.maxParallelToolCalls = clampMaxParallelToolCalls(state.maxParallelToolCalls)
        }
        if (
          state.maxToolCallsPerTurn === undefined ||
          typeof state.maxToolCallsPerTurn !== 'number'
        ) {
          state.maxToolCallsPerTurn = DEFAULT_MAX_TOOL_CALLS_PER_TURN
        } else {
          state.maxToolCallsPerTurn = clampMaxToolCallsPerTurn(state.maxToolCallsPerTurn)
        }
        if (
          state.maxConcurrentSubAgents === undefined ||
          typeof state.maxConcurrentSubAgents !== 'number'
        ) {
          state.maxConcurrentSubAgents = DEFAULT_MAX_CONCURRENT_SUB_AGENTS
        } else {
          state.maxConcurrentSubAgents = clampMaxConcurrentSubAgents(state.maxConcurrentSubAgents)
        }
        if (state.reasoningEffortByModel === undefined) {
          state.reasoningEffortByModel = {}
        }
        if (state.toolResultFormat === undefined) {
          state.toolResultFormat = 'toon'
        }
        if (state.fileDiffViewMode === undefined) {
          state.fileDiffViewMode = 'split'
        }
        if (state.browserUserDataReuseEnabled === undefined) {
          state.browserUserDataReuseEnabled = true
        }
        state.browserUserDataSource = normalizeBrowserUserDataSource(state.browserUserDataSource)
        state.shellExecutionEndpoint = normalizeShellExecutionEndpoint(state.shellExecutionEndpoint)
        if (typeof state.customShellExecutable !== 'string') {
          state.customShellExecutable = ''
        }
        if (typeof state.shellEnvironmentVariablesText !== 'string') {
          state.shellEnvironmentVariablesText = ''
        }
        if (state.onboardingCompleted === undefined) {
          state.onboardingCompleted = false
        }
        if (
          state.onboardingCompletedAt !== null &&
          typeof state.onboardingCompletedAt !== 'number'
        ) {
          state.onboardingCompletedAt = null
        }
        if (!Array.isArray(state.onboardingInterests)) {
          state.onboardingInterests = []
        } else {
          state.onboardingInterests = state.onboardingInterests.filter(
            (item): item is string => typeof item === 'string' && item.trim().length > 0
          )
        }
        if (typeof state.defaultSoulTemplateId !== 'string') {
          state.defaultSoulTemplateId = ''
        }
        if (state.conversationGuideSeen === undefined) {
          state.conversationGuideSeen = false
        }
        if (state.memoryAutomationEnabled === undefined) {
          state.memoryAutomationEnabled = true
        }
        state.memoryAutomationWritePolicy = 'auto'
        if (state.memoryAutomationMainSessionsOnly === undefined) {
          state.memoryAutomationMainSessionsOnly = true
        }
        if (
          state.memoryAutomationSummaryBudgetTokens === undefined ||
          typeof state.memoryAutomationSummaryBudgetTokens !== 'number'
        ) {
          state.memoryAutomationSummaryBudgetTokens = 12_000
        }
        if (state.memoryAutomationDailyRollupEnabled === undefined) {
          state.memoryAutomationDailyRollupEnabled = true
        }
        if (state.memoryUseMemories === undefined) {
          state.memoryUseMemories = true
        }
        if (state.memoryGenerateMemories === undefined) {
          state.memoryGenerateMemories = state.memoryAutomationEnabled
        }
        state.memoryScopeMode = 'hybrid'
        if (
          state.memoryMaxRolloutsPerStartup === undefined ||
          typeof state.memoryMaxRolloutsPerStartup !== 'number'
        ) {
          state.memoryMaxRolloutsPerStartup = 8
        }
        if (
          state.memoryMinRolloutIdleHours === undefined ||
          typeof state.memoryMinRolloutIdleHours !== 'number'
        ) {
          state.memoryMinRolloutIdleHours = 0
        }
        if (
          state.memoryMaxRawMemoriesForConsolidation === undefined ||
          typeof state.memoryMaxRawMemoriesForConsolidation !== 'number'
        ) {
          state.memoryMaxRawMemoriesForConsolidation = 500
        }
        if (
          state.memoryMaxUnusedDays === undefined ||
          typeof state.memoryMaxUnusedDays !== 'number'
        ) {
          state.memoryMaxUnusedDays = 180
        }
        if (
          state.memorySummaryBudgetTokens === undefined ||
          typeof state.memorySummaryBudgetTokens !== 'number'
        ) {
          state.memorySummaryBudgetTokens = state.memoryAutomationSummaryBudgetTokens
        }
        if (state.memoryDailyRollupEnabled === undefined) {
          state.memoryDailyRollupEnabled = state.memoryAutomationDailyRollupEnabled
        }
        return state as unknown as SettingsStore
      },
      partialize: (state) => ({
        provider: state.provider,
        baseUrl: state.baseUrl,
        model: state.model,
        fastModel: state.fastModel,
        maxTokens: state.maxTokens,
        temperature: state.temperature,
        systemPrompt: state.systemPrompt,
        theme: state.theme,
        themePreset: state.themePreset,
        sshTerminalThemePreset: state.sshTerminalThemePreset,
        language: state.language,
        autoApprove: state.autoApprove,
        permissionPolicy: state.permissionPolicy,
        autoUpdateEnabled: state.autoUpdateEnabled,
        clarifyAutoAcceptRecommended: state.clarifyAutoAcceptRecommended,
        clarifyPlanModeAutoSwitchTarget: state.clarifyPlanModeAutoSwitchTarget,
        devMode: state.devMode,
        thinkingEnabled: state.thinkingEnabled,
        fastModeEnabled: state.fastModeEnabled,
        reasoningEffort: state.reasoningEffort,
        reasoningEffortByModel: state.reasoningEffortByModel,
        teamToolsEnabled: state.teamToolsEnabled,
        contextCompressionEnabled: state.contextCompressionEnabled,
        contextCompressionThreshold: state.contextCompressionThreshold,
        contextCompressionModel: state.contextCompressionModel,
        editorWorkspaceEnabled: state.editorWorkspaceEnabled,
        editorRemoteLanguageServiceEnabled: state.editorRemoteLanguageServiceEnabled,
        maxParallelToolCalls: clampMaxParallelToolCalls(state.maxParallelToolCalls),
        maxToolCallsPerTurn: clampMaxToolCallsPerTurn(state.maxToolCallsPerTurn),
        maxConcurrentSubAgents: clampMaxConcurrentSubAgents(state.maxConcurrentSubAgents),
        toolResultFormat: state.toolResultFormat,
        fileDiffViewMode: state.fileDiffViewMode,
        shellExecutionEndpoint: normalizeShellExecutionEndpoint(state.shellExecutionEndpoint),
        customShellExecutable: state.customShellExecutable,
        shellEnvironmentVariablesText: state.shellEnvironmentVariablesText,
        userName: state.userName,
        userAvatar: state.userAvatar,
        onboardingCompleted: state.onboardingCompleted,
        onboardingCompletedAt: state.onboardingCompletedAt,
        onboardingInterests: state.onboardingInterests,
        defaultSoulTemplateId: state.defaultSoulTemplateId,
        defaultPersonaId: state.defaultPersonaId,
        conversationGuideSeen: state.conversationGuideSeen,
        memoryAutomationEnabled: state.memoryAutomationEnabled,
        memoryAutomationWritePolicy: 'auto' as const,
        memoryAutomationMainSessionsOnly: state.memoryAutomationMainSessionsOnly,
        memoryAutomationSummaryBudgetTokens: state.memoryAutomationSummaryBudgetTokens,
        memoryAutomationDailyRollupEnabled: state.memoryAutomationDailyRollupEnabled,
        memoryUseMemories: state.memoryUseMemories,
        memoryGenerateMemories: state.memoryGenerateMemories,
        memoryScopeMode: 'hybrid' as const,
        memoryMaxRolloutsPerStartup: state.memoryMaxRolloutsPerStartup,
        memoryMinRolloutIdleHours: state.memoryMinRolloutIdleHours,
        memoryMaxRawMemoriesForConsolidation: state.memoryMaxRawMemoriesForConsolidation,
        memoryMaxUnusedDays: state.memoryMaxUnusedDays,
        memorySummaryBudgetTokens: state.memorySummaryBudgetTokens,
        memoryDailyRollupEnabled: state.memoryDailyRollupEnabled,
        // Appearance Settings
        backgroundColor: state.backgroundColor,
        fontFamily: state.fontFamily,
        fontSize: state.fontSize,
        animationsEnabled: state.animationsEnabled,
        liveOutputAnimationStyle: state.liveOutputAnimationStyle,
        toolbarCollapsedByDefault: state.toolbarCollapsedByDefault,
        leftSidebarWidth: clampLeftSidebarWidth(state.leftSidebarWidth),
        // Web Search Settings
        webSearchEnabled: state.webSearchEnabled,
        webSearchProvider: state.webSearchProvider,
        webSearchApiKey: state.webSearchApiKey,
        webSearchEngine: state.webSearchEngine,
        webSearchMaxResults: state.webSearchMaxResults,
        webSearchTimeout: state.webSearchTimeout,
        // CodeGraph Settings
        codegraphEnabled: state.codegraphEnabled,
        codegraphFullToolSurface: state.codegraphFullToolSurface,
        // Network Settings
        systemProxyUrl: state.systemProxyUrl,
        // Skills Market Settings
        skillsMarketProvider: state.skillsMarketProvider,
        skillsMarketApiKey: state.skillsMarketApiKey,
        // Prompt Recommendation Settings
        promptRecommendationModels: state.promptRecommendationModels,
        newSessionDefaultModel: state.newSessionDefaultModel,
        mainModelSelectionMode: state.mainModelSelectionMode,
        claudeCodeConfigs: state.claudeCodeConfigs,
        codexConfigs: state.codexConfigs,
        projectDefaultDirectoryMode: state.projectDefaultDirectoryMode,
        projectDefaultDirectory: state.projectDefaultDirectory,
        lastProjectDirectory: state.lastProjectDirectory,
        recentWorkingTargets: state.recentWorkingTargets,
        defaultShell: state.defaultShell,
        builtinBrowserEnabled: state.builtinBrowserEnabled,
        hooksEnabled: state.hooksEnabled,
        browserUserDataReuseEnabled: state.browserUserDataReuseEnabled,
        browserUserDataSource: normalizeBrowserUserDataSource(state.browserUserDataSource)
        // NOTE: apiKey is intentionally excluded from localStorage persistence.
        // In production, it should be stored securely in the main process.
      })
    }
  )
)
