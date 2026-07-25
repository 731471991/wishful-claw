// InputArea: main composer component with editor, toolbar, and controls

import * as React from 'react'

import type { AIModelConfig } from '@renderer/lib/api/types'
import { toast } from 'sonner'
import { validateGoalObjective } from '@renderer/lib/agent/goal-context'
import type { SendMessageOptions } from '@renderer/hooks/use-chat-actions'
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
  cloneImageAttachments,
  type ImageAttachment
} from '@renderer/lib/image-attachments'
import { type FileAwareEditorHandle } from '../FileAwareEditor'
import { usePlanStore } from '@renderer/stores/plan-store'
import { useGoalStore } from '@renderer/stores/goal-store'
import { resolveSessionModelSelection } from '@renderer/lib/session-model-resolution'
import { ipcClient } from '@renderer/lib/ipc/ipc-client'
import { cn } from '@renderer/lib/utils'
import { deserializeEditorState } from '@renderer/lib/select-file-editor'
import { selectFileTextToPlainText } from '@renderer/lib/select-file-tags'
import type { AppPluginId } from '@renderer/lib/app-plugin/types'
import { resolveProjectMemoryTextFile } from '@renderer/lib/agent/memory-files'
import { isProjectSession, workspaceContextAvailable } from '@renderer/lib/session-scope'
import { GoalSessionBar } from '@renderer/components/goal/GoalSessionControls'

// Extracted modules
import {
  InputAreaProps
} from './types'
import {
  MIN_INPUT_HEIGHT, DEFAULT_SESSION_INPUT_HEIGHT, placeholderKeys, defaultRecommendationKeys
} from './types'
import {
  summarizeQueuedMessage, isReferenceOnlyDocument, selectedFileItemToReference
} from './utils'
import { ComposerRuntimeStatus } from './runtime-status'
import { RetryBanner } from './retry-banner'
import { useComposerHeight } from './use-composer-height'
import { useImageAttachments } from './use-image-attachments'
import { useQueuedMessages } from './use-queued-messages'
import { usePromptOptimizer } from './use-prompt-optimizer'
import { QueuedMessagesPanel } from './queued-messages-panel'
import { ImagePreviewStrip } from './image-preview-strip'
import { ComposerBanners } from './composer-banners'
import { ComposerToolbar } from './composer-toolbar'
import { useComposerKeydown } from './use-composer-keydown'
import { useDragDrop } from './use-drag-drop'
import { useComposerEditor } from './use-composer-editor'
import { useSlashCommands } from './use-slash-commands'
import { useFileSearch } from './use-file-search'
import { useContextCompression } from './use-context-compression'
import { usePermissionMode } from './use-permission-mode'
import { useModeControls } from './use-mode-controls'
import { ComposerEditorArea } from './composer-editor-area'

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


  const [selectedSkill, setSelectedSkill] = React.useState<string | null>(null)
  const [autoAcceptCountdown, setAutoAcceptCountdown] = React.useState<number | null>(null)
  const [isWorkspaceAgentsMissing, setIsWorkspaceAgentsMissing] = React.useState(false)
  const [pendingPlanMode, setPendingPlanMode] = React.useState(false)
  const [pendingGoalMode, setPendingGoalMode] = React.useState(false)
  const removePersistedDraftRef = React.useRef<(() => void) | null>(null)


  const flyoutPointerRef = React.useRef<{ x: number; y: number } | null>(null)
  const slashListRef = React.useRef<HTMLDivElement | null>(null)
  const fileListRef = React.useRef<HTMLDivElement | null>(null)
  const draftReadyKeyRef = React.useRef<string | null>(null)

  const editorRef = React.useRef<FileAwareEditorHandle | null>(null)
  const draftSaveTimerRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const [attachedImages, setAttachedImages] = React.useState<ImageAttachment[]>([])
  const [previewImage, setPreviewImage] = React.useState<ImageAttachment | null>(null)
  const [pendingImageReads, setPendingImageReads] = React.useState(0)

  const {
    documentNodes, setDocumentNodes,
    selectedFiles, setSelectedFiles,
    highlightedFileId, setHighlightedFileId,
    editorSelection, setEditorSelection,
    text, finalSerializedText,
    documentRef, selectedFilesRef,
    applyEditorStateFromSerializedText, setText, focusInputAtEnd,
    replaceSelectionWithText, addFilesToEditor,
    getLiveEditorState, resetComposer,
    handleEditorDocumentChange, handleRemoveFileReference
  } = useComposerEditor({
    workingFolder, editorRef, attachedImages,
    draftSaveTimerRef,
    removePersistedDraft: () => removePersistedDraftRef.current?.(),
    setSelectedSkill, setAttachedImages, setPreviewImage
  })

  const currentLanguage = useSettingsStore((state) => state.language)
  const mainModelSelectionMode = useSettingsStore((state) => state.mainModelSelectionMode)
  const autoApprove = useSettingsStore((state) => state.autoApprove)
  const permissionWhitelistEnabled = useSettingsStore((state) => state.permissionPolicy.enabled)
  const clarifyAutoAcceptRecommended = useSettingsStore((state) => state.clarifyAutoAcceptRecommended)
  const animationsEnabled = useSettingsStore((state) => state.animationsEnabled)

  const targetSession = useChatStore(
    useShallow((s) => {
      const targetSessionId = sessionId ?? s.activeSessionId
      const idx = targetSessionId ? s.sessionsById[targetSessionId] : undefined
      const session = idx !== undefined ? s.sessions[idx] : undefined
      if (!session) return undefined
      return {
        id: session.id, projectId: session.projectId, pluginId: session.pluginId,
        providerId: session.providerId, modelId: session.modelId,
        modelSelectionMode: session.modelSelectionMode
      }
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
            session, providers, activeProviderId, activeModelId,
            globalMode: mainModelSelectionMode,
            channelProviderId: channel?.providerId, channelModelId: channel?.model
          })
        : null
      const providerId = fastConfig?.providerId ??
        (selection ? (selection.isAutoModeActive && autoSelection?.providerId ? autoSelection.providerId : selection.providerId) : activeProviderId)
      const modelId = fastConfig?.model ??
        (selection ? (selection.isAutoModeActive && autoSelection?.modelId ? autoSelection.modelId : selection.modelId) : activeModelId)
      if (!providerId || !modelId) return null
      const provider = providers.find((item) => item.id === providerId)
      if (!provider) return null
      const model = provider.models.find((item) => item.id === modelId)
      if (!model) return null
      return { apiKey: provider.apiKey, requiresApiKey: provider.requiresApiKey, type: provider.type, models: provider.models, modelId }
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
  const webSearchRequiresApiKey = ['tavily','searxng','exa','exa-mcp','bocha','zhipu'].includes(webSearchProvider)
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
    const activeProject = projectId ? s.projects.find((project) => project.id === projectId) : undefined
    return targetSession?.sshConnectionId ?? activeProject?.sshConnectionId ?? null
  })
  const showInlineClearConversation = false
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
  const getSessionMessages = React.useCallback(
    () => useChatStore.getState().getSessionMessages(activeSessionId ?? ''),
    [activeSessionId]
  )
  const draftSessionId = sessionId ?? (chatView === 'session' ? activeSessionId : null)
  const projectScoped = isProjectSession({ chatView, session: targetSession, activeProjectId, workingFolder })
  const workspaceReady = workspaceContextAvailable({ chatView, session: targetSession, activeProjectId, workingFolder })

  const debouncedTokens = useDebouncedTokens(finalSerializedText)
  const {
    rootRef, containerRef, imagePreviewRef, bottomToolbarRef,
    inputHeight, autoInputHeight, autoMaxInputHeight, handleDragStart
  } = useComposerHeight({
    isSessionComposer, defaultSessionInputHeight, editorRef,
    attachedImagesCount: attachedImages.length, selectedSkill,
    documentNodes, selectedFiles
  })

  const {
    isOptimizing, optimizationOptions, showOptimizationDialog,
    setShowOptimizationDialog, selectedOptionIndex, setSelectedOptionIndex,
    handleOptimizePrompt, handleSelectOption, handleCancelOptimization
  } = usePromptOptimizer({
    text, currentLanguage, setText, focusInputAtEnd
  })
  const isOptimizingLocked = isOptimizing || showOptimizationDialog

  const {
    fileSearchResults, fileSearchLoading,
    selectedFileSearchIndex, setSelectedFileSearchIndex,
    activeFileMention, fileMenuOpen,
    insertSelectedFile
  } = useFileSearch({
    text, editorSelection, projectScoped, workingFolder,
    selectedFilesRef, replaceSelectionWithText,
    setSelectedSkill, fileListRef
  })

  const hasFileReferences = React.useMemo(() => selectedFiles.length > 0, [selectedFiles])
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
    suggestionText, effectivePlaceholder, acceptSuggestion,
    cancelPendingRequest: cancelPromptRecommendation,
    handleFocus: handleRecommendationFocus, handleBlur: handleRecommendationBlur,
    handleSelectionChange: handleRecommendationSelectionChange,
    handleCompositionStart: handleRecommendationCompositionStart,
    handleCompositionEnd: handleRecommendationCompositionEnd
  } = usePromptRecommendation({
    mode, sessionId: activeSessionId, text, getRecentMessages: getSessionMessages,
    selectedSkill, images: attachedImages, disabled: disabled || isOptimizingLocked,
    isStreaming, fallbackSuggestion: recommendationFallback, getCaretAtEnd
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
        sessionId: draftSessionId, projectId: activeProjectId, mode,
        workingFolder: workingFolder ?? null
      }
    }
    if (draftSessionId) {
      return { scope: 'session', sessionId: draftSessionId, projectId: activeProjectId, mode, workingFolder: workingFolder ?? null }
    }
    if (activeProjectId) {
      return { scope: 'project', projectId: activeProjectId, mode, workingFolder: workingFolder ?? null }
    }
    return { scope: 'home', mode, workingFolder: workingFolder ?? null }
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
  removePersistedDraftRef.current = removePersistedDraft

  const {
    slashQuery, slashMenuOpen, slashSuggestionsLoading,
    filteredSlashSuggestions, selectedSlashIndex, setSelectedSlashIndex,
    insertSlashCommand,
    insertPluginPrompt, applySlashSuggestion
  } = useSlashCommands({
    text, workingFolder, activeProjectId,
    editorRef, editorSelection, selectedFiles, selectedFilesRef, documentRef,
    applyEditorStateFromSerializedText, focusInputAtEnd,
    setSelectedSkill, setSelectedFiles, setDocumentNodes, slashListRef
  })

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

  const composerWidthClass = fullWidth ? 'mx-auto w-full max-w-none' : 'mx-auto w-full max-w-[820px]'

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

  const { handlePlanModeChange, handleGoalModeChange } = useModeControls({
    projectScoped, draftSessionId, disabled, isStreaming, isOptimizingLocked,
    pendingImageReads, hasActiveGoal, focusInputAtEnd,
    setPendingPlanMode, setPendingGoalMode, t
  })



  const handleKeyDown = useComposerKeydown({
    isOptimizingLocked, fileMenuOpen, slashMenuOpen,
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

  const {
    contextCompressionStatus, isContextCompressing,
    handleCompressContext, contextCompressionStatusLabel
  } = useContextCompression({ onCompressContext, t })

  const { permissionMode, handleSelectPermissionMode } = usePermissionMode({
    autoApprove, permissionWhitelistEnabled, t
  })

  const editorPlaceholder = pendingReviewPlanId
    ? t('input.placeholderPlanReview', {
        defaultValue: 'Enter suggestions for this plan, or click the card above to implement it...'
      })
    : hasPendingGoalMode
      ? t('input.placeholderPendingGoal', { defaultValue: 'Describe the goal to pursue...' })
      : (effectivePlaceholder ??
        (shouldRecommendInit
          ? t('input.placeholderInitWorkspace')
          : t(placeholderKeys[mode] ?? 'input.placeholder')))

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
          <ImagePreviewStrip
            attachedImages={attachedImages}
            animationsEnabled={animationsEnabled}
            imagePreviewRef={imagePreviewRef}
            setPreviewImage={setPreviewImage}
            removeImage={removeImage}
            previewImage={previewImage}
          />

          <ComposerEditorArea
            dragging={dragging}
            handleDragOver={handleDragOver}
            handleDragLeave={handleDragLeave}
            handleDropWrapped={handleDropWrapped}
            editorRef={editorRef}
            documentNodes={documentNodes}
            selectedFiles={selectedFiles}
            disabled={disabled}
            isOptimizingLocked={isOptimizingLocked}
            isOptimizing={isOptimizing}
            selectedSkill={selectedSkill}
            onClearSelectedSkill={() => setSelectedSkill(null)}
            attachedImages={attachedImages}
            supportsVision={supportsVision}
            placeholder={editorPlaceholder}
            suggestionText={suggestionText}
            showSuggestion={Boolean(
              suggestionText &&
              text.length > 0 &&
              !hasFileReferences &&
              !activeFileMention &&
              !slashMenuOpen
            )}
            shouldAutoAcceptRecommendation={shouldAutoAcceptRecommendation}
            autoAcceptCountdown={autoAcceptCountdown}
            hasFileReferences={hasFileReferences}
            highlightedFileId={highlightedFileId}
            onDocumentChange={handleEditorDocumentChange}
            onSelectionChange={handleEditorSelectionChange}
            onFocus={handleRecommendationFocus}
            onBlur={handleRecommendationBlur}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onCompositionStart={handleRecommendationCompositionStart}
            onCompositionEnd={() => handleRecommendationCompositionEnd()}
            onReferencePreview={handlePreviewFile}
            onReferenceLocate={handleLocateFileReference}
            onReferenceDelete={handleRemoveFileReference}
            showOptimizationDialog={showOptimizationDialog}
            setShowOptimizationDialog={setShowOptimizationDialog}
            optimizationOptions={optimizationOptions}
            selectedOptionIndex={selectedOptionIndex}
            setSelectedOptionIndex={setSelectedOptionIndex}
            onUseOption={handleSelectOption}
            onCancelOptimization={handleCancelOptimization}
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
            filteredSlashSuggestions={filteredSlashSuggestions}
            selectedSlashIndex={selectedSlashIndex}
            setSelectedSlashIndex={setSelectedSlashIndex}
            slashListRef={slashListRef}
            applySlashSuggestion={applySlashSuggestion}
            queueFileInputRef={queueFileInputRef}
            addQueuedImages={addQueuedImages}
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
          <RetryBanner sessionId={draftSessionId} />
        )}
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
