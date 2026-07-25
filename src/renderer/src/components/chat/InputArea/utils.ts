// Pure utility functions for InputArea

import type { TokenUsage, UnifiedMessage, RequestTiming } from '@renderer/lib/api/types'
import type { RuntimeOutputSnapshot, RuntimeUsageTotals } from './types'
import type { AppPluginId } from '@renderer/lib/app-plugin/types'
import { IMAGE_PLUGIN_ID, BROWSER_PLUGIN_ID } from '@renderer/lib/app-plugin/types'
import type { PendingSessionMessageItem } from '@renderer/hooks/use-chat-actions'
import type { SelectedFileItem, EditorDocumentNode } from '@renderer/lib/select-file-editor'
import type { SelectedFileReference } from '@renderer/lib/api/types'
import { IMAGE_MEDIA_TYPE_BY_EXTENSION } from './types'
import { calculateCost, calculateCostBreakdown, getBillableInputTokens, getCacheCreationTokens, getCacheCreationSplit } from '@renderer/lib/format-tokens'
import { formatDurationMs } from '@renderer/lib/format-duration'
import { selectFileTextToPlainText } from '@renderer/lib/select-file-tags'

export function normalizeTokenCount(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0
  return Math.floor(value)
}

export function toFinitePositiveNumber(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

export function getLatestRequestTiming(usage: TokenUsage | undefined): RequestTiming | null {
  const timings = usage?.requestTimings
  if (!timings?.length) return null
  for (let index = timings.length - 1; index >= 0; index -= 1) {
    const timing = timings[index]
    if (
      toFinitePositiveNumber(timing?.ttftMs) !== null ||
      toFinitePositiveNumber(timing?.tps) !== null
    ) {
      return timing
    }
  }
  return null
}

export function formatRuntimeThroughput(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return value >= 100 ? value.toFixed(1) : value.toFixed(2)
}

export function formatRuntimeTtft(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s'
  if (ms < 10_000) return `${(ms / 1000).toFixed(2)}s`
  return formatDurationMs(ms)
}

export function sumNullableCost(current: number | null, next: number | null): number | null {
  if (next == null) return current
  return (current ?? 0) + next
}

export function createEmptyRuntimeUsageTotals(): RuntimeUsageTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    billableInputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    cacheCreation5mTokens: 0,
    cacheCreation1hTokens: 0,
    inputCost: null,
    outputCost: null,
    cacheReadCost: null,
    cacheCreationCost: null,
    totalCost: null,
    latestRequestTiming: null
  }
}

export function getBillableInputForUsage(usage: TokenUsage): number {
  return normalizeTokenCount(getBillableInputTokens(usage))
}

export function addUsageToTotals(
  totals: RuntimeUsageTotals,
  usage: TokenUsage | undefined,
  modelCfg: import('@renderer/lib/api/types').AIModelConfig | null | undefined
): void {
  if (!usage) return
  totals.inputTokens += normalizeTokenCount(usage.inputTokens)
  totals.outputTokens += normalizeTokenCount(usage.outputTokens)
  totals.billableInputTokens += getBillableInputForUsage(usage)
  totals.cacheReadTokens += normalizeTokenCount(usage.cacheReadTokens)
  totals.cacheCreationTokens += normalizeTokenCount(getCacheCreationTokens(usage))
  const cacheCreationSplit = getCacheCreationSplit(usage)
  totals.cacheCreation5mTokens += normalizeTokenCount(cacheCreationSplit.fiveMinuteTokens)
  totals.cacheCreation1hTokens += normalizeTokenCount(cacheCreationSplit.oneHourTokens)
  totals.latestRequestTiming = getLatestRequestTiming(usage) ?? totals.latestRequestTiming

  const costBreakdown = calculateCostBreakdown(usage, modelCfg)
  totals.inputCost = sumNullableCost(totals.inputCost, costBreakdown.inputCost)
  totals.outputCost = sumNullableCost(totals.outputCost, costBreakdown.outputCost)
  totals.cacheReadCost = sumNullableCost(totals.cacheReadCost, costBreakdown.cacheReadCost)
  totals.cacheCreationCost = sumNullableCost(
    totals.cacheCreationCost,
    costBreakdown.cacheCreationCost
  )

  const msgCost = calculateCost(usage, modelCfg)
  if (msgCost !== null) {
    totals.totalCost = (totals.totalCost ?? 0) + msgCost
  }
}

export function collectRuntimeOutputSnapshot(
  content: UnifiedMessage['content'] | undefined
): RuntimeOutputSnapshot {
  if (!content) {
    return { text: '', hasTextOutput: false, hasActiveThinking: false }
  }

  if (typeof content === 'string') {
    return {
      text: content,
      hasTextOutput: content.trim().length > 0,
      hasActiveThinking: false
    }
  }

  const parts: string[] = []
  let hasTextOutput = false
  let hasActiveThinking = false

  for (const block of content) {
    if (block.type === 'text') {
      if (block.text) {
        parts.push(block.text)
        hasTextOutput = hasTextOutput || block.text.trim().length > 0
      }
      continue
    }

    if (block.type === 'thinking') {
      if (block.thinking) {
        parts.push(block.thinking)
      }
      if (!block.completedAt && block.thinking.trim().length > 0) {
        hasActiveThinking = true
      }
    }
  }

  return {
    text: parts.join('\n'),
    hasTextOutput,
    hasActiveThinking
  }
}


export function getAppPluginPromptContent(pluginId: AppPluginId): string {
  if (pluginId === IMAGE_PLUGIN_ID) {
    return [
      `[Plugin: ${pluginId}]`,
      'Use the Image Plugin for this request. When generating images, call ImageGenerate with a concrete prompt; when reference images are selected, pass them through reference_images.'
    ].join('\n')
  }

  if (pluginId === BROWSER_PLUGIN_ID) {
    return [
      `[Plugin: ${pluginId}]`,
      'Use the Browser Plugin for this request. Navigate, inspect, capture screenshots, and read page content with the browser tools when web evidence or prototype QA is needed.'
    ].join('\n')
  }

  return [
    `[Plugin: ${pluginId}]`,
    `Use the ${pluginId} plugin for this request when its tools or workflow are relevant.`
  ].join('\n')
}

export function getSlashCommandQuery(text: string): string | null {
  const normalized = text.trimStart()
  const match = normalized.match(/^\/([^\s]*)$/)
  return match ? (match[1] ?? '') : null
}

export function scoreSlashCommand(name: string, query: string): number {
  const normalizedName = name.toLowerCase()
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) return 0
  if (normalizedName === normalizedQuery) return 0
  if (normalizedName.startsWith(normalizedQuery)) return 1

  const containsIndex = normalizedName.indexOf(normalizedQuery)
  if (containsIndex >= 0) return 10 + containsIndex

  let cursor = 0
  let gapScore = 0
  for (const char of normalizedQuery) {
    const nextIndex = normalizedName.indexOf(char, cursor)
    if (nextIndex < 0) return Number.POSITIVE_INFINITY
    gapScore += nextIndex - cursor
    cursor = nextIndex + 1
  }

  return 100 + gapScore
}

export function areQueuedMessagesEqual(
  left: PendingSessionMessageItem[],
  right: PendingSessionMessageItem[]
): boolean {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i += 1) {
    const leftMsg = left[i]
    const rightMsg = right[i]
    if (leftMsg.id !== rightMsg.id) return false
    if (leftMsg.text !== rightMsg.text) return false
    if (leftMsg.createdAt !== rightMsg.createdAt) return false
    if (leftMsg.command?.name !== rightMsg.command?.name) return false
    if (leftMsg.command?.content !== rightMsg.command?.content) return false
    if (leftMsg.images.length !== rightMsg.images.length) return false
    for (let j = 0; j < leftMsg.images.length; j += 1) {
      if (leftMsg.images[j].id !== rightMsg.images[j].id) return false
    }
  }
  return true
}

export function summarizeQueuedMessage(text: string): string {
  const normalized = selectFileTextToPlainText(text).replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return normalized.length > 72 ? `${normalized.slice(0, 72)}…` : normalized
}

export function isReferenceOnlyDocument(document: EditorDocumentNode[]): boolean {
  if (document.length === 0) return false

  return document.every((node) => node.type !== 'text' || node.text.trim().length === 0)
}

export function getImageMediaTypeForPath(filePath: string): string | null {
  const normalized = filePath.split(/[?#]/, 1)[0]?.toLowerCase() ?? ''
  const extension = normalized.match(/\.([a-z0-9]+)$/)?.[1]
  return extension ? (IMAGE_MEDIA_TYPE_BY_EXTENSION[extension] ?? null) : null
}

export function createImageAttachmentId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `image-${Date.now()}-${Math.random().toString(36)}`
}

export function selectedFileItemToReference(file: SelectedFileItem): SelectedFileReference {
  return {
    id: file.id,
    name: file.name,
    originalPath: file.originalPath,
    sendPath: file.sendPath,
    previewPath: file.previewPath,
    isWorkspaceFile: file.isWorkspaceFile
  }
}

