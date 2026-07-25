// InputArea: main composer component with editor, toolbar, and controls

import * as React from 'react'
import { toast } from 'sonner'
import {
  Sparkles, X, FileUp
} from 'lucide-react'
import type { AIModelConfig } from '@renderer/lib/api/types'
import { Spinner } from '@renderer/components/ui/spinner'
import { confirm } from '@renderer/components/ui/confirm-dialog'
import { useProviderStore, modelSupportsVision } from '@renderer/stores/provider-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { updateWebSearchToolRegistration } from '@renderer/lib/tools'
import { useUIStore } from '@renderer/stores/ui-store'
import { useDebouncedTokens } from '@renderer/hooks/use-estimated-tokens'
import { usePromptRecommendation } from '@renderer/hooks/use-prompt-recommendation'
import { useChatStore } from '@renderer/stores/chat-store'
import { useChannelStore } from '@renderer/stores/channel-store'
import {
  getHomeInputDraftKey, getProjectInputDraftKey, getSessionInputDraftKey,
  type InputDraftContext
} from '@renderer/lib/input-drafts'
import { useInputDraftPersistence } from '@renderer/hooks/use-input-draft-persistence'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'
import {
  ACCEPTED_IMAGE_TYPES, cloneImageAttachments,
  type ImageAttachment
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
import { FileAwareEditor, type FileAwareEditorHandle } from '../FileAwareEditor'
import { listCommands, type CommandCatalogItem } from '@renderer/lib/commands/command-loader'
import { usePlanStore } from '@renderer/stores/plan-store'
import { useGoalStore } from '@renderer/stores/goal-store'
import { useSkillsStore } from '@renderer/stores/skills-store'
import { resolveSessionModelSelection } from '@renderer/lib/session-model-resolution'
import { resolvePluginsForProject, useAppPluginStore } from '@renderer/stores/app-plugin-store'
import { validateGoalObjective } from '@renderer/lib/agent/goal-context'
import {
  APP_PLUGIN_DESCRIPTORS,
  type AppPluginId
} from '@renderer/lib/app-plugin/types'
import {
  type SendMessageOptions
} from '@renderer/hooks/use-chat-actions'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { cn } from '@renderer/lib/utils'
import { resolveProjectMemoryTextFile } from '@renderer/lib/agent/memory-files'
import { isProjectSession, workspaceContextAvailable } from '@renderer/lib/session-scope'
import { GoalSessionBar } from '@renderer/components/goal/GoalSessionControls'

// Extracted modules
import {
  InputAreaProps, FileSearchItem, SlashSuggestionItem, AppPluginPromptItem, ContextCompressionStatus
} from './types'
import {
  MIN_INPUT_HEIGHT, DEFAULT_SESSION_INPUT_HEIGHT, MAX_SLASH_COMMAND_RESULTS, BUILTIN_SLASH_COMMANDS, placeholderKeys, defaultRecommendationKeys
} from './types'
import {
  getAppPluginPromptContent, getSlashCommandQuery, scoreSlashCommand, summarizeQueuedMessage, isReferenceOnlyDocument, selectedFileItemToReference
} from './utils'
import { ComposerRuntimeStatus } from './runtime-status'
import { useComposerHeight } from './use-composer-height'
import { useImageAttachments } from './use-image-attachments'
import { useQueuedMessages } from './use-queued-messages'
import { usePromptOptimizer } from './use-prompt-optimizer'
import { OptimizationDialog } from './optimization-dialog'
import { QueuedMessagesPanel } from './queued-messages-panel'
import { ComposerFlyovers } from './composer-flyovers'
import { ImagePreviewStrip } from './image-preview-strip'
import { ComposerBanners } from './composer-banners'
import { ComposerToolbar } from './composer-toolbar'
import { useComposerKeydown } from './use-composer-keydown'
import { useDragDrop } from './use-drag-drop'

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
    handleOptimizePrompt, handleSelectOption, handleCancelOptimization
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
    queuedMessages,
    editingQueueItemId, editingQueueText, setEditingQueueText,
    editingQueueImages, setEditingQueueImages,
    queueClearConfirmOpen, setQueueClearConfirmOpen,
    queueFileInputRef,
    startEditQueuedMessage, cancelEditQueuedMessage, removeQueuedMessage,
    addQueuedImages, removeQueuedImage, saveQueuedMessage,
    clearQueuedMessagesForActiveSession,
    quoteQueuedMessage, handleQueueEditPaste
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

  const handleKeyDown = useComposerKeydown({
    isOptimizingLocked,
    fileMenuOpen, slashMenuOpen,
    fileSearchResults, selectedFileSearchIndex, setSelectedFileSearchIndex,
    filteredSlashSuggestions, selectedSlashIndex, setSelectedSlashIndex,
    activeFileMention, editorRef, setEditorSelection,
    insertSelectedFile, applySlashSuggestion,
    acceptSuggestion, applyEditorStateFromSerializedText,
    selectedFiles, focusInputAtEnd,
    handleRecommendationSelectionChange, handleSend
  })

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

  const { dragging, handleDragOver, handleDragLeave, handleDropWrapped } = useDragDrop({
    addFilesToEditor
  })

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

  const composerIconControlClass = 'composer-control rounded-xl'

  const queuedMessagesPanel = (
    <QueuedMessagesPanel
      queuedMessages={queuedMessages}
      composerWidthClass={composerWidthClass}
      animationsEnabled={animationsEnabled}
      editingQueueItemId={editingQueueItemId}
      editingQueueText={editingQueueText}
      editingQueueImages={editingQueueImages}
      setEditingQueueText={setEditingQueueText}
      setEditingQueueImages={setEditingQueueImages}
      setPreviewImage={setPreviewImage}
      saveQueuedMessage={saveQueuedMessage}
      cancelEditQueuedMessage={cancelEditQueuedMessage}
      removeQueuedImage={removeQueuedImage}
      handleQueueEditPaste={handleQueueEditPaste}
      editQueuedMessage={startEditQueuedMessage}
      removePendingSessionMessage={removeQueuedMessage}
      quotePendingSessionMessageIntoConversation={quoteQueuedMessage}
      queueClearConfirmOpen={queueClearConfirmOpen}
      setQueueClearConfirmOpen={setQueueClearConfirmOpen}
      clearQueuedMessagesForActiveSession={clearQueuedMessagesForActiveSession}
      summarizeQueuedMessage={summarizeQueuedMessage}
    />
  )

  return (
    <div
      ref={rootRef}
      data-tour="composer"
      className={cn('px-4 py-3', attachedFooter ? 'pb-0' : 'pb-4')}
    >
      <ComposerBanners
        hasApiKey={hasApiKey}
        needsWorkingFolder={needsWorkingFolder}
        onSelectFolder={onSelectFolder}
        mode={mode}
        planMode={planMode}
        projectScoped={projectScoped}
        draftSessionId={draftSessionId}
        workingFolder={workingFolder}
        hideWorkingFolderIndicator={hideWorkingFolderIndicator}
        hasPendingGoalMode={hasPendingGoalMode}
        composerWidthClass={composerWidthClass}
        onOpenSettings={(tab) => openSettings(tab as never)}
      />

      {queuedMessagesPanel}

      {!hideGoalSessionBar && draftSessionId && (
        <GoalSessionBar
          sessionId={draftSessionId}
          className={cn('mb-2', fullWidth && 'max-w-none')}
        />
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
          data-composer-variant="session"
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

          <ImagePreviewStrip
            attachedImages={attachedImages}
            animationsEnabled={animationsEnabled}
            imagePreviewRef={imagePreviewRef}
            setPreviewImage={setPreviewImage}
            removeImage={removeImage}
            previewImage={previewImage}
          />

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
          <OptimizationDialog
            open={showOptimizationDialog}
            onOpenChange={setShowOptimizationDialog}
            options={optimizationOptions}
            selectedOptionIndex={selectedOptionIndex}
            onSelectOption={setSelectedOptionIndex}
            onUseOption={handleSelectOption}
            onCancel={handleCancelOptimization}
            isOptimizing={isOptimizing}
          />

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
              <ComposerFlyovers
                fileMenuOpen={fileMenuOpen}
                fileSearchLoading={fileSearchLoading}
                fileSearchResults={fileSearchResults}
                selectedFileSearchIndex={selectedFileSearchIndex}
                setSelectedFileSearchIndex={setSelectedFileSearchIndex}
                flyoutPointerRef={flyoutPointerRef}
                insertSelectedFile={insertSelectedFile}
                needsWorkingFolder={needsWorkingFolder}
                onSelectFolder={onSelectFolder}
                slashMenuOpen={slashMenuOpen}
                slashQuery={slashQuery}
                slashSuggestionsLoading={slashSuggestionsLoading}
                slashSuggestions={filteredSlashSuggestions}
                selectedSlashIndex={selectedSlashIndex}
                setSelectedSlashIndex={setSelectedSlashIndex}
                slashListRef={slashListRef}
                applySlashSuggestion={applySlashSuggestion}
              />
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
          <ComposerToolbar
            readOnlyModel={readOnlyModel}
            modelRoute={modelRoute}
            draftSessionId={draftSessionId}
            canToggleWebSearch={canToggleWebSearch}
            webSearchEnabled={webSearchEnabled}
            toggleWebSearch={toggleWebSearch}
            disabled={disabled}
            isStreaming={isStreaming}
            setSelectedSkill={setSelectedSkill}
            insertSlashCommand={insertSlashCommand}
            insertPluginPrompt={(id, _focus) => insertPluginPrompt(id as AppPluginId)}
            handleAttachMedia={handleAttachMedia}
            activeProjectId={activeProjectId}
            mode={mode}
            hideModeSwitch={hideModeSwitch}
            planMode={planMode}
            goalModeEnabled={goalModeEnabled}
            planModeDisabled={disabled || isStreaming || !projectScoped}
            goalModeDisabled={disabled || isStreaming || isOptimizingLocked || pendingImageReads > 0}
            onPlanModeChange={handlePlanModeChange}
            onGoalModeChange={handleGoalModeChange}
            onSelectFolder={onSelectFolder}
            hideWorkingFolderPicker={hideWorkingFolderPicker}
            isOptimizing={isOptimizing}
            isOptimizingLocked={isOptimizingLocked}
            handleOptimizePrompt={handleOptimizePrompt}
            hasText={Boolean(text.trim())}
            permissionMode={permissionMode}
            onSelectPermissionMode={handleSelectPermissionMode}
            onOpenSettings={(tab) => openSettings(tab as never)}
            onStop={onStop}
            onSend={handleSend}
            finalSerializedText={finalSerializedText}
            attachedImagesCount={attachedImages.length}
            needsWorkingFolder={needsWorkingFolder}
            pendingImageReads={pendingImageReads}
            onCompressContext={onCompressContext ? handleCompressContext : undefined}
            isContextCompressing={isContextCompressing}
            showInlineClearConversation={showInlineClearConversation}
            hasMessages={hasMessages}
            activeSessionId={activeSessionId}
            queuedMessagesCount={queuedMessages.length}
            onClearSession={clearSessionMessages}
            composerIconControlClass={composerIconControlClass}
            toolbarRef={bottomToolbarRef}
          />
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
