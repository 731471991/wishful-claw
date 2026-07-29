// Prompt optimization state and handlers for InputArea

import * as React from 'react'
import { toast } from 'sonner'
import { useProviderStore } from '@renderer/stores/provider-store'
import type { AppLanguage } from '@renderer/lib/i18n-language'

export interface UsePromptOptimizerOptions {
  text: string
  currentLanguage: AppLanguage
  setText: (value: string | ((prev: string) => string)) => void
  focusInputAtEnd: () => void
}

export interface OptimizationOption {
  title: string
  focus: string
  content: string
}

export function usePromptOptimizer(opts: UsePromptOptimizerOptions) {
  const { text, currentLanguage, setText, focusInputAtEnd } = opts
  const [isOptimizing, setIsOptimizing] = React.useState(false)
  const [, setOptimizingText] = React.useState('')
  const [optimizationOptions, setOptimizationOptions] = React.useState<OptimizationOption[]>([])
  const [showOptimizationDialog, setShowOptimizationDialog] = React.useState(false)
  const [selectedOptionIndex, setSelectedOptionIndex] = React.useState(0)
  const contentScrollRef = React.useRef<HTMLDivElement>(null)

  const handleOptimizePrompt = React.useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || isOptimizing) return

    setIsOptimizing(true)
    setOptimizingText('')
    setOptimizationOptions([])
    setSelectedOptionIndex(0)
    // Show dialog immediately — options will load progressively
    setShowOptimizationDialog(true)

    try {
      const { optimizePrompt } = await import('@renderer/lib/prompt-optimizer/optimizer')

      // Reuse the active provider config (same as normal chat) to avoid
      // baseUrl/model mismatches that cause 404s.
      const providerStore = useProviderStore.getState()
      const activeProvider = providerStore.getActiveProvider()

      if (!activeProvider) {
        toast.error('No AI provider available', {
          description: 'Please configure an AI provider in Settings'
        })
        setIsOptimizing(false)
        return
      }

      // Use the same model resolution as normal chat: activeModelId first,
      // then defaultModel, then first enabled model.
      const modelId =
        providerStore.activeModelId ||
        activeProvider.defaultModel ||
        activeProvider.models.find((m: { enabled: boolean }) => m.enabled)?.id

      if (!modelId) {
        toast.error('No AI model available', { description: 'Please enable a model in Settings' })
        setIsOptimizing(false)
        return
      }

      const providerConfig = {
        type: activeProvider.type,
        apiKey: activeProvider.apiKey,
        baseUrl: activeProvider.baseUrl,
        model: modelId,
        providerId: activeProvider.id,
        maxTokens: 4096,
        temperature: 0.7,
        systemPrompt: ''
      }

      for await (const event of optimizePrompt(trimmed, providerConfig, currentLanguage)) {
        if (event.type === 'text') {
          setOptimizingText((prev) => prev + event.content)
        } else if (event.type === 'tool_call' && event.options && event.options.length > 0) {
          // Progressive: add options as they arrive
          setOptimizationOptions((prev) => [...prev, ...event.options!])
        } else if (event.type === 'result' && event.options && event.options.length > 0) {
          // Final batch — only set if we don't already have options from tool_call
          setOptimizationOptions((prev) => prev.length > 0 ? prev : event.options!)
          setSelectedOptionIndex(0)
        }
      }
    } catch (error) {
      toast.error('Optimization failed', {
        description: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setIsOptimizing(false)
    }
  }, [text, isOptimizing, currentLanguage])

  const handleSelectOption = React.useCallback(
    (content: string) => {
      setText(content)
      setOptimizationOptions([])
      setOptimizingText('')
      setSelectedOptionIndex(0)
      setShowOptimizationDialog(false)
      requestAnimationFrame(() => {
        focusInputAtEnd()
      })
    },
    [focusInputAtEnd, setText]
  )

  const handleCancelOptimization = React.useCallback(() => {
    setOptimizationOptions([])
    setOptimizingText('')
    setSelectedOptionIndex(0)
    setShowOptimizationDialog(false)
  }, [])

  return {
    isOptimizing,
    optimizationOptions,
    showOptimizationDialog,
    setShowOptimizationDialog,
    selectedOptionIndex,
    setSelectedOptionIndex,
    contentScrollRef,
    handleOptimizePrompt,
    handleSelectOption,
    handleCancelOptimization
  }
}
