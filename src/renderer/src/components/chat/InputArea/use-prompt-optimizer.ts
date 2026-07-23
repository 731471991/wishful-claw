// Prompt optimization state and handlers for InputArea

import * as React from 'react'
import { toast } from 'sonner'
import { useProviderStore } from '@renderer/stores/provider-store'
import { useSettingsStore } from '@renderer/stores/settings-store'

export interface UsePromptOptimizerOptions {
  text: string
  currentLanguage: string
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

    try {
      const { optimizePrompt } = await import('@renderer/lib/prompt-optimizer/optimizer')

      const providerStore = useProviderStore.getState()
      const { providers } = providerStore

      let fastProvider = providers.find(
        (p) =>
          p.enabled &&
          p.models.some(
            (m) =>
              m.enabled &&
              (m.id.includes('haiku') || m.id.includes('4o-mini') || m.id.includes('gpt-4o-mini'))
          )
      )

      if (!fastProvider) {
        fastProvider = providers.find((p) => p.enabled && p.models.some((m) => m.enabled))
      }

      if (!fastProvider) {
        toast.error('No AI provider available', {
          description: 'Please configure an AI provider in Settings'
        })
        setIsOptimizing(false)
        return
      }

      const fastModel =
        fastProvider.models.find(
          (m) =>
            m.enabled &&
            (m.id.includes('haiku') || m.id.includes('4o-mini') || m.id.includes('gpt-4o-mini'))
        ) || fastProvider.models.find((m) => m.enabled)

      if (!fastModel) {
        toast.error('No AI model available', { description: 'Please enable a model in Settings' })
        setIsOptimizing(false)
        return
      }

      const providerConfig = {
        type: fastProvider.type,
        apiKey: fastProvider.apiKey,
        baseUrl: fastProvider.baseUrl,
        model: fastModel.id,
        providerId: fastProvider.id,
        maxTokens: 4096,
        temperature: 0.7,
        systemPrompt: ''
      }

      for await (const event of optimizePrompt(trimmed, providerConfig, currentLanguage)) {
        if (event.type === 'text') {
          setOptimizingText((prev) => prev + event.content)
        } else if (event.type === 'result' && event.options && event.options.length > 0) {
          setOptimizationOptions(event.options)
          setSelectedOptionIndex(0)
          setShowOptimizationDialog(true)
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
