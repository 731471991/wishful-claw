import { useState } from 'react'
import { Button } from '@renderer/components/ui/button'
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
        setJsonError('JSON 必须是一个对象')
        return
      }
      const config: ThinkingConfig = { bodyParams: parsed }
      if (disabledBodyParamsJson.trim()) {
        try {
          const disabledParsed = JSON.parse(disabledBodyParamsJson)
          if (typeof disabledParsed !== 'object' || disabledParsed === null || Array.isArray(disabledParsed)) {
            setJsonError('禁用参数 JSON 必须是一个对象')
            return
          }
          config.disabledBodyParams = disabledParsed
        } catch {
          setJsonError('禁用参数 JSON 格式错误')
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
      setJsonError('JSON 格式错误')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>思考模式配置</DialogTitle>
          <DialogDescription>配置 {model.name} 的思考/推理模式参数</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">启用思考模式</label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">启用时的请求参数</label>
                <p className="text-[11px] text-muted-foreground">
                  启用思考模式时注入到请求 body 的额外参数（JSON 对象）
                </p>
                <textarea
                  value={bodyParamsJson}
                  onChange={(e) => { setBodyParamsJson(e.target.value); setJsonError('') }}
                  className="w-full h-24 rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">禁用时的请求参数</label>
                <p className="text-[11px] text-muted-foreground">
                  关闭思考模式时注入到请求 body 的参数（留空则不注入）
                </p>
                <textarea
                  value={disabledBodyParamsJson}
                  onChange={(e) => { setDisabledBodyParamsJson(e.target.value); setJsonError('') }}
                  className="w-full h-24 rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                  spellCheck={false}
                  placeholder="留空表示不注入"
                />
              </div>
              {jsonError && <p className="text-[11px] text-destructive">{jsonError}</p>}
              <div className="space-y-2">
                <label className="text-sm font-medium">推理强度级别</label>
                <p className="text-[11px] text-muted-foreground">
                  选择模型支持的推理强度选项（如 OpenAI o1 的 reasoning_effort）
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
                  <label className="text-sm font-medium">默认推理强度</label>
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
                <label className="text-sm font-medium">强制 Temperature</label>
                <p className="text-[11px] text-muted-foreground">
                  某些模型在思考模式下要求固定 temperature（如 1），留空则不强制
                </p>
                <Input
                  type="number" step="0.1" min="0" max="2"
                  placeholder="留空不强制"
                  value={forceTemp}
                  onChange={(e) => setForceTemp(e.target.value)}
                  className="w-32 text-xs"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>取消</Button>
            <Button size="sm" onClick={handleSave}>保存</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
