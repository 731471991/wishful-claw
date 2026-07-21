import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button} from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import type {
  AIModelConfig,
  ThinkingConfig,
  ReasoningEffortLevel
} from '../../../../../shared/types/provider'
import { cn } from '@renderer/lib/utils'
import { REASONING_EFFORT_OPTIONS } from './constants'

export function ThinkingConfigDialog({
  model,
  open,
  onOpenChange,
  onSave
}: {
  model: AIModelConfig
  open: boolean
  onOpenChange: (v: boolean) => void
  onSave: (supportsThinking: boolean, thinkingConfig?: ThinkingConfig) => void
}): React.JSX.Element {
  const [enabled, setEnabled] = useState(model.supportsThinking ?? false)
  const [bodyParamsJson, setBodyParamsJson] = useState(
    model.thinkingConfig?.bodyParams
      ? JSON.stringify(model.thinkingConfig.bodyParams, null, 2)
      : '{\n  \n}'
  )
  const [forceTemp, setForceTemp] = useState(
    model.thinkingConfig?.forceTemperature?.toString() ?? ''
  )
  const [disabledBodyParamsJson, setDisabledBodyParamsJson] = useState(
    model.thinkingConfig?.disabledBodyParams
      ? JSON.stringify(model.thinkingConfig.disabledBodyParams, null, 2)
      : ''
  )
  const [reasoningEffortLevels, setReasoningEffortLevels] = useState<ReasoningEffortLevel[]>(
    model.thinkingConfig?.reasoningEffortLevels ?? []
  )
  const [defaultReasoningEffort, setDefaultReasoningEffort] = useState<ReasoningEffortLevel>(
    model.thinkingConfig?.defaultReasoningEffort ??
      model.thinkingConfig?.reasoningEffortLevels?.[0] ??
      'medium'
  )
  const { t: ts } = useTranslation('settings')
  const { t: tc } = useTranslation('common')
  const [jsonError, setJsonError] = useState('')

  const toggleReasoningEffortLevel = (level: ReasoningEffortLevel): void => {
    const nextLevels = reasoningEffortLevels.includes(level)
      ? REASONING_EFFORT_OPTIONS.filter(
          (option) => option !== level && reasoningEffortLevels.includes(option)
        )
      : REASONING_EFFORT_OPTIONS.filter(
          (option) => option === level || reasoningEffortLevels.includes(option)
        )
    setReasoningEffortLevels(nextLevels)
    if (nextLevels.length === 0) {
      setDefaultReasoningEffort('medium')
      return
    }
    if (!nextLevels.includes(defaultReasoningEffort)) {
      setDefaultReasoningEffort(nextLevels[0])
    }
  }

  const handleSave = (): void => {
    if (!enabled) {
      onSave(false)
      onOpenChange(false)
      return
    }
    try {
      const parsed = JSON.parse(bodyParamsJson)
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setJsonError(ts('provider.thinking.jsonMustBeObject'))
        return
      }
      const config: ThinkingConfig = { bodyParams: parsed }
      if (disabledBodyParamsJson.trim()) {
        try {
          const disabledParsed = JSON.parse(disabledBodyParamsJson)
          if (typeof disabledParsed !== 'object' || disabledParsed === null || Array.isArray(disabledParsed)) {
            setJsonError(ts('provider.thinking.disabledJsonMustBeObject'))
            return
          }
          config.disabledBodyParams = disabledParsed
        } catch {
          setJsonError(ts('provider.thinking.disabledJsonFormatError'))
          return
        }
      }
      if (reasoningEffortLevels.length > 0) {
        config.reasoningEffortLevels = reasoningEffortLevels
        config.defaultReasoningEffort = reasoningEffortLevels.includes(defaultReasoningEffort)
          ? defaultReasoningEffort
          : reasoningEffortLevels[0]
      }
      if (forceTemp.trim()) {
        const temp = parseFloat(forceTemp)
        if (!isNaN(temp)) config.forceTemperature = temp
      }
      onSave(true, config)
      onOpenChange(false)
    } catch {
      setJsonError(ts('provider.thinking.jsonFormatError'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ts('provider.thinking.title')}</DialogTitle>
          <DialogDescription>{ts('provider.thinking.desc', { name: model.name })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{ts('provider.thinking.enable')}</label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">{ts('provider.thinking.bodyParams')}</label>
                <p className="text-[11px] text-muted-foreground">
                  {ts('provider.thinking.bodyParamsDesc')}
                </p>
                <textarea
                  value={bodyParamsJson}
                  onChange={(e) => { setBodyParamsJson(e.target.value); setJsonError('') }}
                  className="w-full h-24 rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{ts('provider.thinking.disabledBodyParams')}</label>
                <p className="text-[11px] text-muted-foreground">
                  {ts('provider.thinking.disabledBodyParamsDesc')}
                </p>
                <textarea
                  value={disabledBodyParamsJson}
                  onChange={(e) => { setDisabledBodyParamsJson(e.target.value); setJsonError('') }}
                  className="w-full h-24 rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  spellCheck={false}
                  placeholder={ts('provider.thinking.disabledBodyParamsPlaceholder')}
                />
              </div>
              {jsonError && <p className="text-[11px] text-destructive">{jsonError}</p>}
              <div className="space-y-2">
                <label className="text-sm font-medium">{ts('provider.thinking.reasoningEffort')}</label>
                <p className="text-[11px] text-muted-foreground">
                  {ts('provider.thinking.reasoningEffortDesc')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {REASONING_EFFORT_OPTIONS.map((level) => {
                    const selected = reasoningEffortLevels.includes(level)
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => toggleReasoningEffortLevel(level)}
                        className={cn(
                          'rounded-md border px-2 py-1 text-xs transition-colors',
                          selected
                            ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                            : 'border-border bg-background hover:bg-muted/50'
                        )}
                      >
                        {level}
                      </button>
                    )
                  })}
                </div>
              </div>
              {reasoningEffortLevels.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">{ts('provider.thinking.defaultEffort')}</label>
                  <Select
                    value={defaultReasoningEffort}
                    onValueChange={(value) => setDefaultReasoningEffort(value as ReasoningEffortLevel)}
                  >
                    <SelectTrigger className="w-40 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {reasoningEffortLevels.map((level) => (
                        <SelectItem key={level} value={level} className="text-xs">
                          {level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">{ts('provider.thinking.forceTemp')}</label>
                <p className="text-[11px] text-muted-foreground">
                  {ts('provider.thinking.forceTempDesc')}
                </p>
                <Input
                  type="number" step="0.1" min="0" max="2"
                  placeholder={ts('provider.thinking.forceTempPlaceholder')}
                  value={forceTemp}
                  onChange={(e) => setForceTemp(e.target.value)}
                  className="w-32 text-xs"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>{tc('actions.cancel')}</Button>
            <Button size="sm" onClick={handleSave}>{tc('actions.save')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
