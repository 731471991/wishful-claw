import * as React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useShallow } from 'zustand/react/shallow'
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { UnifiedMessage } from '@renderer/lib/api/types'
import { useChatStore } from '@renderer/stores/chat-store'
import { useUIStore } from '@renderer/stores/ui-store'
import { useAgentStore } from '@renderer/stores/agent-store'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { useTeamStore, type ActiveTeam } from '@renderer/stores/team-store'
import { cn } from '@renderer/lib/utils'
import {
  buildChatRenderableMessageMetaFromAnalysis,
  buildTranscriptStaticAnalysis,
  type ChatRenderableMessageMeta,
  type TailToolExecutionState
} from './transcript-utils'
import { buildOrchestrationRuns } from '@renderer/lib/orchestration/build-runs'
import { type EditableUserMessageDraft } from '@renderer/lib/image-attachments'
import type { RequestRetryState } from '@renderer/lib/agent/types'
import { isStreamingPerfEnabled, recordStreamingReactCommit } from '@renderer/lib/streaming-perf'
import { invokeMessagePackBinary } from '@renderer/lib/ipc/messagepack-ipc-client'
import { selectSessionScopedAgentState } from '@renderer/lib/agent/session-scoped-agent-state'
import {
  getCompactSummaryDisplayText,
  resolveActiveCompactArtifacts
} from '@renderer/lib/agent/context-compression'
import { DB_MESSAGES_LIST_LOCATOR_MSGPACK_CHANNEL } from '../../../../shared/messagepack/binary-ipc'
import { AssistantReplyRail } from './MessageList/AssistantReplyRail'
import { MessageRow } from './MessageList/MessageRow'
import { StaticMessageTranscript } from './MessageList/StaticMessageTranscript'
import { modeHints } from './MessageList/mode-hints'

import {
  type MessageListProps, type RenderableMessage, type ToolResultsLookup,
  type MessageListRow, type AutoScrollMode, type AskUserQuestionPresence,
  type MessageLocatorIndexRow, type MessageLocatorSource, type AssistantRailMarkerKind,
  type AssistantRailLayoutRow, type AssistantReplyRailItem, type AssistantRailLayout,
  type ChatStoreSnapshot, type TeamStoreSnapshot, type MessageRowProps,
  type MessageListSessionSelection, type SessionScopedTeamSelection,
  getMessageToolUseIds, toolResultContentToText, getPlanReviewPlanId,
  collectDuplicatePlanReviewToolUseIds, mergeHiddenToolUseIds,
  hasCompleteTailToolExecutionResults, hasEmptyAssistantContent,
  getMessageColumnClass, getMessageColumnCompactClass,
  areToolResultsEqual, areStringSetsEqual, areStringArraysEqual,
  areRequestRetryStatesEqual, buildTeamMemberRenderSignature,
  buildTeamTaskRenderSignature, buildTeamMessageRenderSignature,
  buildTeamRenderSignature, isActiveTeamRunning, convertChatMessagesToUnified,
  selectMessageListSession, selectSessionScopedTeamState,
  getOrchestrationRunSignature, areMessageRowPropsEqual,
  isTeamLocatorSource, shouldShowAssistantRailMarker, getAssistantRailMarkerKind,
  buildAssistantRailPreview, estimateLocatorRowHeight, buildAssistantRailLayout,
  parseLocatorRowSource, countImageBlocks, getCompactRailGapPx,
  getCompactRailMarkerOffsetPx, getCompactRailMarkerTop, getCompactRailMarkerY,
  formatLocatorTime, splitLocatorPreview, parseLocatorContent, parseLocatorMeta,
  ASSISTANT_RAIL_DENSE_THRESHOLD,
  ASSISTANT_RAIL_SCROLL_OFFSET,
  AUTO_SCROLL_BOTTOM_THRESHOLD,
  AUTO_SCROLL_MIN_DELTA,
  BOTTOM_SCROLL_CORRECTION_EPSILON,
  EMPTY_MESSAGE_LOCATOR_ROWS,
  EMPTY_ORCHESTRATION_STATE,
  FOLLOW_BOTTOM_SETTLE_FRAMES,
  INITIAL_TAIL_RENDER_COUNT,
  MIN_RENDERABLE_HISTORY_ROWS,
  OLDER_MESSAGE_LOAD_SCROLL_THRESHOLD,
  PROGRAMMATIC_SCROLL_GUARD_MS,
  STREAMING_AUTO_SCROLL_BOTTOM_THRESHOLD,
  STREAMING_AUTO_SCROLL_POLL_MS,
  STREAMING_AUTO_SCROLL_STOP_THRESHOLD,
  TAIL_LIVE_MESSAGE_COUNT,
  TAIL_STATIC_MESSAGE_COUNT,
  USER_LOCATOR_HIGHLIGHT_MS,
  VIRTUAL_ROW_ESTIMATED_HEIGHT,
  VIRTUAL_ROW_OVERSCAN,
  findPendingAskUserQuestion,
  getDistanceToBottom,
} from './MessageList/utils'


function MessageListInner(props: MessageListProps): React.JSX.Element {
  const {
    sessionId,
    onRetry,
    onContinue,
    onEditUserMessage,
    onDeleteMessage,
    exportAll = false,
    fullWidth = false
  } = props
  const { t } = useTranslation('chat')
  const animationsEnabled = useSettingsStore((s) => s.animationsEnabled)
  const currentActiveSessionId = useChatStore((s) => s.activeSessionId)
  const targetSessionId = sessionId ?? currentActiveSessionId
  const sessionSelection = useChatStore(
    useShallow((s) => selectMessageListSession(s, targetSessionId))
  )
  const {
    messages,
    messagesLoaded: activeSessionLoaded,
    messageCount: activeSessionMessageCount,
    workingFolder: activeWorkingFolder,
    loadedRangeStart,
    projectId: activeProjectId
  } = sessionSelection
  const activeProjectName = useChatStore((s) => {
    if (!activeProjectId) return null
    return s.projects.find((project) => project.id === activeProjectId)?.name ?? null
  })
  const streamingMessageId = useChatStore((s) =>
    targetSessionId ? (s.streamingMessages[targetSessionId] ?? null) : null
  )
  const activeSessionId = targetSessionId
  const isMainChatSession =
    !sessionId && Boolean(activeSessionId) && activeSessionId === currentActiveSessionId
  const isDetachedSessionView = Boolean(sessionId && activeSessionId)
  const mode = useUIStore((s) => s.mode)
  const hasStreamingMessage = useChatStore((s) =>
    activeSessionId ? Boolean(s.streamingMessages[activeSessionId]) : false
  )
  const {
    activeSubAgents,
    completedSubAgents,
    subAgentHistory,
    hasActiveToolCallOutput,
    isSessionRunning: isAgentSessionRunning,
    hasOrchestrationData: hasAgentOrchestrationData
  } = useAgentStore((s) => selectSessionScopedAgentState(s, activeSessionId, { mode: 'coarse' }))
  const primarySessionStatus = useAgentStore((s) =>
    activeSessionId ? (s.runningSessions[activeSessionId] ?? null) : null
  )
  const {
    activeTeam,
    teamHistory,
    isTeamRunning,
    hasOrchestrationData: hasTeamOrchestrationData
  } = useTeamStore((s) => selectSessionScopedTeamState(s, activeSessionId))
  const isPrimarySessionRunning =
    primarySessionStatus === 'running' || primarySessionStatus === 'retrying'
  const isAgentExecutionActive = isPrimarySessionRunning || isTeamRunning || hasStreamingMessage
  const isSessionRunning = isAgentSessionRunning || isTeamRunning || hasStreamingMessage
  const hasSessionOrchestrationData = React.useMemo(
    () => hasAgentOrchestrationData || hasTeamOrchestrationData,
    [hasAgentOrchestrationData, hasTeamOrchestrationData]
  )
  const sessionRequestRetryState = useAgentStore((s) =>
    activeSessionId ? (s.sessionRequestRetryState[activeSessionId] ?? null) : null
  )
  const isSessionOutputting = hasStreamingMessage || hasActiveToolCallOutput
  const canSessionTriggerStreamingAutoScroll =
    (isMainChatSession || isDetachedSessionView) && isSessionOutputting

  const transcriptAnalysis = React.useMemo(
    () => buildTranscriptStaticAnalysis(messages),
    [messages]
  )
  const {
    messageLookup,
    toolResultsLookup,
    tailToolExecutionState,
    orchestrationBindingSignature: orchestrationMessageBindingSignature
  } = transcriptAnalysis
  const duplicatePlanReviewToolUseIds = React.useMemo(
    () => collectDuplicatePlanReviewToolUseIds(messages, toolResultsLookup),
    [messages, toolResultsLookup]
  )
  const [orchestrationMessageSnapshot, setOrchestrationMessageSnapshot] = React.useState<{
    messages: UnifiedMessage[]
    bindingSignature: string
  }>(() => ({
    messages,
    bindingSignature: orchestrationMessageBindingSignature
  }))
  const useCurrentMessagesForOrchestration =
    (!streamingMessageId && !hasActiveToolCallOutput) ||
    orchestrationMessageSnapshot.bindingSignature !== orchestrationMessageBindingSignature
  const orchestrationMessages = useCurrentMessagesForOrchestration
    ? messages
    : orchestrationMessageSnapshot.messages

  React.useEffect(() => {
    if (!useCurrentMessagesForOrchestration) return
    setOrchestrationMessageSnapshot((previous) => {
      if (
        previous.messages === messages &&
        previous.bindingSignature === orchestrationMessageBindingSignature
      ) {
        return previous
      }
      return {
        messages,
        bindingSignature: orchestrationMessageBindingSignature
      }
    })
  }, [messages, orchestrationMessageBindingSignature, useCurrentMessagesForOrchestration])

  const listRef = React.useRef<HTMLDivElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const virtualContentRef = React.useRef<HTMLDivElement | null>(null)
  const renderedSessionIdRef = React.useRef<string | null>(activeSessionId)
  const pendingInitialScrollSessionIdRef = React.useRef<string | null>(activeSessionId)
  if (renderedSessionIdRef.current !== activeSessionId) {
    renderedSessionIdRef.current = activeSessionId
    pendingInitialScrollSessionIdRef.current = activeSessionId
  }
  const autoScrollModeRef = React.useRef<AutoScrollMode>('off')
  const initialTailReleaseFrameRef = React.useRef<number | null>(null)
  const scheduledScrollFrameRef = React.useRef<number | null>(null)
  const scheduledAssistantRailSyncRef = React.useRef<number | null>(null)
  const highlightedMessageTimerRef = React.useRef<number | null>(null)
  const lastScrollOffsetRef = React.useRef(0)
  const programmaticScrollUntilRef = React.useRef(0)
  const wasSessionOutputtingRef = React.useRef(isSessionOutputting)
  const measuredMessageHeightsRef = React.useRef(new Map<string, number>())
  const [isAtBottom, setIsAtBottom] = React.useState(true)
  const [activeAssistantRailMessageIds, setActiveAssistantRailMessageIds] = React.useState<
    Set<string>
  >(() => new Set())
  const [highlightedMessageId, setHighlightedMessageId] = React.useState<string | null>(null)
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = React.useState(false)
  // Remembers a loadedRangeStart at which an older-message load made no progress
  // (e.g. during a running/compacting session the tail-trim immediately re-evicts
  // the head we just loaded). Prevents the auto-loader and scroll handler from
  // re-firing forever and leaving the "loading earlier messages" indicator stuck.
  const stalledOlderLoadStartRef = React.useRef<number | null>(null)
  const [assistantRailMeasureVersion, setAssistantRailMeasureVersion] = React.useState(0)
  const [messageLocatorSnapshot, setMessageLocatorSnapshot] = React.useState<{
    sessionId: string | null
    rows: MessageLocatorIndexRow[]
  }>({ sessionId: null, rows: EMPTY_MESSAGE_LOCATOR_ROWS })
  const messageLocatorRows =
    messageLocatorSnapshot.sessionId === activeSessionId
      ? messageLocatorSnapshot.rows
      : EMPTY_MESSAGE_LOCATOR_ROWS

  const orchestrationState = React.useMemo(
    () =>
      hasSessionOrchestrationData
        ? buildOrchestrationRuns({
            sessionId: activeSessionId,
            messages: orchestrationMessages,
            activeSubAgents,
            completedSubAgents,
            subAgentHistory,
            activeTeam,
            teamHistory
          })
        : EMPTY_ORCHESTRATION_STATE,
    [
      activeSessionId,
      activeSubAgents,
      activeTeam,
      completedSubAgents,
      hasSessionOrchestrationData,
      orchestrationMessages,
      subAgentHistory,
      teamHistory
    ]
  )

  const continueAssistantMessageId = React.useMemo(() => {
    if (streamingMessageId || isSessionRunning) return null
    if (!hasCompleteTailToolExecutionResults(tailToolExecutionState)) return null
    return tailToolExecutionState?.assistantMessageId ?? null
  }, [isSessionRunning, streamingMessageId, tailToolExecutionState])
  const renderableMessages = React.useMemo(
    () =>
      buildChatRenderableMessageMetaFromAnalysis(
        transcriptAnalysis,
        streamingMessageId,
        continueAssistantMessageId
      ),
    [continueAssistantMessageId, streamingMessageId, transcriptAnalysis]
  )
  const inlineCompactSummaryState = React.useMemo(() => {
    const byAssistantId = new Map<string, UnifiedMessage[]>()
    const summaryIds = new Set<string>()
    const activeCompact = resolveActiveCompactArtifacts(messages)
    const activeSummaryId = activeCompact?.summaryId ?? null
    if (!activeSummaryId) return { byAssistantId, summaryIds }

    const summary = messages.find((message) => message.id === activeSummaryId)
    const anchor = summary?.meta?.compactSummary?.displayAnchor
    if (!summary || !anchor?.assistantMessageId) return { byAssistantId, summaryIds }

    const assistantExists = messages.some(
      (message) => message.id === anchor.assistantMessageId && message.role === 'assistant'
    )
    if (!assistantExists) return { byAssistantId, summaryIds }

    byAssistantId.set(anchor.assistantMessageId, [summary])
    summaryIds.add(summary.id)
    return { byAssistantId, summaryIds }
  }, [messages])
  const assistantChangeTargets = React.useMemo(
    () =>
      messages
        .filter((message) => message.role === 'assistant')
        .map((message) => ({
          messageId: message.id,
          toolUseIds: getMessageToolUseIds(message)
        })),
    [messages]
  )
  const sessionAssistantMessageIds = React.useMemo(
    () => assistantChangeTargets.map((target) => target.messageId),
    [assistantChangeTargets]
  )
  const sessionToolUseIds = React.useMemo(
    () => Array.from(new Set(assistantChangeTargets.flatMap((target) => target.toolUseIds))),
    [assistantChangeTargets]
  )

  const messageLocatorSources = React.useMemo<MessageLocatorSource[]>(() => {
    const sourcesById = new Map<string, MessageLocatorSource>()
    for (const row of messageLocatorRows) {
      const source = parseLocatorRowSource(row)
      sourcesById.set(source.id, source)
    }

    messages.forEach((message, messageIndex) => {
      const existing = sourcesById.get(message.id)
      sourcesById.set(message.id, {
        id: message.id,
        role: message.role,
        content: message.content,
        meta: message.meta,
        createdAt: message.createdAt,
        sortOrder: existing?.sortOrder ?? loadedRangeStart + messageIndex,
        source: message.source
      })
    })

    return [...sourcesById.values()].sort((first, second) => {
      if (first.sortOrder !== second.sortOrder) return first.sortOrder - second.sortOrder
      return first.createdAt - second.createdAt
    })
  }, [loadedRangeStart, messageLocatorRows, messages])

  const hiddenAssistantRailCompactSummaryIds = React.useMemo(() => {
    const sourceIds = new Set(messageLocatorSources.map((source) => source.id))
    const hiddenIds = new Set(inlineCompactSummaryState.summaryIds)

    for (const source of messageLocatorSources) {
      const anchorId = source.meta?.compactSummary?.displayAnchor?.assistantMessageId
      if (anchorId && sourceIds.has(anchorId)) {
        hiddenIds.add(source.id)
      }
    }

    return hiddenIds
  }, [inlineCompactSummaryState.summaryIds, messageLocatorSources])

  const assistantRailLayout = React.useMemo<AssistantRailLayout>(() => {
    void assistantRailMeasureVersion
    return buildAssistantRailLayout({
      sources: messageLocatorSources,
      streamingMessageId,
      measuredHeights: measuredMessageHeightsRef.current,
      hiddenCompactSummaryIds: hiddenAssistantRailCompactSummaryIds,
      t
    })
  }, [
    assistantRailMeasureVersion,
    hiddenAssistantRailCompactSummaryIds,
    messageLocatorSources,
    streamingMessageId,
    t
  ])

  const assistantRailItems = assistantRailLayout.items
  const assistantRailItemById = React.useMemo(
    () => new Map(assistantRailItems.map((item) => [item.id, item])),
    [assistantRailItems]
  )

  React.useEffect(() => {
    let cancelled = false

    if (!activeSessionId) {
      setMessageLocatorSnapshot({
        sessionId: null,
        rows: EMPTY_MESSAGE_LOCATOR_ROWS
      })
      return
    }

    const loadMessageLocatorRows = async (): Promise<void> => {
      try {
        const rows = await invokeMessagePackBinary<MessageLocatorIndexRow[] | null>(
          DB_MESSAGES_LIST_LOCATOR_MSGPACK_CHANNEL,
          activeSessionId
        )
        if (!cancelled) {
          setMessageLocatorSnapshot({
            sessionId: activeSessionId,
            rows: Array.isArray(rows) ? rows : EMPTY_MESSAGE_LOCATOR_ROWS
          })
        }
      } catch (err) {
        console.error('[MessageList] Failed to load message locator rows:', err)
        if (!cancelled) {
          setMessageLocatorSnapshot({
            sessionId: activeSessionId,
            rows: EMPTY_MESSAGE_LOCATOR_ROWS
          })
        }
      }
    }

    void loadMessageLocatorRows()

    return () => {
      cancelled = true
    }
  }, [activeSessionId, activeSessionMessageCount])

  const rows = React.useMemo<MessageListRow[]>(() => {
    return renderableMessages
      .filter((message) => !inlineCompactSummaryState.summaryIds.has(message.messageId))
      .map<MessageListRow>((message) => ({
        type: 'message',
        key: message.messageId,
        data: message
      }))
  }, [inlineCompactSummaryState.summaryIds, renderableMessages])
  const hasLoadOlderRow = loadedRangeStart > 0
  const virtualRowCount = rows.length + (hasLoadOlderRow ? 1 : 0)

  const canAutoScroll = React.useCallback(() => {
    const mode = autoScrollModeRef.current
    return (
      mode === 'user' || (mode === 'stream' && canSessionTriggerStreamingAutoScroll && isAtBottom)
    )
  }, [canSessionTriggerStreamingAutoScroll, isAtBottom])

  // ---------------------------------------------------------------------------
  // 【临时修复 / Temporary workaround · 2026-07-10】
  //
  // 背景：
  // MessageList 用 @tanstack/react-virtual 把「整条 assistant 消息」当成一行。
  // 用户在消息中部展开「工具调用」时，只是行内高度变大，但库默认会走
  // resizeItem → applyScrollAdjustment：只要该行 start 在视口上方，就
  // scrollTop += 整段高度差，导致点击位置被顶走。
  //
  // 官方原因：
  // TanStack Virtual 默认补偿策略面向「普通列表行」：视口上方行变高时补 scroll，
  // 避免历史列表量高后视口内容漂移。聊天场景（一行=整条消息、行内折叠展开）
  // 默认语义不合适——可见行内部变高时，用户期望视口钉住、内容向下长。
  //
  // 社区同类反馈（仍 open）：
  // https://github.com/TanStack/virtual/issues/1218
  // 「applyScrollAdjustment causes chat stream viewport to drift downward when
  //  a visible streaming item keeps growing」
  // 结论与本场景一致：可见内容自己长高时，不补偿更稳；补偿会把视口拖跑。
  //
  // 本钩子是官方预留的策略入口（非业务侧 scrollTop 补丁）：
  // shouldAdjustScrollPositionOnItemSizeChange
  //
  // 策略：
  // 1) 正在 stick-to-bottom 跟随 → 不让 virtualizer 抢滚动（贴底仍走下方逻辑）
  // 2) 自由浏览时，仅当「整行完全在视口上方」才补偿
  // 3) 行与视口相交（中部展开工具调用）→ 不补偿，列表位置保持不动
  //
  // 后续维护：
  // 若官方默认策略/聊天示例修好了 #1218（或提供 chat 专用 anchor 模式），
  // 评估后可删除本回调，恢复库默认行为。删除前请对照 issue 与手测：
  // 中部展开/收起工具调用、流式贴底、加载更早消息。
  // ---------------------------------------------------------------------------
  const shouldAdjustScrollPositionOnItemSizeChange = React.useCallback(
    (item: { end: number }, _delta: number, instance: { scrollOffset: number | null }): boolean => {
      if (canAutoScroll()) return false
      const scrollOffset = instance.scrollOffset ?? 0
      return item.end < scrollOffset
    },
    [canAutoScroll]
  )

  const rowVirtualizer = useVirtualizer({
    count: virtualRowCount,
    getScrollElement: () => listRef.current,
    estimateSize: () => VIRTUAL_ROW_ESTIMATED_HEIGHT,
    initialOffset: () => virtualRowCount * VIRTUAL_ROW_ESTIMATED_HEIGHT,
    overscan: VIRTUAL_ROW_OVERSCAN,
    rangeExtractor: (range) => {
      if (pendingInitialScrollSessionIdRef.current !== activeSessionId || range.count === 0) {
        return defaultRangeExtractor(range)
      }

      const startIndex = Math.max(0, range.count - INITIAL_TAIL_RENDER_COUNT)
      return Array.from({ length: range.count - startIndex }, (_, offset) => startIndex + offset)
    },
    getItemKey: (index) => {
      if (hasLoadOlderRow && index === 0) return `load-older:${activeSessionId ?? 'none'}`
      const row = rows[index - (hasLoadOlderRow ? 1 : 0)]
      return row?.key ?? `row:${index}`
    }
  })
  // 当前 @tanstack/react-virtual@3.14.5 的 VirtualizerOptions 类型未暴露该钩子，
  // 但 virtual-core 实例属性存在且 resizeItem 会读它。必须挂到实例上，不能塞进 options
  //（options 路径 TS 报错且运行时也不会赋到 this.shouldAdjust...）。
  rowVirtualizer.shouldAdjustScrollPositionOnItemSizeChange =
    shouldAdjustScrollPositionOnItemSizeChange
  const pendingAskUserQuestion = React.useMemo(
    () => findPendingAskUserQuestion(rows, toolResultsLookup, messageLookup),
    [messageLookup, rows, toolResultsLookup]
  )
  const isAwaitingInitialMessages =
    Boolean(activeSessionId) &&
    messages.length === 0 &&
    (!activeSessionLoaded || activeSessionMessageCount > 0 || loadedRangeStart > 0)

  const lastMessageRowIndex = rows.length - 1

  const markProgrammaticScroll = React.useCallback(() => {
    programmaticScrollUntilRef.current = window.performance.now() + PROGRAMMATIC_SCROLL_GUARD_MS
  }, [])

  const scrollToBottomImmediate = React.useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      const ref = listRef.current
      if (!ref || rows.length === 0) return
      markProgrammaticScroll()
      const bottomOffset = Math.max(0, ref.scrollHeight - ref.clientHeight)
      if (behavior === 'auto') {
        ref.scrollTop = bottomOffset
        return
      }
      ref.scrollTo({ top: bottomOffset, behavior })
    },
    [markProgrammaticScroll, rows.length]
  )

  const syncBottomState = React.useCallback(() => {
    const ref = listRef.current
    if (!ref) return

    const distanceToBottom = getDistanceToBottom(ref)
    const threshold = isSessionOutputting
      ? STREAMING_AUTO_SCROLL_BOTTOM_THRESHOLD
      : AUTO_SCROLL_BOTTOM_THRESHOLD
    const previousOffset = lastScrollOffsetRef.current
    const currentOffset = ref.scrollTop
    const scrolledUp = currentOffset < previousOffset - BOTTOM_SCROLL_CORRECTION_EPSILON
    const isProgrammaticScroll = window.performance.now() < programmaticScrollUntilRef.current

    lastScrollOffsetRef.current = currentOffset

    // While streaming, keep the wider escape distance so minor jitter does not
    // detach the follow mode; when idle, any deliberate upward scroll releases it.
    const followReleaseThreshold = isSessionOutputting
      ? STREAMING_AUTO_SCROLL_STOP_THRESHOLD
      : threshold
    if (scrolledUp && distanceToBottom > followReleaseThreshold && !isProgrammaticScroll) {
      autoScrollModeRef.current = 'off'
      setIsAtBottom(false)
      return
    }

    const physicallyAtBottom = distanceToBottom <= threshold
    if (physicallyAtBottom && isSessionOutputting && autoScrollModeRef.current === 'off') {
      autoScrollModeRef.current = 'stream'
    }

    const nextAtBottom =
      physicallyAtBottom || (isSessionOutputting && autoScrollModeRef.current === 'stream')

    setIsAtBottom((prev) => (prev === nextAtBottom ? prev : nextAtBottom))
  }, [isSessionOutputting])

  const measureVisibleMessageHeights = React.useCallback(() => {
    const ref = listRef.current
    if (!ref) return false

    let changed = false
    for (const element of ref.querySelectorAll<HTMLElement>('[data-message-id]')) {
      const messageId = element.dataset.messageId
      if (!messageId) continue
      const height = element.offsetHeight
      if (height <= 0) continue
      const previous = measuredMessageHeightsRef.current.get(messageId)
      if (previous === undefined || Math.abs(previous - height) > 2) {
        measuredMessageHeightsRef.current.set(messageId, height)
        changed = true
      }
    }

    return changed
  }, [])

  const setActiveAssistantRailIds = React.useCallback((nextIds: Set<string>) => {
    setActiveAssistantRailMessageIds((previousIds) =>
      areStringSetsEqual(previousIds, nextIds) ? previousIds : nextIds
    )
  }, [])

  const syncActiveAssistantRail = React.useCallback(() => {
    const ref = listRef.current
    if (!ref || assistantRailItems.length === 0 || assistantRailLayout.rows.length === 0) {
      setActiveAssistantRailIds(new Set())
      return
    }

    const didMeasure = measureVisibleMessageHeights()
    if (didMeasure) {
      setAssistantRailMeasureVersion((version) => version + 1)
    }

    const containerRect = ref.getBoundingClientRect()
    const nextActiveIds = new Set<string>()

    for (const element of ref.querySelectorAll<HTMLElement>('[data-message-id]')) {
      const messageId = element.dataset.messageId
      if (!messageId) continue
      if (!assistantRailItemById.has(messageId)) continue
      const rect = element.getBoundingClientRect()
      if (rect.bottom <= containerRect.top || rect.top >= containerRect.bottom) continue
      nextActiveIds.add(messageId)
    }

    setActiveAssistantRailIds(nextActiveIds)
  }, [
    assistantRailItemById,
    assistantRailItems,
    assistantRailLayout,
    measureVisibleMessageHeights,
    setActiveAssistantRailIds
  ])

  const requestAssistantRailSync = React.useCallback(() => {
    if (scheduledAssistantRailSyncRef.current !== null) return
    scheduledAssistantRailSyncRef.current = window.requestAnimationFrame(() => {
      scheduledAssistantRailSyncRef.current = null
      syncActiveAssistantRail()
    })
  }, [syncActiveAssistantRail])

  const handleJumpToAssistantMessage = React.useCallback(
    async (item: AssistantReplyRailItem): Promise<void> => {
      const messageId = item.id
      autoScrollModeRef.current = 'off'
      setIsAtBottom(false)

      const setHighlightTimer = (): void => {
        setHighlightedMessageId(messageId)
        if (highlightedMessageTimerRef.current !== null) {
          window.clearTimeout(highlightedMessageTimerRef.current)
        }
        highlightedMessageTimerRef.current = window.setTimeout(() => {
          setHighlightedMessageId((prev) => (prev === messageId ? null : prev))
          highlightedMessageTimerRef.current = null
        }, USER_LOCATOR_HIGHLIGHT_MS)
      }

      const scrollToTarget = (behavior: ScrollBehavior = 'smooth'): boolean => {
        const ref = listRef.current
        if (!ref) return false

        const target = Array.from(ref.querySelectorAll<HTMLElement>('[data-message-id]')).find(
          (element) => element.dataset.messageId === messageId
        )
        if (!target) return false

        markProgrammaticScroll()
        setActiveAssistantRailIds(new Set([messageId]))
        setHighlightTimer()
        // offsetTop is relative to the absolutely-positioned virtual row wrapper and
        // ignores its translateY, so derive the real position from bounding rects.
        const targetTop =
          ref.scrollTop + (target.getBoundingClientRect().top - ref.getBoundingClientRect().top)
        ref.scrollTo({
          top: Math.max(0, targetTop - ASSISTANT_RAIL_SCROLL_OFFSET),
          behavior
        })
        requestAssistantRailSync()
        return true
      }

      if (scrollToTarget()) return
      if (!activeSessionId) return

      await useChatStore
        .getState()
        .loadMessageWindowAround?.(activeSessionId, { messageId, sortOrder: item.sortOrder }, 30)

      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve())
        })
      })

      if (scrollToTarget()) return

      const chatState = useChatStore.getState()
      const targetIndex = chatState
        .getSessionMessages(activeSessionId)
        .findIndex((message) => message.id === messageId)
      if (targetIndex >= 0) {
        const targetSession = chatState.sessions.find((session) => session.id === activeSessionId)
        rowVirtualizer.scrollToIndex(
          targetIndex + ((targetSession?.loadedRangeStart ?? 0) > 0 ? 1 : 0),
          { align: 'center' }
        )
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => resolve())
        })
        scrollToTarget('auto')
      }
    },
    [
      activeSessionId,
      markProgrammaticScroll,
      requestAssistantRailSync,
      rowVirtualizer,
      setActiveAssistantRailIds
    ]
  )

  const loadOlderMessages = React.useCallback(
    async (preserveResidentHistory = false): Promise<number> => {
      if (!activeSessionId || isLoadingOlderMessages || loadedRangeStart <= 0) return 0

      const ref = listRef.current
      const previousScrollHeight = ref?.scrollHeight ?? 0
      const previousScrollTop = ref?.scrollTop ?? 0

      const startBefore = loadedRangeStart
      autoScrollModeRef.current = 'off'
      setIsLoadingOlderMessages(true)
      try {
        const loaded = await useChatStore
          .getState()
          .loadOlderSessionMessages(activeSessionId, undefined, { preserveResidentHistory })
        // loadOlderSessionMessages reports the rows it read from the DB, but a
        // running session's tail-trim can splice those same rows straight back off
        // (getMessageWindowPreserveMode forces 'tail' while running). Treat "the
        // window didn't actually grow older" as a stall so callers stop retrying.
        const startAfter =
          useChatStore.getState().sessions.find((s) => s.id === activeSessionId)
            ?.loadedRangeStart ?? startBefore
        if (loaded <= 0 || startAfter >= startBefore) {
          stalledOlderLoadStartRef.current = startBefore
          return loaded > 0 ? loaded : 0
        }
        stalledOlderLoadStartRef.current = null

        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => resolve())
          })
        })

        const nextRef = listRef.current
        if (nextRef) {
          const scrollDelta = nextRef.scrollHeight - previousScrollHeight
          if (scrollDelta !== 0) {
            markProgrammaticScroll()
            nextRef.scrollTop = Math.max(0, previousScrollTop + scrollDelta)
          }
        }
        syncBottomState()
        requestAssistantRailSync()
        return loaded
      } finally {
        setIsLoadingOlderMessages(false)
      }
    },
    [
      activeSessionId,
      isLoadingOlderMessages,
      loadedRangeStart,
      markProgrammaticScroll,
      requestAssistantRailSync,
      syncBottomState
    ]
  )

  const requestScrollToBottom = React.useCallback(
    ({
      behavior = 'auto',
      force = false,
      maxFrames = 1
    }: {
      behavior?: ScrollBehavior
      force?: boolean
      maxFrames?: number
    } = {}) => {
      if (scheduledScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scheduledScrollFrameRef.current)
      }

      let framesLeft = Math.max(1, maxFrames)
      const run = (): void => {
        scheduledScrollFrameRef.current = null
        const ref = listRef.current
        if (!ref) return
        if (!force && !canAutoScroll()) return

        if (force || getDistanceToBottom(ref) > AUTO_SCROLL_MIN_DELTA) {
          scrollToBottomImmediate(behavior)
        }
        framesLeft -= 1
        if (framesLeft > 0) {
          scheduledScrollFrameRef.current = window.requestAnimationFrame(run)
          return
        }
        syncBottomState()
      }

      scheduledScrollFrameRef.current = window.requestAnimationFrame(run)
    },
    [canAutoScroll, scrollToBottomImmediate, syncBottomState]
  )

  React.useEffect(() => {
    if (!canSessionTriggerStreamingAutoScroll) return
    if (pendingAskUserQuestion) return

    const intervalId = window.setInterval(() => {
      if (!canAutoScroll()) return
      requestScrollToBottom({ maxFrames: FOLLOW_BOTTOM_SETTLE_FRAMES })
    }, STREAMING_AUTO_SCROLL_POLL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [
    canAutoScroll,
    canSessionTriggerStreamingAutoScroll,
    pendingAskUserQuestion,
    requestScrollToBottom
  ])

  const handleListScroll = React.useCallback(() => {
    syncBottomState()
    requestAssistantRailSync()
    const ref = listRef.current
    if (
      ref &&
      !isLoadingOlderMessages &&
      loadedRangeStart > 0 &&
      stalledOlderLoadStartRef.current !== loadedRangeStart &&
      ref.scrollTop <= OLDER_MESSAGE_LOAD_SCROLL_THRESHOLD
    ) {
      void loadOlderMessages()
    }
  }, [
    isLoadingOlderMessages,
    loadOlderMessages,
    loadedRangeStart,
    requestAssistantRailSync,
    syncBottomState
  ])

  React.useEffect(() => {
    if (!activeSessionId) return
    void useChatStore.getState().loadRecentSessionMessages(activeSessionId)
  }, [activeSessionId])

  React.useEffect(() => {
    if (!activeSessionId || !streamingMessageId) return

    const hasStreamingMessageInView = messages.some((message) => message.id === streamingMessageId)
    if (hasStreamingMessageInView) return

    void useChatStore.getState().loadRecentSessionMessages(activeSessionId, true)
  }, [activeSessionId, messages, streamingMessageId])

  React.useLayoutEffect(() => {
    pendingInitialScrollSessionIdRef.current = activeSessionId
    lastScrollOffsetRef.current = 0
    programmaticScrollUntilRef.current = 0
    measuredMessageHeightsRef.current.clear()
    stalledOlderLoadStartRef.current = null
    setAssistantRailMeasureVersion((version) => version + 1)
    setActiveAssistantRailIds(new Set())
  }, [activeSessionId, setActiveAssistantRailIds])

  React.useLayoutEffect(() => {
    if (!activeSessionId) return
    if (pendingInitialScrollSessionIdRef.current !== activeSessionId) return
    if (!(messages.length > 0 || streamingMessageId)) return

    // Enter a follow mode on open so the bottom anchor below keeps re-pinning
    // while virtualized rows are measured; released on the first upward scroll.
    autoScrollModeRef.current = isSessionOutputting ? 'stream' : 'user'

    // Position the estimated virtual list before the first paint. Later layout
    // passes and the resize observer below correct asynchronously measured content.
    scrollToBottomImmediate()

    if (initialTailReleaseFrameRef.current !== null) {
      window.cancelAnimationFrame(initialTailReleaseFrameRef.current)
    }
    const initializedSessionId = activeSessionId
    initialTailReleaseFrameRef.current = window.requestAnimationFrame(() => {
      if (pendingInitialScrollSessionIdRef.current === initializedSessionId) {
        pendingInitialScrollSessionIdRef.current = null
      }
      initialTailReleaseFrameRef.current = null
    })
  }, [
    activeSessionId,
    isSessionOutputting,
    messages.length,
    scrollToBottomImmediate,
    streamingMessageId
  ])

  React.useEffect(() => {
    const wasOutputting = wasSessionOutputtingRef.current
    if (!wasOutputting && isSessionOutputting && isAtBottom && !pendingAskUserQuestion) {
      autoScrollModeRef.current = 'stream'
    } else if (wasOutputting && !isSessionOutputting && autoScrollModeRef.current === 'stream') {
      autoScrollModeRef.current = 'off'
    }
    wasSessionOutputtingRef.current = isSessionOutputting
  }, [isAtBottom, isSessionOutputting, pendingAskUserQuestion])

  React.useLayoutEffect(() => {
    if (pendingAskUserQuestion) return
    if (!canAutoScroll()) return
    scrollToBottomImmediate()
  }, [canAutoScroll, pendingAskUserQuestion, rows.length, scrollToBottomImmediate])

  // Bottom anchor: rows are virtualized with estimated heights, so a single
  // scroll-to-bottom lands short once the real (larger) row heights are
  // measured and the total size grows. Re-pin whenever the measured total size
  // changes while we are following the bottom, until measurement converges.
  const virtualListTotalSize = rowVirtualizer.getTotalSize()
  React.useLayoutEffect(() => {
    if (pendingAskUserQuestion) return
    if (!canAutoScroll() && !isAtBottom) return
    scrollToBottomImmediate()
  }, [
    canAutoScroll,
    isAtBottom,
    pendingAskUserQuestion,
    scrollToBottomImmediate,
    virtualListTotalSize
  ])

  React.useEffect(() => {
    const viewport = listRef.current
    const content = virtualContentRef.current
    if (!activeSessionId || !viewport || !content || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => {
      // Composer hydration and async message rendering can change the viewport
      // or content after the initial virtual-list measurements have settled.
      // Keep following only until the user deliberately scrolls upward.
      if (!canAutoScroll()) return
      scrollToBottomImmediate()
    })

    observer.observe(viewport)
    observer.observe(content)

    return () => {
      observer.disconnect()
    }
  }, [activeSessionId, canAutoScroll, scrollToBottomImmediate])

  React.useEffect(() => {
    if (!activeSessionId || isAwaitingInitialMessages || isLoadingOlderMessages) return
    if (loadedRangeStart <= 0 || renderableMessages.length >= MIN_RENDERABLE_HISTORY_ROWS) return
    // A previous auto-load at this exact position already failed to grow the
    // renderable window (all-hidden older page, or a running session's tail-trim
    // undoing the load). Stop hammering — real progress moves loadedRangeStart,
    // which re-arms this guard.
    if (stalledOlderLoadStartRef.current === loadedRangeStart) return
    void loadOlderMessages()
  }, [
    activeSessionId,
    isAwaitingInitialMessages,
    isLoadingOlderMessages,
    loadOlderMessages,
    loadedRangeStart,
    renderableMessages.length
  ])

  React.useEffect(() => {
    requestAssistantRailSync()
  }, [requestAssistantRailSync])

  React.useEffect(() => {
    return () => {
      if (initialTailReleaseFrameRef.current !== null) {
        window.cancelAnimationFrame(initialTailReleaseFrameRef.current)
      }
      if (scheduledScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scheduledScrollFrameRef.current)
      }
      if (scheduledAssistantRailSyncRef.current !== null) {
        window.cancelAnimationFrame(scheduledAssistantRailSyncRef.current)
      }
      if (highlightedMessageTimerRef.current !== null) {
        window.clearTimeout(highlightedMessageTimerRef.current)
      }
    }
  }, [])

  const scrollToBottom = React.useCallback(() => {
    autoScrollModeRef.current = 'user'
    setIsAtBottom(true)
    requestScrollToBottom({ behavior: 'smooth', force: true })
  }, [requestScrollToBottom])

  const applySuggestedPrompt = React.useCallback((prompt: string) => {
    const textarea = document.querySelector('textarea')
    if (textarea instanceof window.HTMLTextAreaElement) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set
      nativeInputValueSetter?.call(textarea, prompt)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      textarea.focus()
      return
    }

    const editor = document.querySelector('[role="textbox"][contenteditable="true"]')
    if (editor instanceof HTMLDivElement) {
      editor.replaceChildren(document.createTextNode(prompt))
      editor.dispatchEvent(new Event('input', { bubbles: true }))
      editor.focus()
    }
  }, [])

  if (isAwaitingInitialMessages) {
    return (
      <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden px-4 pt-6">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={`${getMessageColumnClass(fullWidth)} space-y-2 ${
              index % 2 === 0 ? 'self-start' : 'self-end'
            }`}
          >
            <div className="h-3 w-3/5 animate-pulse rounded-md bg-muted/50" />
            <div className="h-3 w-4/5 animate-pulse rounded-md bg-muted/40" />
            <div className="h-3 w-1/2 animate-pulse rounded-md bg-muted/30" />
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    const hint = modeHints[mode]
    const projectScoped = Boolean(activeProjectId)
    const emptyTitle = projectScoped
      ? `What should we build in ${activeProjectName ?? 'this project'}?`
      : mode === 'chat'
        ? 'What should we talk through?'
        : t(hint.titleKey)
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center px-6 text-center">
        <div
          className={`flex flex-col items-center gap-3 ${getMessageColumnCompactClass(fullWidth)}`}
        >
          <div>
            <p className="text-[18px] font-semibold tracking-tight text-foreground/92 sm:text-[19px]">
              {emptyTitle}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground/70 sm:text-[14px]">
              {projectScoped ? t('messageList.startCodingDesc') : t(hint.descKey)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex max-w-[520px] flex-wrap justify-center gap-2">
          {(mode === 'chat'
            ? [
                t('messageList.explainAsync'),
                t('messageList.compareRest'),
                t('messageList.writeRegex')
              ]
            : activeWorkingFolder
              ? [
                  t('messageList.summarizeProject'),
                  t('messageList.findBugs'),
                  t('messageList.addErrorHandling')
                ]
              : [
                  t('messageList.reviewCodebase'),
                  t('messageList.addTests'),
                  t('messageList.refactorError')
                ]
          ).map((prompt) => (
            <button
              key={prompt}
              className="rounded-md border border-border/60 bg-background/50 px-3 py-1.5 text-[11px] text-muted-foreground/70 transition-colors hover:bg-muted/50 hover:text-foreground"
              onClick={() => applySuggestedPrompt(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (exportAll) {
    return (
      <div ref={containerRef} className="relative h-full flex-1" data-message-list>
        <div data-message-content>
          {renderableMessages.map((row) => {
            const message = messageLookup.get(row.messageId)
            if (!message) return null

            return (
              <MessageRow
                key={row.messageId}
                message={message}
                sessionId={targetSessionId}
                sessionAssistantMessageIds={sessionAssistantMessageIds}
                sessionToolUseIds={sessionToolUseIds}
                isStreaming={streamingMessageId === row.messageId}
                isLastUserMessage={row.isLastUserMessage}
                isLastAssistantMessage={row.isLastAssistantMessage}
                showContinue={row.showContinue}
                disableAnimation
                toolResults={toolResultsLookup.get(row.messageId)}
                inlineCompactSummaries={inlineCompactSummaryState.byAssistantId.get(row.messageId)}
                orchestrationRun={
                  orchestrationState.byMessageId.get(row.messageId)?.primaryRun ?? null
                }
                hiddenToolUseIds={mergeHiddenToolUseIds(
                  orchestrationState.byMessageId.get(row.messageId)?.hiddenToolUseIds,
                  duplicatePlanReviewToolUseIds
                )}
                anchorMessageId={null}
                highlightMessageId={null}
                requestRetryState={
                  row.isLastAssistantMessage ? (sessionRequestRetryState ?? null) : null
                }
                fullWidth={fullWidth}
                onRetry={onRetry}
                onContinue={onContinue}
                onEditUserMessage={onEditUserMessage}
                onDeleteMessage={onDeleteMessage}
              />
            )
          })}
        </div>
      </div>
    )
  }

  const messageListContent = (
    <div ref={containerRef} className="relative h-full flex-1" data-message-list>
      <div
        ref={listRef}
        className="absolute inset-0 overflow-y-auto pl-7 md:pl-9"
        data-message-content
        style={{ overflowAnchor: 'none' }}
        onScroll={handleListScroll}
      >
        <div
          ref={virtualContentRef}
          className="relative w-full"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const isLoadOlderRow = hasLoadOlderRow && virtualRow.index === 0
            const rowIndex = virtualRow.index - (hasLoadOlderRow ? 1 : 0)

            return (
              <div
                key={virtualRow.key}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {isLoadOlderRow ? (
                  <div
                    className={`${getMessageColumnClass(fullWidth)} flex justify-center pb-3 pt-3 animate-in fade-in-0 duration-200`}
                  >
                    <button
                      type="button"
                      className="rounded-full border border-border/70 bg-background/92 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:text-foreground disabled:cursor-wait disabled:opacity-70"
                      onClick={() => void loadOlderMessages(true)}
                      disabled={isLoadingOlderMessages}
                    >
                      {isLoadingOlderMessages
                        ? t('messageList.loadingOlder')
                        : t('messageList.loadOlder', { count: loadedRangeStart })}
                    </button>
                  </div>
                ) : (
                  (() => {
                    const row = rows[rowIndex]
                    if (!row) return null

                    const liveCutoffIndex = Math.max(
                      0,
                      lastMessageRowIndex - TAIL_LIVE_MESSAGE_COUNT
                    )
                    const disableAnimation =
                      lastMessageRowIndex >= 0
                        ? rowIndex >=
                          Math.max(0, lastMessageRowIndex - (TAIL_STATIC_MESSAGE_COUNT - 1))
                        : false

                    const { messageId, isLastUserMessage, isLastAssistantMessage, showContinue } =
                      row.data
                    const message = messageLookup.get(messageId)
                    if (!message) return null

                    const isEmptyAssistantLoading =
                      isLastAssistantMessage &&
                      isAgentExecutionActive &&
                      hasEmptyAssistantContent(message)
                    const isStreaming = streamingMessageId === messageId || isEmptyAssistantLoading
                    const rowRenderMode =
                      !isStreaming && rowIndex < liveCutoffIndex ? 'static' : undefined

                    return (
                      <MessageRow
                        message={message}
                        sessionId={targetSessionId}
                        sessionAssistantMessageIds={sessionAssistantMessageIds}
                        sessionToolUseIds={sessionToolUseIds}
                        isStreaming={isStreaming}
                        isLastUserMessage={isLastUserMessage}
                        isLastAssistantMessage={isLastAssistantMessage}
                        showContinue={showContinue}
                        disableAnimation={disableAnimation}
                        toolResults={toolResultsLookup.get(messageId)}
                        inlineCompactSummaries={inlineCompactSummaryState.byAssistantId.get(
                          messageId
                        )}
                        orchestrationRun={
                          orchestrationState.byMessageId.get(messageId)?.primaryRun ?? null
                        }
                        hiddenToolUseIds={mergeHiddenToolUseIds(
                          orchestrationState.byMessageId.get(messageId)?.hiddenToolUseIds,
                          duplicatePlanReviewToolUseIds
                        )}
                        anchorMessageId={null}
                        highlightMessageId={highlightedMessageId}
                        renderMode={rowRenderMode}
                        requestRetryState={
                          isLastAssistantMessage ? (sessionRequestRetryState ?? null) : null
                        }
                        fullWidth={fullWidth}
                        onRetry={onRetry}
                        onContinue={onContinue}
                        onEditUserMessage={onEditUserMessage}
                        onDeleteMessage={onDeleteMessage}
                      />
                    )
                  })()
                )}
              </div>
            )
          })}
        </div>
      </div>

      <AssistantReplyRail
        items={assistantRailItems}
        activeMessageIds={activeAssistantRailMessageIds}
        onJump={handleJumpToAssistantMessage}
      />

      <AnimatePresence>
        {!isAtBottom && messages.length > 0 && (
          <motion.div
            key="scroll-to-bottom"
            className="absolute bottom-4 left-1/2 z-10"
            initial={animationsEnabled ? { opacity: 0, scale: 0.9, y: 4, x: '-50%' } : false}
            animate={{ opacity: 1, scale: 1, y: 0, x: '-50%' }}
            exit={animationsEnabled ? { opacity: 0, scale: 0.9, y: 4, x: '-50%' } : undefined}
            transition={animationsEnabled ? { duration: 0.15, ease: 'easeOut' } : { duration: 0 }}
          >
            <button
              onClick={scrollToBottom}
              className="flex items-center gap-1.5 rounded-full border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-lg backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:text-foreground hover:shadow-xl"
            >
              <ArrowDown className="size-3" />
              {t('messageList.scrollToBottom')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  return isStreamingPerfEnabled() ? (
    <React.Profiler
      id="MessageList"
      onRender={(_id, phase, actualDuration, baseDuration) => {
        recordStreamingReactCommit(actualDuration, { phase, baseDuration })
      }}
    >
      {messageListContent}
    </React.Profiler>
  ) : (
    messageListContent
  )
}

function areMessageListPropsEqual(prev: MessageListProps, next: MessageListProps): boolean {
  return (
    prev.sessionId === next.sessionId &&
    prev.onRetry === next.onRetry &&
    prev.onContinue === next.onContinue &&
    prev.onEditUserMessage === next.onEditUserMessage &&
    prev.onDeleteMessage === next.onDeleteMessage &&
    prev.exportAll === next.exportAll &&
    prev.fullWidth === next.fullWidth
  )
}

export const MessageList = React.memo(MessageListInner, areMessageListPropsEqual)
