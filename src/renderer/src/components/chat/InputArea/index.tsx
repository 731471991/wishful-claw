// InputArea: main composer component with editor, toolbar, and controls

import * as React from 'react'
import { useState as useLocalState } from 'react'
import { toast } from 'sonner'
import {
  Send, FolderOpen, AlertTriangle, FileUp, FileCode2,
  Sparkles, X, Trash2, ImagePlus, ClipboardList, Globe, Wand2,
  CornerDownRight, Ellipsis, Command, Target, Puzzle,
  CheckCircle2, CircleHelp, Clock, ImageIcon, RefreshCcw,
  ShieldAlert, ShieldCheck, Check, Shapes, Users, Wrench,
  type LucideIcon
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Textarea } from '@renderer/components/ui/textarea'
import { Spinner } from '@renderer/components/ui/spinner'
import { confirm } from '@renderer/components/ui/confirm-dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@renderer/components/ui/hover-card'
import { useProviderStore, modelSupportsVision } from '@renderer/stores/provider-store'
import type {
  AIModelConfig, MessageRequestModelMeta, RequestTiming,
  SelectedFileReference, TokenUsage, UnifiedMessage
} from '@renderer/lib/api/types'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { AnimatePresence, motion } from 'motion/react'
import { updateWebSearchToolRegistration } from '@renderer/lib/tools'
import { useUIStore, type AppMode } from '@renderer/stores/ui-store'
import {
  calculateCost, calculateCostBreakdown, estimateTokens,
  formatCacheHitRate, formatCost, formatTokens,
  getBillableInputTokens, getCacheCreationTokens,
  getCacheCreationSplit, getCacheHitRate
} from '@renderer/lib/format-tokens'
import { formatDurationMs } from '@renderer/lib/format-duration'
import {
  getEffectiveContextWindow,
  resolveCompressionContextLength,
  resolveCompressionReservedOutputBudget,
  resolveCompressionThreshold
} from '@renderer/lib/agent/context-compression'
import { useDebouncedTokens } from '@renderer/hooks/use-estimated-tokens'
import { usePromptRecommendation } from '@renderer/hooks/use-prompt-recommendation'
import { useChatStore } from '@renderer/stores/chat-store'
import { useChannelStore } from '@renderer/stores/channel-store'
import { useAgentStore } from '@renderer/stores/agent-store'
import {
  getHomeInputDraftKey, getProjectInputDraftKey, getSessionInputDraftKey,
  type InputDraftContext
} from '@renderer/lib/input-drafts'
import { useInputDraftPersistence } from '@renderer/hooks/use-input-draft-persistence'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'
import {
  ACCEPTED_IMAGE_TYPES, cloneImageAttachments, fileToImageAttachment,
  hasEditableDraftContent,
  type EditableUserMessageDraft, type ImageAttachment
} from '@renderer/lib/image-attachments'
import {
  createSelectFileToken, getSelectFileMentionQuery, selectFileTextToPlainText
} from '@renderer/lib/select-file-tags'
import {
  deserializeEditorState, documentHasFileReferences,
  editorDocumentToPlainText, ensureSelectedFile, mergeSelectedFiles,
  createPluginReferenceNode, createTextReplacementNode,
  removeReferenceNode, replaceEditorRange, serializeEditorDocument,
  type EditorDocumentNode, type SelectedFileItem
} from '@renderer/lib/select-file-editor'
import { SkillsMenu } from '../SkillsMenu'
import { ModelSwitcher } from '../ModelSwitcher'
import { PersonaSwitcher } from '../PersonaSwitcher'
import { ModelIcon } from '@renderer/components/settings/provider-icons'
import { FileAwareEditor, type FileAwareEditorHandle } from '../FileAwareEditor'
import { TokenCounter } from '../TokenCounter'
import { listCommands, type CommandCatalogItem } from '@renderer/lib/commands/command-loader'
import { resolveConfiguredActiveMcpIds, useMcpStore } from '@renderer/stores/mcp-store'
import {
  resolveEffectiveActiveExtensionIds, useExtensionStore
} from '@renderer/stores/extension-store'
import { usePlanStore } from '@renderer/stores/plan-store'
import { useGoalStore } from '@renderer/stores/goal-store'
import { useSkillsStore } from '@renderer/stores/skills-store'
import { resolveSessionModelSelection } from '@renderer/lib/session-model-resolution'
import { resolvePluginsForProject, useAppPluginStore } from '@renderer/stores/app-plugin-store'
import { validateGoalObjective } from '@renderer/lib/agent/goal-context'
import {
  APP_PLUGIN_DESCRIPTORS, BROWSER_PLUGIN_ID, IMAGE_PLUGIN_ID,
  type AppPluginId
} from '@renderer/lib/app-plugin/types'
import {
  clearPendingSessionMessages, dispatchNextQueuedMessageForSession,
  getPendingSessionMessages, isPendingSessionDispatchPaused,
  quotePendingSessionMessageIntoConversation, removePendingSessionMessage,
  subscribePendingSessionMessages, updatePendingSessionMessageDraft,
  type SendMessageOptions, type PendingSessionMessageItem,
  type ManualCompressionResult
} from '@renderer/hooks/use-chat-actions'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger
} from '@renderer/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@renderer/components/ui/dialog'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { IPC } from '@renderer/lib/ipc/channels'
import { cn } from '@renderer/lib/utils'
import { resolveProjectMemoryTextFile } from '@renderer/lib/agent/memory-files'
import { isProjectSession, workspaceContextAvailable } from '@renderer/lib/session-scope'
import { getDroppedLocalPaths } from '@renderer/lib/drag-folder'
import { GoalSessionBar } from '@renderer/components/goal/GoalSessionControls'

// Extracted modules
import type {
  InputAreaProps, FileSearchItem, SlashSuggestionItem, AppPluginPromptItem,
  ContextCompressionStatus, RuntimeOutputSnapshot
} from './types'
import {
  EMPTY_QUEUED_MESSAGES, INTERNAL_FILE_DRAG_MIME,
  IMAGE_MEDIA_TYPE_BY_EXTENSION, MIN_INPUT_HEIGHT,
  DEFAULT_SESSION_INPUT_HEIGHT, MAX_INPUT_HEIGHT,
  MIN_MESSAGE_LIST_HEIGHT, EDITOR_MIN_HEIGHT,
  FALLBACK_MAX_VIEWPORT_RATIO, MAX_SLASH_COMMAND_RESULTS,
  BUILTIN_SLASH_COMMANDS,
  placeholderKeys, defaultRecommendationKeys
} from './types'
import {
  normalizeTokenCount, toFinitePositiveNumber, getLatestRequestTiming,
  formatRuntimeThroughput, formatRuntimeTtft, sumNullableCost,
  createEmptyRuntimeUsageTotals, getBillableInputForUsage,
  addUsageToTotals, collectRuntimeOutputSnapshot,
  getAppPluginPromptContent, getSlashCommandQuery, scoreSlashCommand,
  areQueuedMessagesEqual, summarizeQueuedMessage,
  isReferenceOnlyDocument, getImageMediaTypeForPath,
  createImageAttachmentId, selectedFileItemToReference
} from './utils'
import { ContextRing } from './context-ring'
import { ActiveMcpsBadge, ActiveExtensionsBadge, ReadOnlyModelBadge } from './badges'
import { ComposerRuntimeStatus, RuntimeTokenStatistics } from './runtime-status'
import { useComposerHeight } from './use-composer-height'
import { useImageAttachments } from './use-image-attachments'
import { useQueuedMessages } from './use-queued-messages'
import { usePromptOptimizer } from './use-prompt-optimizer'

export function InputArea({
  sessionId,
  onSend,
  onStop,
  onSelectFolder,
  isStreaming = false,
  workingFolder,
  hideWorkingFolderIndicator = false,
  hideWorkingFolderPicker = false,
  onCompressContext,
  disabled = false,
  draftKeyOverride,
  suppressPendingQueue = false,
  hideGoalSessionBar = false,
  hideModeSwitch = false,
  modelRoute = 'main',
  readOnlyModel,
  attachedFooter = false,
  fullWidth = false
}: InputAreaProps): React.JSX.Element {
  const { t } = useTranslation('chat')
  const chatView = useUIStore((s) => s.chatView)
  const isSessionComposer = chatView === 'session' || Boolean(sessionId)
  const isHomeComposer = chatView === 'home' || chatView === 'project'
  const minComposerHeight = MIN_INPUT_HEIGHT
  const defaultSessionInputHeight = Math.max(DEFAULT_SESSION_INPUT_HEIGHT, minComposerHeight)
  const [documentNodes, setDocumentNodes] = React.useState<EditorDocumentNode[]>([])
  const [selectedFiles, setSelectedFiles] = React.useState<SelectedFileItem[]>([])
  const [highlightedFileId, setHighlightedFileId] = React.useState<string | null>(null)
  const [editorSelection, setEditorSelection] = React.useState({ start: 0, end: 0 })
  const text = React.useMemo(
    () => editorDocumentToPlainText(documentNodes, selectedFiles),
    [documentNodes, selectedFiles]
  )
  const finalSerializedText = React.useMemo(
    () => serializeEditorDocument(documentNodes, selectedFiles),
    [documentNodes, selectedFiles]
  )
  const debouncedTokens = useDebouncedTokens(finalSerializedText)
  const [selectedSkill, setSelectedSkill] = React.useState<string | null>(null)
  const [slashCommands, setSlashCommands] = React.useState<CommandCatalogItem[]>([])
  const [slashCommandsLoading, setSlashCommandsLoading] = React.useState(false)
  const [selectedSlashIndex, setSelectedSlashIndex] = React.useState(0)
  const [fileSearchResults, setFileSearchResults] = React.useState<FileSearchItem[]>([])
  const [fileSearchLoading, setFileSearchLoading] = React.useState(false)
  const [selectedFileSearchIndex, setSelectedFileSearchIndex] = React.useState(0)
  // Chromium re-dispatches a synthetic mousemove at the resting pointer position
  // after DOM changes under it (e.g. arrow-key selection re-renders the list),
  // which would steal the selection back to the hovered item. Only treat
  // mousemove as hover intent when the pointer actually moved.
  const flyoutPointerRef = React.useRef<{ x: number; y: number } | null>(null)
  const slashListRef = React.useRef<HTMLDivElement | null>(null)
  const fileListRef = React.useRef<HTMLDivElement | null>(null)
  const [attachedImages, setAttachedImages] = React.useState<ImageAttachment[]>([])
  const [previewImage, setPreviewImage] = React.useState<ImageAttachment | null>(null)
  const [pendingImageReads, setPendingImageReads] = React.useState(0)
  const [contextCompressionStatus, setContextCompressionStatus] =
    React.useState<ContextCompressionStatus>('idle')
  const currentLanguage = useSettingsStore((state) => state.language)
  const mainModelSelectionMode = useSettingsStore((state) => state.mainModelSelectionMode)
  const autoApprove = useSettingsStore((state) => state.autoApprove)
  const permissionWhitelistEnabled = useSettingsStore((state) => state.permissionPolicy.enabled)
  const clarifyAutoAcceptRecommended = useSettingsStore(
    (state) => state.clarifyAutoAcceptRecommended
  )
  const animationsEnabled = useSettingsStore((state) => state.animationsEnabled)
  const editorRef = React.useRef<FileAwareEditorHandle | null>(null)
  const draftSaveTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const contextCompressionStatusTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const {
    rootRef, containerRef, imagePreviewRef, bottomToolbarRef,
    inputHeight, autoInputHeight, autoMaxInputHeight, handleDragStart
  } = useComposerHeight({
    isSessionComposer, defaultSessionInputHeight, editorRef,
    attachedImagesCount: attachedImages.length, selectedSkill,
    documentNodes, selectedFiles
  })
  const textRef = React.useRef(text)
  const documentRef = React.useRef(documentNodes)
  const selectedFilesRef = React.useRef(selectedFiles)
  const isContextCompressing = contextCompressionStatus === 'compressing'

  const composerWidthClass = fullWidth
    ? 'mx-auto w-full max-w-none'
    : 'mx-auto w-full max-w-[820px]'

  React.useEffect(() => {
    return () => clearTimeout(contextCompressionStatusTimerRef.current)
  }, [])

  const targetSession = useChatStore(
    useShallow((s) => {
      const targetSessionId = sessionId ?? s.activeSessionId
      const idx = targetSessionId ? s.sessionsById[targetSessionId] : undefined
      const session = idx !== undefined ? s.sessions[idx] : undefined
      if (!session) return undefined
      return {
        id: session.id,
        projectId: session.projectId,
        pluginId: session.pluginId,
        providerId: session.providerId,
        modelId: session.modelId,
        modelSelectionMode: session.modelSelectionMode
      } as Pick<
        import('@renderer/stores/chat-store').Session,
        'id' | 'projectId' | 'pluginId' | 'providerId' | 'modelId' | 'modelSelectionMode'
      >
    })
  )
  const channels = useChannelStore((s) => s.channels)
  const autoSelection = useUIStore((s) =>
    targetSession ? (s.autoModelSelectionsBySession[targetSession.id] ?? null) : null
  )
  const activeProvider = useProviderStore(
    useShallow((s) => {
      const { providers, activeProviderId, activeModelId } = s
      const fastConfig = modelRoute === 'fast' ? s.getFastProviderConfig() : null
      const session = isSessionComposer ? targetSession : null
      const channel = session?.pluginId
        ? (channels.find((item) => item.id === session.pluginId) ?? null)
        : null
      const selection = session
        ? resolveSessionModelSelection({
            session,
            providers,
            activeProviderId,
            activeModelId,
            globalMode: mainModelSelectionMode,
            channelProviderId: channel?.providerId,
            channelModelId: channel?.model
          })
        : null
      const providerId =
        fastConfig?.providerId ??
        (selection
          ? selection.isAutoModeActive && autoSelection?.providerId
            ? autoSelection.providerId
            : selection.providerId
          : activeProviderId)
      const modelId =
        fastConfig?.model ??
        (selection
          ? selection.isAutoModeActive && autoSelection?.modelId
            ? autoSelection.modelId
            : selection.modelId
          : activeModelId)
      if (!providerId || !modelId) return null
      const provider = providers.find((item) => item.id === providerId)
      if (!provider) return null
      const model = provider.models.find((item) => item.id === modelId)
      if (!model) return null
      return {
        apiKey: provider.apiKey,
        requiresApiKey: provider.requiresApiKey,
        type: provider.type,
        models: provider.models,
        modelId
      }
    })
  )
  const supportsVision = React.useMemo(() => {
    if (!activeProvider) return false
    const model = activeProvider.models.find((m) => m.id === activeProvider.modelId)
    return modelSupportsVision(model, activeProvider.type)
  }, [activeProvider])
  const composerModelCfg = React.useMemo<AIModelConfig | null>(() => {
    if (!activeProvider) return null
    return activeProvider.models.find((m) => m.id === activeProvider.modelId) ?? null
  }, [activeProvider])
  const webSearchEnabled = useSettingsStore((s) => s.webSearchEnabled)
  const webSearchProvider = useSettingsStore((s) => s.webSearchProvider)
  const webSearchApiKey = useSettingsStore((s) => s.webSearchApiKey)
  const webSearchRequiresApiKey = [
    'tavily',
    'searxng',
    'exa',
    'exa-mcp',
    'bocha',
    'zhipu'
  ].includes(webSearchProvider)
  const canToggleWebSearch = !webSearchRequiresApiKey || Boolean(webSearchApiKey)
  const toggleWebSearch = React.useCallback(() => {
    const store = useSettingsStore.getState()
    const newEnabled = !store.webSearchEnabled
    useSettingsStore.getState().updateSettings({ webSearchEnabled: newEnabled })
    updateWebSearchToolRegistration(newEnabled)
  }, [])
  const openSettings = useUIStore((s) => s.openSettings)
  const openFilePreview = useUIStore((s) => s.openFilePreview)
  const mode = useUIStore((s) => s.mode)
  // Only select fields actually used — avoids re-renders on every streaming message delta
  const activeProjectId = useChatStore((s) => {
    const targetSessionId = sessionId ?? s.activeSessionId
    const idx = targetSessionId ? s.sessionsById[targetSessionId] : undefined
    const targetSession = idx !== undefined ? s.sessions[idx] : undefined
    return targetSession?.projectId ?? s.activeProjectId
  })
  const activeSshConnectionId = useChatStore((s) => {
    const targetSessionId = sessionId ?? s.activeSessionId
    const idx = targetSessionId ? s.sessionsById[targetSessionId] : undefined
    const targetSession = idx !== undefined ? s.sessions[idx] : undefined
    const projectId = targetSession?.projectId ?? s.activeProjectId
    const activeProject = projectId
      ? s.projects.find((project) => project.id === projectId)
      : undefined
    return targetSession?.sshConnectionId ?? activeProject?.sshConnectionId ?? null
  })
  const showInlineClearConversation = false
  const { installedSkills, skillsLoading, loadSkills } = useSkillsStore(
    useShallow((s) => ({
      installedSkills: s.skills,
      skillsLoading: s.loading,
      loadSkills: s.loadSkills
    }))
  )
  const pluginsByProject = useAppPluginStore((s) => s.pluginsByProject)
  const { activeSessionId, hasMessages, clearSessionMessages } = useChatStore(
    useShallow((s) => {
      const targetSessionId = sessionId ?? s.activeSessionId
      const idx = targetSessionId ? s.sessionsById[targetSessionId] : undefined
      const targetSession = idx !== undefined ? s.sessions[idx] : undefined
      return {
        activeSessionId: targetSessionId,
        hasMessages: (targetSession?.messageCount ?? 0) > 0,
        clearSessionMessages: s.clearSessionMessages
      }
    })
  )
  // Stable getter — reads messages lazily so streaming deltas don't re-render InputArea
  const getSessionMessages = React.useCallback(
    () => useChatStore.getState().getSessionMessages(activeSessionId ?? ''),
    [activeSessionId]
  )
  const draftSessionId = sessionId ?? (chatView === 'session' ? activeSessionId : null)
  const projectScoped = isProjectSession({
    chatView,
    session: targetSession,
    activeProjectId,
    workingFolder
  })
  const workspaceReady = workspaceContextAvailable({
    chatView,
    session: targetSession,
    activeProjectId,
    workingFolder
  })
  const activeDraftKey = React.useMemo(() => {
    if (draftKeyOverride) return draftKeyOverride
    if (draftSessionId) return getSessionInputDraftKey(draftSessionId)
    if (activeProjectId) return getProjectInputDraftKey(activeProjectId)
    return getHomeInputDraftKey()
  }, [activeProjectId, draftKeyOverride, draftSessionId])
  const draftContext = React.useMemo<InputDraftContext>(() => {
    if (draftKeyOverride) {
      return {
        scope: draftKeyOverride.startsWith('subagent:') ? 'subagent' : 'custom',
        sessionId: draftSessionId,
        projectId: activeProjectId,
        mode,
        workingFolder: workingFolder ?? null
      }
    }

    if (draftSessionId) {
      return {
        scope: 'session',
        sessionId: draftSessionId,
        projectId: activeProjectId,
        mode,
        workingFolder: workingFolder ?? null
      }
    }

    if (activeProjectId) {
      return {
        scope: 'project',
        projectId: activeProjectId,
        mode,
        workingFolder: workingFolder ?? null
      }
    }

    return {
      scope: 'home',
      mode,
      workingFolder: workingFolder ?? null
    }
  }, [activeProjectId, draftKeyOverride, draftSessionId, mode, workingFolder])
  const {
    hydrated: inputDraftHydrated,
    loadedDraft: persistedDraft,
    saveDraft: savePersistedDraft,
    removeDraft: removePersistedDraft
  } = useInputDraftPersistence({
    draftKey: activeDraftKey,
    context: draftContext
  })
  const draftReadyKeyRef = React.useRef<string | null>(null)
  const [autoAcceptCountdown, setAutoAcceptCountdown] = React.useState<number | null>(null)
  const [isWorkspaceAgentsMissing, setIsWorkspaceAgentsMissing] = React.useState(false)
  const [pendingPlanMode, setPendingPlanMode] = React.useState(false)
  const [pendingGoalMode, setPendingGoalMode] = React.useState(false)


  const applyEditorStateFromSerializedText = React.useCallback(
    (nextText: string, baseFiles: SelectedFileItem[] = selectedFilesRef.current) => {
      const nextState = deserializeEditorState(nextText, workingFolder, baseFiles)
      setDocumentNodes(nextState.document)
      setSelectedFiles(nextState.selectedFiles)
    },
    [workingFolder]
  )

  const setText = React.useCallback(
    (value: string | ((prev: string) => string)) => {
      const previousText = textRef.current
      const nextText = typeof value === 'function' ? value(previousText) : value
      applyEditorStateFromSerializedText(nextText, selectedFilesRef.current)
    },
    [applyEditorStateFromSerializedText]
  )

  const focusInputAtEnd = React.useCallback(() => {
    editorRef.current?.focusAtEnd()
  }, [])

  const {
    isOptimizing, optimizationOptions, showOptimizationDialog,
    setShowOptimizationDialog, selectedOptionIndex, setSelectedOptionIndex,
    contentScrollRef, handleOptimizePrompt, handleSelectOption, handleCancelOptimization
  } = usePromptOptimizer({
    text, currentLanguage, setText, focusInputAtEnd
  })

  // Lock input while optimizing OR while the optimization dialog is open
  const isOptimizingLocked = isOptimizing || showOptimizationDialog

  const hasFileReferences = React.useMemo(() => selectedFiles.length > 0, [selectedFiles])

  const replaceSelectionWithText = React.useCallback(
    (
      replacement: string,
      selection: { start: number; end: number } = editorSelection,
      cursorOffset = 0,
      nextSelectedFiles?: SelectedFileItem[]
    ) => {
      const replacementState = deserializeEditorState(
        replacement,
        workingFolder,
        nextSelectedFiles ?? selectedFilesRef.current
      )
      const candidateFiles = mergeSelectedFiles(
        nextSelectedFiles ?? selectedFilesRef.current,
        replacementState.selectedFiles
      )
      const nextDocument = replaceEditorRange(
        documentRef.current,
        selectedFilesRef.current,
        selection.start,
        selection.end,
        replacementState.document
      )
      const referencedFileIds = new Set(
        nextDocument
          .filter(
            (node): node is Extract<EditorDocumentNode, { type: 'file' }> => node.type === 'file'
          )
          .map((node) => node.fileId)
      )
      const nextFiles = candidateFiles.filter((file) => referencedFileIds.has(file.id))
      const nextCursor =
        selection.start +
        editorDocumentToPlainText(replacementState.document, candidateFiles).length +
        cursorOffset

      setDocumentNodes(nextDocument)
      setSelectedFiles(nextFiles)
      requestAnimationFrame(() => {
        editorRef.current?.focus()
        editorRef.current?.setSelectionOffsets(nextCursor, nextCursor)
        setEditorSelection({ start: nextCursor, end: nextCursor })
      })
    },
    [editorSelection, workingFolder]
  )

  const shouldRecommendInit = workspaceReady && !activeSshConnectionId && isWorkspaceAgentsMissing
  const recommendationFallback = shouldRecommendInit
    ? t('input.recommendationInitWorkspace')
    : t(defaultRecommendationKeys[mode])
  const shouldAutoAcceptRecommendation =
    mode === 'clarify' && clarifyAutoAcceptRecommended && !disabled && !isOptimizingLocked && !isStreaming
  const getCaretAtEnd = React.useCallback(() => {
    return editorSelection.start === editorSelection.end && editorSelection.end === text.length
  }, [editorSelection.end, editorSelection.start, text.length])
  const {
    suggestionText,
    effectivePlaceholder,
    acceptSuggestion,
    cancelPendingRequest: cancelPromptRecommendation,
    handleFocus: handleRecommendationFocus,
    handleBlur: handleRecommendationBlur,
    handleSelectionChange: handleRecommendationSelectionChange,
    handleCompositionStart: handleRecommendationCompositionStart,
    handleCompositionEnd: handleRecommendationCompositionEnd
  } = usePromptRecommendation({
    mode,
    sessionId: activeSessionId,
    text,
    getRecentMessages: getSessionMessages,
    selectedSkill,
    images: attachedImages,
    disabled: disabled || isOptimizingLocked,
    isStreaming,
    fallbackSuggestion: recommendationFallback,
    getCaretAtEnd
  })
  const activeFileMention = React.useMemo(() => {
    if (editorSelection.start === editorSelection.end) {
      const selectionMention = getSelectFileMentionQuery(text, editorSelection.end)
      if (selectionMention) return selectionMention
    }

    return getSelectFileMentionQuery(text, text.length)
  }, [editorSelection.end, editorSelection.start, text])
  const fileQuery = activeFileMention?.query.trim() ?? ''
  const fileMenuOpen = projectScoped && Boolean(activeFileMention)
  const slashQuery = React.useMemo(() => getSlashCommandQuery(text), [text])
  const availableAppPlugins = React.useMemo<AppPluginPromptItem[]>(() => {
    const projectPlugins = resolvePluginsForProject(pluginsByProject, activeProjectId)

    return APP_PLUGIN_DESCRIPTORS.filter((descriptor) => !descriptor.hidden)
      .map((descriptor) => {
        const plugin = projectPlugins.find((item) => item.id === descriptor.id)
        if (!plugin?.enabled) return null

        return {
          id: descriptor.id,
          title: t(`plugin.items.${descriptor.id}.title`, {
            ns: 'settings',
            defaultValue: descriptor.id
          }),
          description: t(`plugin.items.${descriptor.id}.description`, {
            ns: 'settings',
            defaultValue: ''
          })
        }
      })
      .filter((item): item is AppPluginPromptItem => item !== null)
  }, [activeProjectId, pluginsByProject, t])
  const filteredSlashSuggestions = React.useMemo(() => {
    const query = slashQuery ?? ''
    const suggestionsByIdentity = new Map<string, SlashSuggestionItem>()

    for (const command of [...BUILTIN_SLASH_COMMANDS, ...slashCommands]) {
      suggestionsByIdentity.set(`command:${command.name.toLowerCase()}`, {
        key: `command:${command.name}`,
        name: command.name,
        summary: command.summary,
        kind: 'command'
      })
    }

    for (const plugin of availableAppPlugins) {
      suggestionsByIdentity.set(`plugin:${plugin.id}`, {
        key: `plugin:${plugin.id}`,
        name: plugin.id,
        label: plugin.title,
        summary: plugin.description,
        kind: 'plugin',
        pluginId: plugin.id
      })
    }

    const appPluginIds = new Set(
      APP_PLUGIN_DESCRIPTORS.filter((descriptor) => !descriptor.hidden).map(
        (descriptor) => descriptor.id
      )
    )
    for (const skill of installedSkills) {
      if (appPluginIds.has(skill.name as AppPluginId)) continue
      suggestionsByIdentity.set(`skill:${skill.name.toLowerCase()}`, {
        key: `skill:${skill.name}`,
        name: skill.name,
        summary: skill.description,
        kind: 'skill'
      })
    }

    return [...suggestionsByIdentity.values()]
      .map((item) => ({ item, score: scoreSlashCommand(item.name, query) }))
      .filter((item) => Number.isFinite(item.score))
      .sort((left, right) => {
        if (left.score !== right.score) return left.score - right.score
        if (left.item.kind !== right.item.kind) {
          const order = { command: 0, plugin: 1, skill: 2 }
          return order[left.item.kind] - order[right.item.kind]
        }
        return left.item.name.localeCompare(right.item.name, undefined, {
          sensitivity: 'base'
        })
      })
      .slice(0, MAX_SLASH_COMMAND_RESULTS)
      .map((item) => item.item)
  }, [availableAppPlugins, installedSkills, slashCommands, slashQuery])
  const slashMenuOpen = slashQuery !== null
  const slashSuggestionsLoading = slashCommandsLoading || skillsLoading

  React.useEffect(() => {
    if (!slashMenuOpen) {
      setSelectedSlashIndex(0)
      setSlashCommandsLoading(false)
      return
    }

    let cancelled = false
    setSlashCommandsLoading(true)

    void Promise.all([listCommands(), loadSkills()])
      .then(([commands]) => {
        if (cancelled) return
        setSlashCommands(commands)
      })
      .finally(() => {
        if (cancelled) return
        setSlashCommandsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [loadSkills, slashMenuOpen])

  React.useEffect(() => {
    setSelectedSlashIndex(0)
  }, [slashQuery])

  React.useEffect(() => {
    setSelectedFileSearchIndex(0)
  }, [fileQuery])

  // Keep the keyboard-selected item visible; a no-op for hover-driven changes
  // since hovered items are visible by definition.
  React.useEffect(() => {
    if (!slashMenuOpen) return
    const items = slashListRef.current?.querySelectorAll('button')
    items?.[selectedSlashIndex]?.scrollIntoView({ block: 'nearest' })
  }, [selectedSlashIndex, slashMenuOpen])

  React.useEffect(() => {
    if (!fileMenuOpen) return
    const items = fileListRef.current?.querySelectorAll('button')
    items?.[selectedFileSearchIndex]?.scrollIntoView({ block: 'nearest' })
  }, [selectedFileSearchIndex, fileMenuOpen])

  React.useEffect(() => {
    if (!fileMenuOpen) {
      setFileSearchResults([])
      setFileSearchLoading(false)
      return
    }

    if (!workingFolder) {
      setFileSearchResults([])
      setFileSearchLoading(false)
      return
    }

    let cancelled = false
    setFileSearchLoading(true)

    const timer = window.setTimeout(() => {
      void ipcClient
        .invoke('fs:search-files', {
          path: workingFolder,
          query: fileQuery,
          limit: 20
        })
        .then((result) => {
          if (cancelled) return
          if (Array.isArray(result)) {
            setFileSearchResults(result as FileSearchItem[])
            return
          }
          setFileSearchResults([])
        })
        .finally(() => {
          if (cancelled) return
          setFileSearchLoading(false)
        })
    }, 120)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [fileMenuOpen, fileQuery, workingFolder])

  const insertSelectedFile = React.useCallback(
    (filePath: string) => {
      setSelectedSkill(null)

      const { files: nextFiles, file } = ensureSelectedFile(
        selectedFilesRef.current,
        filePath,
        workingFolder
      )
      if (!file) return

      const mention = activeFileMention ?? {
        start: editorSelection.start,
        end: editorSelection.end
      }
      const suffix =
        text.slice(mention.end).startsWith(' ') ||
        text.slice(mention.end).startsWith('\n') ||
        mention.end >= text.length
          ? ''
          : ' '

      replaceSelectionWithText(
        `${createSelectFileToken(file.sendPath)}${suffix}`,
        mention,
        0,
        nextFiles
      )
    },
    [
      activeFileMention,
      editorSelection.end,
      editorSelection.start,
      replaceSelectionWithText,
      text,
      workingFolder
    ]
  )

  const insertSlashCommand = React.useCallback(
    (commandName: string) => {
      setSelectedSkill(null)
      applyEditorStateFromSerializedText(`/${commandName} `, selectedFiles)
      requestAnimationFrame(() => {
        focusInputAtEnd()
      })
    },
    [applyEditorStateFromSerializedText, focusInputAtEnd, selectedFiles]
  )
  const selectSlashSkill = React.useCallback(
    (skillName: string) => {
      setSelectedSkill(skillName)
      applyEditorStateFromSerializedText('')
      requestAnimationFrame(() => {
        focusInputAtEnd()
      })
    },
    [applyEditorStateFromSerializedText, focusInputAtEnd]
  )
  const insertPluginPrompt = React.useCallback(
    (pluginId: AppPluginId, replaceAll = false) => {
      setSelectedSkill(null)
      const plugin = availableAppPlugins.find((item) => item.id === pluginId)
      const label = plugin?.title ?? pluginId
      const pluginNode = createPluginReferenceNode(
        pluginId,
        label,
        getAppPluginPromptContent(pluginId)
      )
      const pluginDocument: EditorDocumentNode[] = [pluginNode, createTextReplacementNode('\n')]

      if (replaceAll) {
        setDocumentNodes(pluginDocument)
        setSelectedFiles([])
        requestAnimationFrame(() => {
          focusInputAtEnd()
        })
        return
      }

      if (
        documentRef.current.some((node) => node.type === 'plugin' && node.pluginId === pluginId)
      ) {
        requestAnimationFrame(() => {
          focusInputAtEnd()
        })
        return
      }

      const selection = editorRef.current?.getSelectionOffsets() ?? editorSelection
      const nextDocument = replaceEditorRange(
        documentRef.current,
        selectedFilesRef.current,
        selection.start,
        selection.end,
        pluginDocument
      )
      const referencedFileIds = new Set(
        nextDocument
          .filter(
            (node): node is Extract<EditorDocumentNode, { type: 'file' }> => node.type === 'file'
          )
          .map((node) => node.fileId)
      )

      setDocumentNodes(nextDocument)
      setSelectedFiles((currentFiles) =>
        currentFiles.filter((file) => referencedFileIds.has(file.id))
      )
      requestAnimationFrame(() => {
        focusInputAtEnd()
      })
    },
    [availableAppPlugins, editorSelection, focusInputAtEnd]
  )
  const applySlashSuggestion = React.useCallback(
    (item: SlashSuggestionItem) => {
      if (item.kind === 'skill') {
        selectSlashSkill(item.name)
        return
      }
      if (item.kind === 'plugin' && item.pluginId) {
        insertPluginPrompt(item.pluginId, true)
        return
      }
      insertSlashCommand(item.name)
    },
    [insertPluginPrompt, insertSlashCommand, selectSlashSkill]
  )
  const activeProviderForAuth = useProviderStore(
    useShallow((s) => {
      const provider = s.providers.find((p) => p.id === s.activeProviderId)
      return provider ? { apiKey: provider.apiKey, requiresApiKey: provider.requiresApiKey } : null
    })
  )
  const providersCount = useProviderStore((s) => s.providers.length)
  const hasApiKey = providersCount === 0 || !!activeProviderForAuth?.apiKey || activeProviderForAuth?.requiresApiKey === false
  const needsWorkingFolder = projectScoped && !workingFolder && Boolean(onSelectFolder)
  const planMode = useUIStore((s) =>
    draftSessionId ? Boolean(s.planModesBySession[draftSessionId]) : pendingPlanMode
  )
  const activeGoal = useGoalStore((s) =>
    draftSessionId ? s.goalsBySession[draftSessionId] : undefined
  )
  const hasActiveGoal = activeGoal?.status === 'active'
  const hasPendingGoalMode = pendingGoalMode && !hasActiveGoal
  const goalModeEnabled = hasActiveGoal || hasPendingGoalMode
  const pendingReviewPlanId = usePlanStore((s) =>
    draftSessionId ? (s.getPendingReviewPlan(draftSessionId)?.id ?? null) : null
  )

  React.useEffect(() => {
    if (draftSessionId) {
      setPendingPlanMode(false)
    }
    setPendingGoalMode(false)
  }, [draftSessionId])

  React.useEffect(() => {
    if (hasActiveGoal) {
      setPendingGoalMode(false)
    }
  }, [hasActiveGoal])

  React.useEffect(() => {
    let cancelled = false

    if (!workspaceReady || activeSshConnectionId) {
      setIsWorkspaceAgentsMissing(false)
      return
    }

    setIsWorkspaceAgentsMissing(false)

    void resolveProjectMemoryTextFile(ipcClient, workingFolder ?? '', 'AGENTS.md').then(
      ({ missingFile }) => {
        if (cancelled) return
        setIsWorkspaceAgentsMissing(missingFile)
      }
    )

    return () => {
      cancelled = true
    }
  }, [activeSshConnectionId, workspaceReady, workingFolder])

  React.useEffect(() => {
    if (!shouldAutoAcceptRecommendation || !suggestionText || !text.trim()) {
      setAutoAcceptCountdown(null)
      return
    }

    setAutoAcceptCountdown(8)

    const intervalId = window.setInterval(() => {
      setAutoAcceptCountdown((prev) => {
        if (prev === null) return null
        return prev > 1 ? prev - 1 : 0
      })
    }, 1000)

    const timeoutId = window.setTimeout(() => {
      const acceptedSuggestion = acceptSuggestion()
      if (!acceptedSuggestion) return
      applyEditorStateFromSerializedText(acceptedSuggestion, selectedFiles)
      setAutoAcceptCountdown(null)
      requestAnimationFrame(() => {
        focusInputAtEnd()
        handleRecommendationSelectionChange()
      })
    }, 8000)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, [
    acceptSuggestion,
    applyEditorStateFromSerializedText,
    focusInputAtEnd,
    handleRecommendationSelectionChange,
    selectedFiles,
    shouldAutoAcceptRecommendation,
    suggestionText,
    text
  ])

  React.useEffect(() => {
    if (!inputDraftHydrated) return

    clearTimeout(draftSaveTimerRef.current)
    const persistedText = persistedDraft?.text ?? ''
    const persistedSelectedFiles = persistedDraft?.selectedFiles ?? []
    const shouldResetHomeReferenceDraft =
      isHomeComposer &&
      !persistedDraft?.skill &&
      (persistedDraft?.images?.length ?? 0) === 0 &&
      isReferenceOnlyDocument(
        deserializeEditorState(persistedText, workingFolder, persistedSelectedFiles).document
      )

    draftReadyKeyRef.current = null
    applyEditorStateFromSerializedText(
      shouldResetHomeReferenceDraft ? '' : persistedText,
      shouldResetHomeReferenceDraft ? [] : persistedSelectedFiles
    )
    setAttachedImages(persistedDraft?.images ? cloneImageAttachments(persistedDraft.images) : [])
    setPreviewImage(null)
    setSelectedSkill(persistedDraft?.skill ?? null)
    setHighlightedFileId(null)
    setEditorSelection({ start: 0, end: 0 })

    const rafId = window.requestAnimationFrame(() => {
      draftReadyKeyRef.current = activeDraftKey
    })

    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [
    activeDraftKey,
    applyEditorStateFromSerializedText,
    inputDraftHydrated,
    isHomeComposer,
    persistedDraft,
    workingFolder
  ])

  React.useEffect(() => {
    if (isStreaming || disabled || !inputDraftHydrated) return

    const rafId = window.requestAnimationFrame(() => {
      if (activeDraftKey && draftReadyKeyRef.current !== activeDraftKey) return

      const activeElement = document.activeElement
      if (
        activeElement &&
        activeElement !== document.body &&
        !rootRef.current?.contains(activeElement)
      ) {
        return
      }

      editorRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [activeDraftKey, disabled, inputDraftHydrated, isStreaming])

  React.useEffect(() => {
    if (!activeDraftKey || !inputDraftHydrated) return
    if (draftReadyKeyRef.current !== activeDraftKey) return

    clearTimeout(draftSaveTimerRef.current)
    draftSaveTimerRef.current = setTimeout(() => {
      const nextDraft = {
        text: finalSerializedText,
        images: cloneImageAttachments(attachedImages),
        skill: selectedSkill,
        selectedFiles: selectedFiles.map((file) => ({ ...file }))
      }

      void savePersistedDraft(nextDraft)
    }, 400)

    return () => clearTimeout(draftSaveTimerRef.current)
  }, [
    activeDraftKey,
    attachedImages,
    finalSerializedText,
    inputDraftHydrated,
    selectedFiles,
    selectedSkill,
    savePersistedDraft
  ])

  // Consume pendingInsertText from FileTree clicks
  const pendingInsert = useUIStore((s) => s.pendingInsertText)
  React.useEffect(() => {
    if (!pendingInsert) return

    const selection = editorRef.current?.getSelectionOffsets() ?? {
      start: text.length,
      end: text.length
    }
    const pendingPlainText = selectFileTextToPlainText(pendingInsert)
    const needsPrefix =
      selection.start === selection.end &&
      selection.start > 0 &&
      !/\s$/.test(text.slice(0, selection.start)) &&
      pendingPlainText.length > 0 &&
      !/^\s/.test(pendingPlainText)

    replaceSelectionWithText(`${needsPrefix ? ' ' : ''}${pendingInsert}`, selection)
    useUIStore.getState().setPendingInsertText(null)
  }, [pendingInsert, replaceSelectionWithText, text])

  const addFilesToEditor = React.useCallback(
    (filePaths: string[], selection?: { start: number; end: number }) => {
      const nextSelection = selection ??
        editorRef.current?.getSelectionOffsets() ?? {
          start: editorSelection.start,
          end: editorSelection.end
        }
      const filesToInsert: SelectedFileItem[] = []
      let mergedFiles = selectedFilesRef.current

      for (const filePath of filePaths) {
        const ensured = ensureSelectedFile(mergedFiles, filePath, workingFolder)
        mergedFiles = ensured.files
        if (ensured.file) {
          filesToInsert.push(ensured.file)
        }
      }

      if (filesToInsert.length === 0) return

      const replacement = filesToInsert
        .map((file) => createSelectFileToken(file.sendPath))
        .filter(Boolean)
        .join('\n')

      replaceSelectionWithText(replacement, nextSelection, 0, mergedFiles)
    },
    [editorSelection.end, editorSelection.start, replaceSelectionWithText, workingFolder]
  )

  const {
    addImages, removeImage, getPastedImageFiles, handleAttachMedia
  } = useImageAttachments({
    supportsVision, t, addFilesToEditor,
    setAttachedImages, setPreviewImage, setPendingImageReads
  })

  const {
    queuedMessages, isQueueDispatchPaused,
    editingQueueItemId, editingQueueText, setEditingQueueText,
    editingQueueImages, queueClearConfirmOpen, setQueueClearConfirmOpen,
    queueFileInputRef,
    startEditQueuedMessage, cancelEditQueuedMessage, removeQueuedMessage,
    addQueuedImages, removeQueuedImage, saveQueuedMessage,
    clearQueuedMessagesForActiveSession, handleClearQueuedMessages,
    resumeQueuedMessages, quoteQueuedMessage, handleQueueEditPaste
  } = useQueuedMessages({
    activeSessionId, suppressPendingQueue, t, isStreaming,
    getPastedImageFiles, setPreviewImage
  })

  const handlePreviewFile = React.useCallback(
    (fileId: string) => {
      const file = selectedFilesRef.current.find((item) => item.id === fileId)
      if (file) {
        openFilePreview(file.previewPath)
      }
    },
    [openFilePreview]
  )

  const handleLocateFileReference = React.useCallback((fileId: string) => {
    setHighlightedFileId(fileId)
    editorRef.current?.scrollToReference(fileId)
    editorRef.current?.focus()
  }, [])

  const handleEditorSelectionChange = React.useCallback(
    (selection: { start: number; end: number }) => {
      setEditorSelection((current) =>
        current.start === selection.start && current.end === selection.end ? current : selection
      )
      handleRecommendationSelectionChange()
    },
    [handleRecommendationSelectionChange]
  )

  const handleRemoveFileReference = React.useCallback((nodeId: string) => {
    const currentDocument = documentRef.current
    const targetNode = currentDocument.find((node) => node.type !== 'text' && node.id === nodeId)
    if (!targetNode) return

    const nextDocument = removeReferenceNode(currentDocument, nodeId, selectedFilesRef.current)
    const nextFiles =
      targetNode.type === 'file' && !documentHasFileReferences(nextDocument, targetNode.fileId)
        ? selectedFilesRef.current.filter((file) => file.id !== targetNode.fileId)
        : selectedFilesRef.current

    setDocumentNodes(nextDocument)
    setSelectedFiles(nextFiles)
  }, [])

  const handleEditorDocumentChange = React.useCallback((nextDocument: EditorDocumentNode[]) => {
    const referencedFileIds = new Set(
      nextDocument
        .filter(
          (node): node is Extract<EditorDocumentNode, { type: 'file' }> => node.type === 'file'
        )
        .map((node) => node.fileId)
    )
    setDocumentNodes(nextDocument)
    setSelectedFiles((currentFiles) =>
      currentFiles.filter((file) => referencedFileIds.has(file.id))
    )
  }, [])

  const getLiveEditorState = React.useCallback(() => {
    const liveDocument = editorRef.current?.getDocumentSnapshot() ?? documentRef.current
    const referencedFileIds = new Set(
      liveDocument
        .filter(
          (node): node is Extract<EditorDocumentNode, { type: 'file' }> => node.type === 'file'
        )
        .map((node) => node.fileId)
    )
    const liveSelectedFiles = selectedFilesRef.current.filter((file) =>
      referencedFileIds.has(file.id)
    )

    return {
      plainText: editorDocumentToPlainText(liveDocument, liveSelectedFiles),
      serializedText: serializeEditorDocument(liveDocument, liveSelectedFiles),
      promptText: serializeEditorDocument(liveDocument, liveSelectedFiles, {
        expandPluginPrompts: true
      }),
      selectedFiles: liveSelectedFiles
    }
  }, [])

  const resetComposer = React.useCallback((): void => {
    clearTimeout(draftSaveTimerRef.current)
    void removePersistedDraft()

    setDocumentNodes([])
    setSelectedFiles([])
    setHighlightedFileId(null)
    setEditorSelection({ start: 0, end: 0 })
    setAttachedImages([])
    setPreviewImage(null)
    setSelectedSkill(null)
    requestAnimationFrame(() => {
      editorRef.current?.setSelectionOffsets(0, 0)
    })
  }, [removePersistedDraft])

  const handleSend = React.useCallback((): void => {
    const liveEditorState = getLiveEditorState()
    const promptText = liveEditorState.promptText.trim()
    if (!promptText && attachedImages.length === 0) return
    if (disabled || needsWorkingFolder || pendingImageReads > 0) return

    let goalObjective: string | undefined
    if (hasPendingGoalMode && promptText) {
      const validation = validateGoalObjective(promptText)
      if (validation) {
        toast.error(t('goal.toasts.objectiveInvalid'), { description: validation })
        return
      }
      goalObjective = promptText
    }

    cancelPromptRecommendation()

    const hasLeadingSlashCommand = liveEditorState.plainText.trimStart().startsWith('/')
    const message =
      selectedSkill && !hasLeadingSlashCommand
        ? `[Skill: ${selectedSkill}]\n${promptText}`
        : promptText
    const sendOptions: SendMessageOptions = {
      clearCompletedTasksOnTurnStart: true,
      enablePlanMode: planMode || undefined
    }
    const selectedFileReferences = liveEditorState.selectedFiles.map(selectedFileItemToReference)
    if (selectedFileReferences.length > 0) {
      sendOptions.selectedFileReferences = selectedFileReferences
    }
    if (goalObjective) {
      sendOptions.goalObjective = goalObjective
    }

    onSend?.(message, attachedImages.length > 0 ? attachedImages : undefined, sendOptions)

    resetComposer()
    if (goalObjective) {
      setPendingGoalMode(false)
    }
  }, [
    getLiveEditorState,
    attachedImages,
    disabled,
    needsWorkingFolder,
    pendingImageReads,
    hasPendingGoalMode,
    cancelPromptRecommendation,
    selectedSkill,
    onSend,
    planMode,
    resetComposer,
    t
  ])

  const handlePlanModeChange = React.useCallback(
    (enabled: boolean): void => {
      if (enabled && !projectScoped) {
        toast.error(
          t('input.planModeUnavailable', {
            defaultValue: 'Plan Mode needs a project working folder.'
          })
        )
        return
      }

      if (draftSessionId) {
        if (enabled) {
          useUIStore.getState().enterPlanMode(draftSessionId)
        } else {
          useUIStore.getState().exitPlanMode(draftSessionId)
        }
        return
      }

      setPendingPlanMode(enabled)
    },
    [draftSessionId, projectScoped, t]
  )

  const handleGoalModeChange = React.useCallback(
    (enabled: boolean): void => {
      if (disabled || isStreaming || isOptimizingLocked || pendingImageReads > 0) return

      if (!enabled) {
        setPendingGoalMode(false)
        if (draftSessionId && hasActiveGoal) {
          void useGoalStore
            .getState()
            .loadGoalForSession(draftSessionId, true)
            .then(() => useGoalStore.getState().updateGoal(draftSessionId, { status: 'paused' }))
            .then((result) => {
              if (!result.success) {
                toast.error(t('goal.toasts.updateFailed'), { description: result.error })
              }
            })
        }
        return
      }

      if (hasActiveGoal) return
      setPendingGoalMode(true)
      requestAnimationFrame(() => {
        focusInputAtEnd()
      })
    },
    [
      disabled,
      draftSessionId,
      focusInputAtEnd,
      hasActiveGoal,
      isOptimizing,
      isStreaming,
      pendingImageReads,
      t
    ]
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      // keyCode 229 marks the keydown that starts an IME composition, which
      // fires before nativeEvent.isComposing becomes true.
      if (e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229 || isOptimizingLocked) return

      if (fileMenuOpen) {
        if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedFileSearchIndex((prev) =>
            fileSearchResults.length === 0 ? 0 : (prev + 1) % fileSearchResults.length
          )
          return
        }
        if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedFileSearchIndex((prev) =>
            fileSearchResults.length === 0
              ? 0
              : (prev - 1 + fileSearchResults.length) % fileSearchResults.length
          )
          return
        }
        if (!e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'Tab' || e.key === 'Enter')) {
          const selectedFile = fileSearchResults[selectedFileSearchIndex]
          if (selectedFile) {
            e.preventDefault()
            insertSelectedFile(selectedFile.path)
            return
          }
        }
        if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'Escape') {
          e.preventDefault()
          const nextCursor = activeFileMention?.start ?? 0
          editorRef.current?.focus()
          editorRef.current?.setSelectionOffsets(nextCursor, nextCursor)
          setEditorSelection({ start: nextCursor, end: nextCursor })
          handleRecommendationSelectionChange()
          return
        }
      }

      if (slashMenuOpen) {
        if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedSlashIndex((prev) =>
            filteredSlashSuggestions.length === 0 ? 0 : (prev + 1) % filteredSlashSuggestions.length
          )
          return
        }
        if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedSlashIndex((prev) =>
            filteredSlashSuggestions.length === 0
              ? 0
              : (prev - 1 + filteredSlashSuggestions.length) % filteredSlashSuggestions.length
          )
          return
        }
        if (!e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'Tab' || e.key === 'Enter')) {
          const selectedSuggestion = filteredSlashSuggestions[selectedSlashIndex]
          if (selectedSuggestion) {
            e.preventDefault()
            applySlashSuggestion(selectedSuggestion)
            return
          }
        }
      }

      if (!e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === 'Tab') {
        const acceptedSuggestion = acceptSuggestion()
        if (acceptedSuggestion) {
          e.preventDefault()
          applyEditorStateFromSerializedText(acceptedSuggestion, selectedFiles)
          requestAnimationFrame(() => {
            focusInputAtEnd()
            handleRecommendationSelectionChange()
          })
          return
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [
      isOptimizing,
      fileMenuOpen,
      slashMenuOpen,
      fileSearchResults,
      selectedFileSearchIndex,
      filteredSlashSuggestions,
      selectedSlashIndex,
      activeFileMention,
      insertSelectedFile,
      applySlashSuggestion,
      acceptSuggestion,
      applyEditorStateFromSerializedText,
      selectedFiles,
      focusInputAtEnd,
      handleRecommendationSelectionChange,
      handleSend
    ]
  )

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>): void => {
      const imageFiles = getPastedImageFiles(e.clipboardData)

      if (imageFiles.length > 0) {
        e.preventDefault()
        void addImages(imageFiles)
        return
      }

      const plainText = e.clipboardData.getData('text/plain')
      if (!plainText) return

      e.preventDefault()
      const selection = editorRef.current?.getSelectionOffsets() ?? editorSelection
      replaceSelectionWithText(plainText, selection)
    },
    [addImages, editorSelection, getPastedImageFiles, replaceSelectionWithText]
  )

  const getDraggedFilePaths = React.useCallback((dataTransfer: DataTransfer | null): string[] => {
    if (!dataTransfer) return []
    const payload = dataTransfer.getData(INTERNAL_FILE_DRAG_MIME)
    if (!payload) return []

    try {
      const parsed = JSON.parse(payload)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
    } catch {
      return []
    }
  }, [])

  const handleDropFiles = React.useCallback(
    (dataTransfer: DataTransfer | null) => {
      if (!dataTransfer || dataTransfer.files.length === 0) return
      const paths = getDroppedLocalPaths(dataTransfer)
      const fallbackPaths = Array.from(dataTransfer.files)
        .map((f) => (f as File & { path?: string }).path)
        .filter((filePath): filePath is string => Boolean(filePath))
      const uniquePaths = Array.from(new Set([...paths, ...fallbackPaths]))

      if (uniquePaths.length > 0) {
        addFilesToEditor(uniquePaths)
      }
    },
    [addFilesToEditor]
  )

  const [dragging, setDragging] = useLocalState(false)

  const handleDragOver = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      const transfer = e.dataTransfer
      const types = Array.from(transfer?.types ?? [])
      const canHandle = types.includes('Files') || types.includes(INTERNAL_FILE_DRAG_MIME)
      if (!canHandle) return
      e.preventDefault()
      if (transfer) {
        transfer.dropEffect = 'copy'
      }
      setDragging(true)
    },
    [setDragging]
  )

  const handleDragLeave = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      const nextTarget = e.relatedTarget as Node | null
      if (nextTarget && e.currentTarget.contains(nextTarget)) return
      setDragging(false)
    },
    [setDragging]
  )

  const handleDropWrapped = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      const draggedPaths = getDraggedFilePaths(e.dataTransfer)
      const hasNativeFiles = (e.dataTransfer?.files?.length ?? 0) > 0
      if (draggedPaths.length === 0 && !hasNativeFiles) return
      e.preventDefault()
      setDragging(false)
      if (draggedPaths.length > 0) {
        addFilesToEditor(draggedPaths)
        return
      }
      handleDropFiles(e.dataTransfer ?? null)
    },
    [addFilesToEditor, getDraggedFilePaths, handleDropFiles, setDragging]
  )

  const handleCompressContext = React.useCallback(() => {
    if (!onCompressContext || isContextCompressing) return

    clearTimeout(contextCompressionStatusTimerRef.current)
    setContextCompressionStatus('compressing')
    void Promise.resolve()
      .then(() => onCompressContext())
      .then((result) => {
        setContextCompressionStatus(result ?? 'compressed')
      })
      .catch((error) => {
        console.error('[InputArea] Context compression failed', error)
        setContextCompressionStatus('failed')
      })
      .finally(() => {
        contextCompressionStatusTimerRef.current = setTimeout(() => {
          setContextCompressionStatus('idle')
        }, 3200)
      })
  }, [isContextCompressing, onCompressContext])

  const contextCompressionStatusLabel = React.useMemo(() => {
    switch (contextCompressionStatus) {
      case 'compressing':
        return t('input.compressingContext', { defaultValue: 'Compressing context...' })
      case 'compressed':
        return t('input.contextCompressed', { defaultValue: 'Context compressed' })
      case 'skipped':
        return t('input.contextCompressionSkipped', { defaultValue: 'No compression needed' })
      case 'blocked':
        return t('input.contextCompressionBlocked', {
          defaultValue: 'Compression temporarily unavailable'
        })
      case 'failed':
        return t('input.contextCompressionFailed', { defaultValue: 'Compression failed' })
      default:
        return ''
    }
  }, [contextCompressionStatus, t])

  const composerVariant = 'session'
  const composerIconControlClass = 'composer-control rounded-xl'

  const webSearchToggleControl = canToggleWebSearch && (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={composerIconControlClass}
          data-active={webSearchEnabled ? 'true' : 'false'}
          onClick={toggleWebSearch}
          disabled={disabled || isStreaming}
        >
          <Globe className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {webSearchEnabled
          ? t('input.disableWebSearch', { defaultValue: 'Disable web search' })
          : t('input.enableWebSearch', { defaultValue: 'Enable web search' })}
      </TooltipContent>
    </Tooltip>
  )

  const skillsMenuControl = (
    <SkillsMenu
      onSelectSkill={(name) => {
        setSelectedSkill(name)
        editorRef.current?.focus()
      }}
      onSelectCommand={(name) => {
        insertSlashCommand(name)
      }}
      onSelectPlugin={(pluginId) => {
        insertPluginPrompt(pluginId)
      }}
      onAttachMedia={() => void handleAttachMedia()}
      disabled={disabled || isStreaming}
      projectId={activeProjectId}
      showChannels={mode !== 'chat'}
      triggerClassName={composerIconControlClass}
      menuClassName="composer-flyout"
      showModeToggles={!hideModeSwitch}
      planModeEnabled={planMode}
      goalModeEnabled={goalModeEnabled}
      planModeDisabled={disabled || isStreaming || !projectScoped}
      goalModeDisabled={disabled || isStreaming || isOptimizingLocked || pendingImageReads > 0}
      onPlanModeChange={handlePlanModeChange}
      onGoalModeChange={handleGoalModeChange}
    />
  )

  const activeMcpBadge = <ActiveMcpsBadge projectId={activeProjectId} />
  const activeExtensionBadge = <ActiveExtensionsBadge projectId={activeProjectId} />

  const folderControl = onSelectFolder && !hideWorkingFolderPicker && (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={composerIconControlClass}
          onClick={onSelectFolder}
        >
          <FolderOpen className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t('input.selectFolder')}</TooltipContent>
    </Tooltip>
  )

  const optimizeControl = !isStreaming && (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={composerIconControlClass}
          onClick={handleOptimizePrompt}
          disabled={!text.trim() || disabled || isOptimizingLocked}
        >
          {isOptimizing ? <Spinner className="size-4" /> : <Wand2 className="size-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isOptimizing ? t('input.optimizing') : t('input.optimizePrompt')}
      </TooltipContent>
    </Tooltip>
  )

  const permissionMode: 'default' | 'whitelist' | 'fullAccess' = autoApprove
    ? 'fullAccess'
    : permissionWhitelistEnabled
      ? 'whitelist'
      : 'default'

  const handleSelectPermissionMode = async (
    mode: 'default' | 'whitelist' | 'fullAccess'
  ): Promise<void> => {
    if (mode === permissionMode) return
    if (mode === 'fullAccess') {
      const ok = await confirm({
        title: t('permission.fullAccessConfirmTitle'),
        description: t('permission.fullAccessConfirmDesc'),
        confirmLabel: t('permission.fullAccess'),
        variant: 'destructive'
      })
      if (!ok) return
      useSettingsStore.getState().updateSettings({ autoApprove: true })
      return
    }
    const { permissionPolicy } = useSettingsStore.getState()
    useSettingsStore.getState().updateSettings({
      autoApprove: false,
      permissionPolicy: { ...permissionPolicy, enabled: mode === 'whitelist' }
    })
  }

  const permissionControl = (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                composerIconControlClass,
                'gap-1.5 px-2 text-xs font-medium',
                permissionMode === 'fullAccess' && 'text-amber-600 dark:text-amber-400',
                permissionMode === 'whitelist' && 'text-emerald-600 dark:text-emerald-400'
              )}
              aria-label={t('permission.label')}
            >
              {permissionMode === 'fullAccess' ? (
                <ShieldAlert className="size-3.5" />
              ) : (
                <ShieldCheck className="size-3.5" />
              )}
              <span className="max-w-24 truncate">
                {permissionMode === 'fullAccess'
                  ? t('permission.fullAccess')
                  : permissionMode === 'whitelist'
                    ? t('permission.whitelist')
                    : t('permission.default')}
              </span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('permission.tooltip')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem
          className="flex-col items-start gap-0.5"
          onSelect={() => void handleSelectPermissionMode('default')}
        >
          <div className="flex w-full items-center gap-2">
            <ShieldCheck className="size-3.5" />
            <span className="flex-1 font-medium">{t('permission.default')}</span>
            {permissionMode === 'default' && <Check className="size-3.5" />}
          </div>
          <span className="pl-[1.375rem] text-xs text-muted-foreground">
            {t('permission.defaultDesc')}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex-col items-start gap-0.5"
          onSelect={() => void handleSelectPermissionMode('whitelist')}
        >
          <div className="flex w-full items-center gap-2">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="flex-1 font-medium">{t('permission.whitelist')}</span>
            {permissionMode === 'whitelist' && <Check className="size-3.5" />}
          </div>
          <span className="pl-[1.375rem] text-xs text-muted-foreground">
            {t('permission.whitelistDesc')}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex-col items-start gap-0.5"
          onSelect={() => void handleSelectPermissionMode('fullAccess')}
        >
          <div className="flex w-full items-center gap-2">
            <ShieldAlert className="size-3.5 text-amber-600 dark:text-amber-400" />
            <span className="flex-1 font-medium">{t('permission.fullAccess')}</span>
            {permissionMode === 'fullAccess' && <Check className="size-3.5" />}
          </div>
          <span className="pl-[1.375rem] text-xs text-muted-foreground">
            {t('permission.fullAccessDesc')}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => openSettings('permission')}>
          <span className="text-xs">{t('permission.manageWhitelist')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const sendControl = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="default"
          className="composer-send rounded-xl px-3.5 transition-[filter,box-shadow] duration-200"
          data-composer-variant={composerVariant}
          data-tone={isStreaming ? 'warning' : undefined}
          onMouseDown={(event) => {
            event.preventDefault()
          }}
          onClick={isStreaming ? () => onStop?.() : handleSend}
          disabled={
            isStreaming
              ? false
              : (!finalSerializedText.trim() && attachedImages.length === 0) ||
                disabled ||
                needsWorkingFolder ||
                pendingImageReads > 0 ||
                isOptimizingLocked
          }
          aria-label={isStreaming ? t('input.stopTooltip') : t('input.sendTooltip')}
        >
          {isStreaming ? (
            <>
              <Spinner className="mr-1.5 size-3.5" />
              <span>{t('action.stop', { ns: 'common' })}</span>
            </>
          ) : (
            <>
              <span>{t(sessionId ? 'action.send' : 'action.start', { ns: 'common' })}</span>
              <Send className="ml-1.5 size-3.5" />
            </>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isStreaming ? t('input.stopTooltip') : t('input.sendTooltip')}
      </TooltipContent>
    </Tooltip>
  )

  const queuedMessagesPanel =
    queuedMessages.length > 0 ? (
      <>
        <div
          className={cn(
            composerWidthClass,
            'mb-2 overflow-hidden rounded-lg border border-border/50 bg-muted/20 shadow-sm backdrop-blur'
          )}
        >
          <div className="max-h-40 overflow-y-auto py-1">
            <AnimatePresence initial={false}>
              {queuedMessages.map((msg, index) => {
                const isEditing = editingQueueItemId === msg.id
                const summaryText = summarizeQueuedMessage(msg.text)
                const commandLabel = msg.command ? `/${msg.command.name}` : ''
                const fallbackText =
                  summaryText ||
                  commandLabel ||
                  t('input.queueImageOnly', { defaultValue: '[Images only]' })
                const quoteLabel = t('input.queueQuote', { defaultValue: 'Quote' })

                return (
                  <motion.div
                    key={msg.id}
                    layout={animationsEnabled}
                    initial={animationsEnabled ? { opacity: 0, y: 4 } : false}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={
                      animationsEnabled
                        ? { opacity: 0, height: 0, minHeight: 0, paddingTop: 0, paddingBottom: 0 }
                        : undefined
                    }
                    transition={
                      animationsEnabled ? { duration: 0.18, ease: 'easeOut' } : { duration: 0 }
                    }
                    className={cn(
                      'overflow-hidden border-b border-border/35 last:border-b-0',
                      isEditing ? 'px-3 py-2' : 'group flex min-h-8 items-center gap-2 px-3 py-1'
                    )}
                  >
                    {isEditing ? (
                      <div className="w-full space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {t('input.queueEditing', { defaultValue: 'Edit queued message' })}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-md px-2 text-[10px] text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                              onClick={() => saveQueuedMessage(msg.id)}
                            >
                              {t('action.save', { ns: 'common' })}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-md px-2 text-[10px] text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                              onClick={cancelEditQueuedMessage}
                            >
                              {t('action.cancel', { ns: 'common' })}
                            </Button>
                          </div>
                        </div>
                        {msg.command && (
                          <div className="rounded-md border border-violet-500/20 bg-violet-500/5 px-2.5 py-1.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                            /{msg.command.name}
                          </div>
                        )}
                        <Textarea
                          value={editingQueueText}
                          onChange={(e) => setEditingQueueText(e.target.value)}
                          onPaste={handleQueueEditPaste}
                          className="composer-aux-textarea min-h-[56px] max-h-36 resize-none text-xs"
                          rows={2}
                        />
                        {editingQueueImages.length > 0 && (
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {editingQueueImages.map((img) => (
                              <div key={img.id} className="relative group/img shrink-0">
                                <button
                                  type="button"
                                  className="block cursor-zoom-in rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  aria-label={t('userMessage.imagePreview')}
                                  title={t('userMessage.imagePreview')}
                                  onClick={() => setPreviewImage(img)}
                                >
                                  <img
                                    src={img.dataUrl}
                                    alt=""
                                    className="composer-image-thumb size-12 rounded-lg object-cover transition-transform group-hover/img:scale-[1.03]"
                                  />
                                </button>
                                <button
                                  type="button"
                                  className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm opacity-0 transition-opacity group-hover/img:opacity-100"
                                  aria-label={t('userMessage.removeImage')}
                                  title={t('userMessage.removeImage')}
                                  onClick={() => removeQueuedImage(img.id)}
                                >
                                  <X className="size-2.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          {editingQueueImages.length > 0 ? (
                            <p className="text-[10px] text-muted-foreground">
                              {t('input.queueImageCount', {
                                defaultValue: '{{count}} images',
                                count: editingQueueImages.length
                              })}
                            </p>
                          ) : (
                            <span />
                          )}
                          {supportsVision && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-md px-2 text-[10px] text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                              onClick={() => queueFileInputRef.current?.click()}
                            >
                              <ImagePlus className="size-3" />
                              {t('input.attachImages')}
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <CornerDownRight className="size-3 shrink-0 text-muted-foreground/65" />
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          title={fallbackText}
                          onClick={() => startEditQueuedMessage(msg)}
                        >
                          <span className="block truncate text-xs leading-5 text-muted-foreground/90 group-hover:text-foreground">
                            {fallbackText}
                          </span>
                        </button>
                        {commandLabel && summaryText ? (
                          <span className="hidden shrink-0 rounded border border-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-700 sm:inline-flex dark:text-violet-300">
                            {commandLabel}
                          </span>
                        ) : null}
                        {msg.images.length > 0 ? (
                          <span className="hidden shrink-0 rounded border border-border/60 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-flex">
                            {t('input.queueImageCount', {
                              defaultValue: '{{count}} images',
                              count: msg.images.length
                            })}
                          </span>
                        ) : null}
                        <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
                          {isQueueDispatchPaused && index === 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-md px-2 text-[10px] text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                              onClick={resumeQueuedMessages}
                              title={t('input.queueResume', { defaultValue: 'Resume' })}
                              aria-label={t('input.queueResume', { defaultValue: 'Resume' })}
                            >
                              <Send className="size-3" />
                              <span className="hidden sm:inline">
                                {t('input.queueResume', { defaultValue: 'Resume' })}
                              </span>
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-md px-2 text-[10px] text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                            onClick={() => quoteQueuedMessage(msg.id)}
                            title={quoteLabel}
                            aria-label={quoteLabel}
                          >
                            <CornerDownRight className="size-3" />
                            <span className="hidden sm:inline">{quoteLabel}</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => removeQueuedMessage(msg.id)}
                            title={t('action.delete', { ns: 'common' })}
                            aria-label={t('action.delete', { ns: 'common' })}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7 rounded-md text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                                title={t('action.more', { ns: 'common' })}
                                aria-label={t('action.more', { ns: 'common' })}
                              >
                                <Ellipsis className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-36">
                              {isQueueDispatchPaused ? (
                                <DropdownMenuItem onSelect={resumeQueuedMessages}>
                                  <Send className="size-3.5" />
                                  {t('input.queueResume', { defaultValue: 'Resume' })}
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem onSelect={() => quoteQueuedMessage(msg.id)}>
                                <CornerDownRight className="size-3.5" />
                                {quoteLabel}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={handleClearQueuedMessages}
                              >
                                <Trash2 className="size-3.5" />
                                {t('action.clear', { ns: 'common' })}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </div>

        <AlertDialog open={queueClearConfirmOpen} onOpenChange={setQueueClearConfirmOpen}>
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('input.queueClearConfirmTitle', {
                  defaultValue: 'Clear queued messages?'
                })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('input.queueClearConfirmDesc', {
                  defaultValue:
                    'This will delete {{count}} pending messages in the current session.',
                  count: queuedMessages.length
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel size="sm">
                {t('action.cancel', { ns: 'common' })}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                size="sm"
                onClick={clearQueuedMessagesForActiveSession}
              >
                {t('action.clear', { ns: 'common' })}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    ) : null

  return (
    <div
      ref={rootRef}
      data-tour="composer"
      className={cn('px-4 py-3', attachedFooter ? 'pb-0' : 'pb-4')}
    >
      {/* API key warning */}
      {!hasApiKey && (
        <button
          type="button"
          className="mb-2 flex w-full items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-left text-xs text-amber-600 dark:text-amber-400 transition-colors hover:bg-amber-500/10"
          onClick={() => openSettings('provider')}
        >
          <AlertTriangle className="size-3.5 shrink-0" />
          <span>{t('input.noApiKey')}</span>
        </button>
      )}

      {/* Working folder required warning */}
      {needsWorkingFolder && onSelectFolder && (
        <button
          type="button"
          className="mb-2 flex w-full items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-left text-xs text-amber-600 dark:text-amber-400 transition-colors hover:bg-amber-500/10"
          onClick={onSelectFolder}
        >
          <FolderOpen className="size-3.5 shrink-0" />
          <span>{t('input.noWorkingFolder', { mode })}</span>
        </button>
      )}

      {/* Plan mode banner */}
      {planMode && projectScoped && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-md border border-violet-500/30 bg-violet-500/5 px-3 py-1.5">
          <div className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400">
            <ClipboardList className="size-3.5 shrink-0" />
            <span>
              {t('input.planModeActive', {
                defaultValue: 'Plan Mode — exploring codebase, no file changes'
              })}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] text-violet-600 dark:text-violet-400 hover:bg-violet-500/10"
            onClick={() => useUIStore.getState().exitPlanMode(draftSessionId)}
          >
            {t('input.exitPlanMode', { defaultValue: 'Exit Plan Mode' })}
          </Button>
        </div>
      )}

      {/* Working folder indicator */}
      {workingFolder && !hideWorkingFolderIndicator && (
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <FolderOpen className="size-3" />
          <span className="truncate">{workingFolder}</span>
        </div>
      )}

      {queuedMessagesPanel}

      {!hideGoalSessionBar && draftSessionId && (
        <GoalSessionBar
          sessionId={draftSessionId}
          className={cn('mb-2', fullWidth && 'max-w-none')}
        />
      )}

      {hasPendingGoalMode && (
        <div
          className={cn(
            composerWidthClass,
            'mb-2 flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-300'
          )}
        >
          <Target className="size-3.5 shrink-0" />
          <span>
            {t('input.pendingGoalBanner', {
              defaultValue:
                'Goal pursuit is ready. Your next text message will be used as the goal and sent normally.'
            })}
          </span>
        </div>
      )}

      <div className={composerWidthClass}>
        <div
          ref={containerRef}
          className={cn(
            'composer-shell relative flex flex-col transition-[box-shadow,border-color] duration-200',
            fileMenuOpen || slashMenuOpen ? 'overflow-visible' : 'overflow-hidden',
            attachedFooter && 'composer-shell--attached-footer',
            dragging && 'ring-2 ring-primary/50'
          )}
          data-composer-variant={composerVariant}
          style={
            inputHeight !== null
              ? { height: inputHeight }
              : { height: autoInputHeight, maxHeight: autoMaxInputHeight }
          }
        >
          {/* Top drag handle */}
          {isSessionComposer && (
            <div
              className="composer-drag-handle flex h-3 cursor-row-resize items-center justify-center"
              onMouseDown={handleDragStart}
            >
              <div className="composer-drag-grip h-1 w-11 rounded-full" />
            </div>
          )}
          {/* Skill tag */}
          {selectedSkill && (
            <div className="shrink-0 px-3 pt-3 pb-0">
              <span className="composer-skill-tag inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
                <Sparkles className="size-3" />
                {selectedSkill}
                <button
                  type="button"
                  className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                  onClick={() => setSelectedSkill(null)}
                >
                  <X className="size-3" />
                </button>
              </span>
            </div>
          )}

          {/* Image preview strip */}
          {attachedImages.length > 0 && (
            <div
              ref={imagePreviewRef}
              className="shrink-0 flex gap-2 overflow-x-auto px-3 pt-3 pb-1"
            >
              <AnimatePresence initial={false}>
                {attachedImages.map((img) => (
                  <motion.div
                    key={img.id}
                    layout={animationsEnabled}
                    initial={animationsEnabled ? { opacity: 0, scale: 0.9 } : false}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={animationsEnabled ? { opacity: 0, scale: 0.9 } : undefined}
                    transition={
                      animationsEnabled ? { duration: 0.15, ease: 'easeOut' } : { duration: 0 }
                    }
                    className="relative group/img shrink-0"
                  >
                    <button
                      type="button"
                      className="block cursor-zoom-in rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={t('userMessage.imagePreview')}
                      title={t('userMessage.imagePreview')}
                      onClick={() => setPreviewImage(img)}
                    >
                      <img
                        src={img.dataUrl}
                        alt=""
                        className="composer-image-thumb size-16 rounded-xl object-cover transition-transform group-hover/img:scale-[1.03]"
                      />
                    </button>
                    <button
                      type="button"
                      className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-destructive text-destructive-foreground shadow-md opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center"
                      aria-label={t('userMessage.removeImage')}
                      title={t('userMessage.removeImage')}
                      onClick={() => removeImage(img.id)}
                    >
                      <X className="size-3" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          <Dialog
            open={Boolean(previewImage)}
            onOpenChange={(open) => {
              if (!open) setPreviewImage(null)
            }}
          >
            <DialogContent className="max-h-[90vh] !w-fit !max-w-[min(96vw,1100px)] overflow-hidden p-2 sm:!max-w-[min(96vw,1100px)]">
              <DialogTitle className="sr-only">{t('userMessage.imagePreview')}</DialogTitle>
              {previewImage && (
                <div className="flex max-w-full items-center justify-center overflow-hidden">
                  <img
                    src={previewImage.dataUrl}
                    alt={t('userMessage.imagePreview')}
                    className="block h-auto max-h-[calc(90vh-1rem)] w-auto max-w-[min(92vw,1068px)] rounded object-contain"
                  />
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Optimizing indicator - only show spinner, hide text */}
          {isOptimizing && (
            <div className="shrink-0 px-3 pt-3 pb-1">
              <div className="composer-panel rounded-[14px] px-3 py-2">
                <div className="flex items-center gap-2 text-[var(--composer-chip-text)]">
                  <Spinner className="size-3.5" />
                  <span className="text-xs font-semibold">
                    {t('input.optimizing', { defaultValue: 'Optimizing your prompt...' })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Optimization Dialog */}
          <Dialog open={showOptimizationDialog} onOpenChange={setShowOptimizationDialog}>
            <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col gap-4 sm:max-w-7xl">
              <DialogHeader className="space-y-2 shrink-0">
                <DialogTitle className="text-xl flex items-center gap-2">
                  <Wand2 className="size-5 text-primary" />
                  {t('input.optimizationResults', { defaultValue: 'Optimized Prompt Options' })}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {t('input.optimizationResultsDesc', {
                    defaultValue:
                      'Select one of the optimized versions below to use in your prompt.'
                  })}
                </DialogDescription>
              </DialogHeader>

              {/* Tab-style Layout */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden gap-0">
                {/* Tabs - Options as tabs at top */}
                <div className="flex gap-2 border-b border-border shrink-0">
                  {optimizationOptions.map((option, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`flex-1 px-4 py-3 rounded-t-lg border-2 border-b-0 transition-all ${
                        selectedOptionIndex === idx
                          ? 'border-primary bg-primary/5 -mb-[2px] border-b-2 border-b-background'
                          : 'border-transparent hover:bg-muted/30'
                      }`}
                      onClick={() => {
                        setSelectedOptionIndex(idx)
                        if (contentScrollRef.current) {
                          contentScrollRef.current.scrollTop = 0
                        }
                      }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span
                          className={`inline-flex items-center justify-center size-6 rounded-full text-xs font-bold ${
                            selectedOptionIndex === idx
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-foreground">{option.title}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {option.focus}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                  {/* Loading placeholder tabs */}
                  {isOptimizing &&
                    Array.from({ length: Math.max(0, 3 - optimizationOptions.length) }).map((_, i) => (
                      <div
                        key={`loading-${i}`}
                        className="flex-1 px-4 py-3 rounded-t-lg border-2 border-b-0 border-transparent"
                      >
                        <div className="flex items-center justify-center gap-2 opacity-50">
                          <span className="inline-flex items-center justify-center size-6 rounded-full text-xs font-bold bg-muted text-muted-foreground">
                            {optimizationOptions.length + i + 1}
                          </span>
                          <div className="text-left">
                            <div className="h-3.5 w-20 bg-muted rounded animate-pulse" />
                            <div className="h-2.5 w-16 bg-muted rounded animate-pulse mt-1" />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 min-h-0 mt-2 overflow-hidden rounded-lg border border-border bg-background">
                  <div ref={contentScrollRef} className="h-full overflow-y-auto px-6 py-4">
                    {optimizationOptions[selectedOptionIndex] ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed font-sans">
                          {optimizationOptions[selectedOptionIndex]?.content}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Spinner className="size-4" />
                          <span className="text-sm">
                            {t('input.optimizing', { defaultValue: 'Optimizing your prompt...' })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between shrink-0">
                <Button variant="outline" onClick={handleCancelOptimization}>
                  {t('action.cancel', { ns: 'common' })}
                </Button>
                <Button
                  disabled={!optimizationOptions[selectedOptionIndex]}
                  onClick={() =>
                    handleSelectOption(optimizationOptions[selectedOptionIndex]?.content)
                  }
                >
                  {t('input.useThisOption', { defaultValue: 'Use This' })}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Text input area */}
          <div
            className={cn(
              'composer-editor-region relative flex min-h-0 flex-1 flex-col px-3',
              selectedSkill || attachedImages.length > 0 ? 'pt-1.5' : 'pt-3'
            )}
            onDrop={handleDropWrapped}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {dragging && (
              <div className="composer-drop-overlay absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <span className="flex items-center gap-1.5 text-xs text-primary/70 font-medium">
                  <FileUp className="size-3.5" />
                  {supportsVision ? t('input.dropImages') : t('input.dropFiles')}
                </span>
              </div>
            )}
            <div className="relative flex-1 min-h-0 overflow-visible">
              {shouldAutoAcceptRecommendation &&
                autoAcceptCountdown !== null &&
                suggestionText &&
                !hasFileReferences && (
                  <div className="pointer-events-none absolute right-2 top-2 z-20 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    {autoAcceptCountdown}s
                  </div>
                )}
              <FileAwareEditor
                ref={editorRef}
                document={documentNodes}
                files={selectedFiles}
                disabled={disabled || isOptimizingLocked}
                placeholder={
                  pendingReviewPlanId
                    ? t('input.placeholderPlanReview', {
                        defaultValue:
                          'Enter suggestions for this plan, or click the card above to implement it...'
                      })
                    : hasPendingGoalMode
                      ? t('input.placeholderPendingGoal', {
                          defaultValue: 'Describe the goal to pursue...'
                        })
                      : (effectivePlaceholder ??
                        (shouldRecommendInit
                          ? t('input.placeholderInitWorkspace')
                          : t(placeholderKeys[mode] ?? 'input.placeholder')))
                }
                suggestionText={suggestionText}
                showSuggestion={Boolean(
                  suggestionText &&
                  text.length > 0 &&
                  !hasFileReferences &&
                  !activeFileMention &&
                  !slashMenuOpen
                )}
                highlightedFileId={highlightedFileId}
                onDocumentChange={handleEditorDocumentChange}
                onSelectionChange={handleEditorSelectionChange}
                onFocus={handleRecommendationFocus}
                onBlur={handleRecommendationBlur}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onCompositionStart={handleRecommendationCompositionStart}
                onCompositionEnd={() => {
                  handleRecommendationCompositionEnd()
                }}
                onReferencePreview={handlePreviewFile}
                onReferenceLocate={handleLocateFileReference}
                onReferenceDelete={handleRemoveFileReference}
                className="h-full w-full"
              />
              {fileMenuOpen && (
                <div className="composer-flyout absolute inset-x-0 bottom-full z-30 mb-2 overflow-hidden rounded-[18px]">
                  <div className="composer-flyout-header flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground">
                    <Command className="size-3.5" />
                    <span>{t('input.fileSuggestions', { defaultValue: 'File suggestions' })}</span>
                    <span className="composer-status-pill ml-auto rounded-full px-1.5 py-0.5 text-[10px]">
                      @{fileQuery || ''}
                    </span>
                  </div>
                  <div ref={fileListRef} className="max-h-64 overflow-y-auto p-1.5">
                    {!workingFolder ? (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-3 text-left text-xs text-amber-600 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
                        onMouseDown={(event) => {
                          event.preventDefault()
                          onSelectFolder?.()
                        }}
                      >
                        <FolderOpen className="size-3.5 shrink-0" />
                        <span>
                          {t('input.noWorkingFolderSelected', {
                            defaultValue: 'Please select a working directory first'
                          })}
                        </span>
                      </button>
                    ) : fileSearchLoading ? (
                      <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                        <Spinner className="size-3.5" />
                        <span>
                          {t('input.loadingFiles', { defaultValue: 'Searching files...' })}
                        </span>
                      </div>
                    ) : fileSearchResults.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground">
                        {t('input.noFilesFound', { defaultValue: 'No matching files' })}
                      </div>
                    ) : (
                      fileSearchResults.map((file, index) => {
                        const isSelected = index === selectedFileSearchIndex
                        return (
                          <button
                            key={file.path}
                            type="button"
                            className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                              isSelected
                                ? 'bg-accent text-accent-foreground'
                                : 'hover:bg-muted/50 text-foreground'
                            }`}
                            onMouseMove={(event) => {
                              const prev = flyoutPointerRef.current
                              if (prev?.x === event.clientX && prev?.y === event.clientY) return
                              flyoutPointerRef.current = { x: event.clientX, y: event.clientY }
                              if (index !== selectedFileSearchIndex) {
                                setSelectedFileSearchIndex(index)
                              }
                            }}
                            onMouseDown={(event) => {
                              event.preventDefault()
                              insertSelectedFile(file.path)
                            }}
                            onClick={(event) => {
                              event.preventDefault()
                            }}
                          >
                            <FileCode2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{file.name}</div>
                              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                {file.path}
                              </div>
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
              {slashMenuOpen && (
                <div className="composer-flyout absolute inset-x-0 bottom-full z-30 mb-2 overflow-hidden rounded-[18px]">
                  <div className="composer-flyout-header flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground">
                    <Command className="size-3.5" />
                    <span>
                      {t('input.slashSuggestions', {
                        defaultValue: 'Command, plugin & skill suggestions'
                      })}
                    </span>
                    <span className="composer-status-pill ml-auto rounded-full px-1.5 py-0.5 text-[10px]">
                      /{slashQuery ?? ''}
                    </span>
                  </div>
                  <div ref={slashListRef} className="max-h-64 overflow-y-auto p-1">
                    {slashSuggestionsLoading ? (
                      <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground">
                        <Spinner className="size-3.5" />
                        <span>
                          {t('input.loadingSlashSuggestions', {
                            defaultValue: 'Loading commands, plugins, and skills...'
                          })}
                        </span>
                      </div>
                    ) : filteredSlashSuggestions.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground">
                        {t('input.noSlashSuggestionsFound', {
                          defaultValue: 'No matching commands, plugins, or skills'
                        })}
                      </div>
                    ) : (
                      filteredSlashSuggestions.map((item, index) => {
                        const isSelected = index === selectedSlashIndex
                        return (
                          <button
                            key={item.key}
                            type="button"
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                              isSelected
                                ? 'bg-accent text-accent-foreground'
                                : 'hover:bg-muted/50 text-foreground'
                            }`}
                            onMouseMove={(event) => {
                              const prev = flyoutPointerRef.current
                              if (prev?.x === event.clientX && prev?.y === event.clientY) return
                              flyoutPointerRef.current = { x: event.clientX, y: event.clientY }
                              if (index !== selectedSlashIndex) {
                                setSelectedSlashIndex(index)
                              }
                            }}
                            onMouseDown={(event) => {
                              event.preventDefault()
                              applySlashSuggestion(item)
                            }}
                          >
                            {item.kind === 'skill' ? (
                              <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
                            ) : item.kind === 'plugin' ? (
                              <Puzzle className="size-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <Command className="size-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <div className="min-w-0 flex flex-1 items-center gap-2 overflow-hidden">
                              <div className="max-w-[45%] shrink-0 truncate text-sm font-medium">
                                {item.kind === 'command'
                                  ? `/${item.name}`
                                  : (item.label ?? item.name)}
                              </div>
                              {item.summary && (
                                <div className="truncate text-[11px] text-muted-foreground">
                                  {item.summary}
                                </div>
                              )}
                            </div>
                            <span className="composer-status-pill shrink-0 rounded-full px-1.5 py-0.5 text-[10px]">
                              {item.kind === 'command'
                                ? t('skills.commandsLabel')
                                : item.kind === 'plugin'
                                  ? t('skills.pluginsLabel')
                                  : t('skills.skillsLabel')}
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Hidden file input for queue image upload */}
          <input
            ref={queueFileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                void addQueuedImages(Array.from(e.target.files))
              }
              e.target.value = ''
            }}
          />

          {/* Bottom toolbar */}
          <div
            ref={bottomToolbarRef}
            className="composer-toolbar relative z-20 mt-1 shrink-0 flex items-center justify-between gap-2 px-2 pb-2"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pr-1 [scrollbar-width:none]">
                <div className="shrink-0">
                  {readOnlyModel !== undefined ? (
                    <ReadOnlyModelBadge model={readOnlyModel} />
                  ) : (
                    <ModelSwitcher modelRoute={modelRoute} sessionId={draftSessionId} />
                  )}
                </div>
                {draftSessionId && (
                  <div className="shrink-0">
                    <PersonaSwitcher sessionId={draftSessionId} />
                  </div>
                )}
                {webSearchToggleControl}
                {skillsMenuControl}
                {activeMcpBadge}
                {activeExtensionBadge}
                {folderControl}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <ContextRing
                  sessionId={draftSessionId}
                  onCompressContext={onCompressContext ? handleCompressContext : undefined}
                  isCompressing={isContextCompressing}
                />

                {showInlineClearConversation && hasMessages && !isStreaming && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="composer-control rounded-lg"
                        data-tone="danger"
                        aria-label={t('input.clearConversation')}
                        title={t('input.clearConversation')}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent size="sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('input.clearConfirmTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {queuedMessages.length > 0
                            ? t('input.clearConfirmDescWithQueue', {
                                defaultValue:
                                  'This will delete all messages in this conversation and clear {{count}} pending messages in the current session. This action cannot be undone.',
                                count: queuedMessages.length
                              })
                            : t('input.clearConfirmDesc')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel size="sm">
                          {t('action.cancel', { ns: 'common' })}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (!activeSessionId) return
                            clearSessionMessages(activeSessionId)
                            clearPendingSessionMessages(activeSessionId)
                          }}
                        >
                          {t('action.clear', { ns: 'common' })}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {optimizeControl}
                {permissionControl}
                {sendControl}
              </div>
            </div>
          </div>
        </div>

        {draftSessionId && (
          <ComposerRuntimeStatus
            sessionId={draftSessionId}
            isStreaming={isStreaming}
            draftInputTokens={debouncedTokens}
            isOptimizing={isOptimizing}
            pendingImageReads={pendingImageReads}
            contextCompressionStatus={contextCompressionStatus}
            contextCompressionStatusLabel={contextCompressionStatusLabel}
            model={composerModelCfg}
            className="mt-1.5 px-3"
          />
        )}
      </div>
    </div>
  )
}

// Re-export RuntimeTokenStatistics for external consumers
export { RuntimeTokenStatistics } from './runtime-status'
