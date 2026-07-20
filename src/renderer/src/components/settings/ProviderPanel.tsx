import { useState, useMemo } from 'react'
import {
  Plus,
  Search,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  RefreshCw,
  Server,
  CheckCircle2,
  XCircle,
  Pencil,
  Brain,
  Sparkles,
  Code2
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Switch } from '@renderer/components/ui/switch'
import { Separator } from '@renderer/components/ui/separator'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@renderer/components/ui/tooltip'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import { useProviderStore } from '@renderer/stores/provider-store'
import type {
  AIProvider,
  AIModelConfig,
  ProviderType,
  ThinkingConfig,
  ReasoningEffortLevel
} from '../../../../shared/types/provider'
import { cn } from '@renderer/lib/utils'

const REASONING_EFFORT_OPTIONS: ReasoningEffortLevel[] = [
  'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'
]

function toRoundedTokenThousands(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${Math.round(value / 1000)}K`
  return String(value)
}

// ─── Add Custom Provider Dialog ───

function AddProviderDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}): React.JSX.Element {
  const addCustomProvider = useProviderStore((s) => s.addCustomProvider)
  const [name, setName] = useState('')
  const [type, setType] = useState<ProviderType>('openai-chat')
  const [baseUrl, setBaseUrl] = useState('')

  const handleAdd = (): void => {
    if (!name.trim() || !baseUrl.trim()) return
    addCustomProvider(name.trim(), type, baseUrl.trim())
    toast.success(`已添加 ${name.trim()}`)
    setName('')
    setBaseUrl('')
    setType('openai-chat')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>添加自定义服务商</DialogTitle>
          <DialogDescription>添加一个不在内置列表中的 AI 服务商</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">服务商名称</label>
            <Input
              placeholder="My Provider"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">协议类型</label>
            <Select value={type} onValueChange={(v) => setType(v as ProviderType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai-chat">OpenAI Chat (兼容)</SelectItem>
                <SelectItem value="anthropic">Anthropic Messages</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Base URL</label>
            <Input
              placeholder="https://api.example.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">API 的基础地址，通常以 /v1 结尾</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button disabled={!name.trim() || !baseUrl.trim()} onClick={handleAdd}>
              添加
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add/Edit Model Dialog ───

function ModelFormDialog({
  open,
  onOpenChange,
  initial,
  onSave
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial?: AIModelConfig
  onSave: (model: AIModelConfig) => void
}): React.JSX.Element {
  const [id, setId] = useState(initial?.id ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [contextLength, setContextLength] = useState(
    initial?.contextLength?.toString() ?? '128000'
  )
  const [maxOutputTokens, setMaxOutputTokens] = useState(
    initial?.maxOutputTokens?.toString() ?? '16384'
  )
  const [supportsVision, setSupportsVision] = useState(initial?.supportsVision ?? false)
  const [supportsFunctionCall, setSupportsFunctionCall] = useState(
    initial?.supportsFunctionCall ?? true
  )

  const handleSave = (): void => {
    if (!id.trim()) return
    onSave({
      id: id.trim(),
      name: name.trim() || id.trim(),
      enabled: initial?.enabled ?? true,
      contextLength: Number(contextLength) || 128000,
      maxOutputTokens: Number(maxOutputTokens) || 16384,
      supportsVision,
      supportsFunctionCall,
      ...(initial?.supportsThinking !== undefined ? { supportsThinking: initial.supportsThinking } : {}),
      ...(initial?.thinkingConfig ? { thinkingConfig: initial.thinkingConfig } : {})
    })
    setId('')
    setName('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? '编辑模型' : '添加模型'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">模型 ID</label>
            <Input
              placeholder="gpt-4o-mini"
              value={id}
              onChange={(e) => setId(e.target.value)}
              autoFocus
              disabled={!!initial}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">显示名称</label>
            <Input
              placeholder="GPT-4o Mini"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">上下文长度</label>
              <Input
                type="number"
                value={contextLength}
                onChange={(e) => setContextLength(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">最大输出 Token</label>
              <Input
                type="number"
                value={maxOutputTokens}
                onChange={(e) => setMaxOutputTokens(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <label className="text-sm font-medium">支持视觉</label>
              <p className="text-xs text-muted-foreground">模型可以处理图片输入</p>
            </div>
            <Switch checked={supportsVision} onCheckedChange={setSupportsVision} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <label className="text-sm font-medium">支持函数调用</label>
              <p className="text-xs text-muted-foreground">模型支持 tool/function calling</p>
            </div>
            <Switch checked={supportsFunctionCall} onCheckedChange={setSupportsFunctionCall} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button disabled={!id.trim()} onClick={handleSave}>
              {initial ? '保存' : '添加'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Thinking Config Dialog ───

function ThinkingConfigDialog({
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
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  placeholder="留空不强制"
                  value={forceTemp}
                  onChange={(e) => setForceTemp(e.target.value)}
                  className="w-32 text-xs"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button size="sm" onClick={handleSave}>
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Provider Config Panel ───

function ProviderConfigPanel({ provider }: { provider: AIProvider }): React.JSX.Element {
  const updateProvider = useProviderStore((s) => s.updateProvider)
  const deleteProvider = useProviderStore((s) => s.deleteProvider)
  const addModel = useProviderStore((s) => s.addModel)
  const updateModel = useProviderStore((s) => s.updateModel)
  const deleteModel = useProviderStore((s) => s.deleteModel)
  const setModels = useProviderStore((s) => s.setModels)
  const testConnection = useProviderStore((s) => s.testConnection)
  const fetchModels = useProviderStore((s) => s.fetchModels)

  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [fetchingModels, setFetchingModels] = useState(false)
  const [modelDialogOpen, setModelDialogOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<AIModelConfig | null>(null)
  const [editingThinkingModel, setEditingThinkingModel] = useState<AIModelConfig | null>(null)
  const [modelSearch, setModelSearch] = useState('')

  const enabledModelCount = provider.models.filter((m) => m.enabled).length
  const hasEnabledModels = enabledModelCount > 0
  const hasDisabledModels = enabledModelCount < provider.models.length

  const filteredModels = useMemo(() => {
    if (!modelSearch) return provider.models
    const q = modelSearch.toLowerCase()
    return provider.models.filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    )
  }, [provider.models, modelSearch])

  const handleSetAllModelsEnabled = (enabled: boolean): void => {
    setModels(
      provider.id,
      provider.models.map((m) => (m.enabled === enabled ? m : { ...m, enabled }))
    )
  }

  const handleTest = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await testConnection(provider)
      setTestResult(result)
      if (result.ok) {
        toast.success('连接测试成功')
      } else {
        toast.error('连接测试失败', { description: result.error })
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      setTestResult({ ok: false, error })
      toast.error('连接测试失败', { description: error })
    } finally {
      setTesting(false)
    }
  }

  const handleFetchModels = async (): Promise<void> => {
    setFetchingModels(true)
    try {
      const models = await fetchModels(provider)
      if (models.length === 0) {
        toast.info('未拉取到模型')
      } else {
        setModels(provider.id, models)
        toast.success(`已拉取 ${models.length} 个模型`)
      }
    } catch (err) {
      toast.error('拉取模型失败', {
        description: err instanceof Error ? err.message : String(err)
      })
    } finally {
      setFetchingModels(false)
    }
  }

  const handleSaveModel = (model: AIModelConfig): void => {
    if (editingModel) {
      updateModel(provider.id, editingModel.id, model)
      toast.success('模型已更新')
    } else {
      addModel(provider.id, model)
      toast.success('模型已添加')
    }
    setEditingModel(null)
  }

  // Build capability indicators for a model
  const getCapabilityIndicators = (model: AIModelConfig): Array<{
    key: string
    icon: React.ComponentType<{ className?: string }>
    label: string
  }> => {
    const indicators: Array<{ key: string; icon: React.ComponentType<{ className?: string }>; label: string }> = []
    if (model.supportsVision) {
      indicators.push({ key: 'vision', icon: Eye, label: '支持视觉' })
    }
    if (model.supportsFunctionCall !== false) {
      indicators.push({ key: 'function', icon: Code2, label: '支持函数调用' })
    }
    if (model.supportsThinking) {
      indicators.push({ key: 'thinking', icon: Sparkles, label: '支持思考' })
    }
    return indicators
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border/60">
            <Server className="size-5 text-muted-foreground" />
          </span>
          <div>
            <h3 className="text-sm font-semibold">{provider.name}</h3>
            <p className="text-[11px] text-muted-foreground">
              {provider.type === 'anthropic' ? 'Anthropic Messages API' : 'OpenAI Chat (兼容)'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!provider.builtinId && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => {
                deleteProvider(provider.id)
                toast.success('服务商已删除')
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
          <Switch
            checked={provider.enabled}
            onCheckedChange={(checked) => updateProvider(provider.id, { enabled: checked })}
          />
        </div>
      </div>

      {/* Config body */}
      <div className="flex flex-1 min-h-0 flex-col overflow-y-auto overflow-x-hidden px-5 pt-4 pb-20">
        {/* API Key */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">API Key</label>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder={provider.requiresApiKey === false ? '不需要 API Key' : '输入 API Key'}
                value={provider.apiKey}
                onChange={(e) => updateProvider(provider.id, { apiKey: e.target.value })}
                disabled={provider.requiresApiKey === false}
                className="pr-9 text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
              >
                {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>
        </section>

        {/* Base URL */}
        <section className="mt-4 space-y-2">
          <label className="text-sm font-medium">Base URL</label>
          <Input
            placeholder="https://api.openai.com/v1"
            value={provider.baseUrl}
            onChange={(e) => updateProvider(provider.id, { baseUrl: e.target.value })}
            className="text-xs"
          />
        </section>

        {/* Test & Fetch buttons */}
        <section className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={handleTest}
            disabled={testing}
          >
            {testing ? <Loader2 className="size-3 animate-spin" /> : <Server className="size-3" />}
            测试连接
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={handleFetchModels}
            disabled={fetchingModels}
          >
            {fetchingModels ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            拉取模型
          </Button>
        </section>

        {/* Test result */}
        {testResult && (
          <div
            className={cn(
              'mt-3 flex items-center gap-2 rounded-lg border p-3 text-sm',
              testResult.ok
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                : 'border-destructive/30 bg-destructive/5 text-destructive'
            )}
          >
            {testResult.ok ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <XCircle className="size-4 shrink-0" />
            )}
            <span className="min-w-0 truncate">
              {testResult.ok ? '连接成功' : testResult.error ?? '连接失败'}
            </span>
          </div>
        )}

        <Separator className="my-5" />

        {/* Models section */}
        <section className="space-y-3">
          {/* Model header with count + search + actions */}
          <div className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <label className="text-sm font-medium">模型列表</label>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  共 {provider.models.length} 个模型，{enabledModelCount} 个已启用
                </p>
              </div>
              <div className="flex items-center gap-1.5 self-start rounded-full border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{filteredModels.length}</span>
                <span>/</span>
                <span>{provider.models.length}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1 lg:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索模型..."
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  className="h-9 border-0 bg-background pl-8 text-xs shadow-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                {provider.models.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full px-3 text-[11px]"
                      disabled={!hasDisabledModels}
                      onClick={() => handleSetAllModelsEnabled(true)}
                    >
                      全部启用
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full px-3 text-[11px]"
                      disabled={!hasEnabledModels}
                      onClick={() => handleSetAllModelsEnabled(false)}
                    >
                      全部禁用
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 rounded-full p-0"
                  onClick={() => { setEditingModel(null); setModelDialogOpen(true) }}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Model list */}
          <div className="flex min-h-[320px] max-h-[420px] flex-col overflow-hidden rounded-xl border bg-background">
            {filteredModels.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
                {provider.models.length === 0 ? '暂无模型，点击 + 添加或拉取模型' : '无匹配结果'}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {filteredModels.map((model) => {
                  const capabilityIndicators = getCapabilityIndicators(model)
                  return (
                    <div
                      key={model.id}
                      className="group flex items-center gap-3 border-b border-border/60 px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/30"
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 ring-1 ring-border/50">
                        <Server className="size-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{model.name}</p>
                          <span className="truncate rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {model.id}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground/70">
                          {model.contextLength && (
                            <span className="rounded-full bg-muted/45 px-2 py-0.5">
                              {toRoundedTokenThousands(model.contextLength)} ctx
                            </span>
                          )}
                          {model.maxOutputTokens && (
                            <span className="rounded-full bg-muted/45 px-2 py-0.5">
                              {toRoundedTokenThousands(model.maxOutputTokens)} out
                            </span>
                          )}
                          {(model.inputPrice != null || model.outputPrice != null) && (
                            <span className="rounded-full bg-muted/45 px-2 py-0.5">
                              ${model.inputPrice ?? '?'}/${model.outputPrice ?? '?'}
                            </span>
                          )}
                          {capabilityIndicators.length > 0 && (
                            <span className="flex items-center gap-1 text-muted-foreground/60">
                              {capabilityIndicators.map(({ key, icon: Icon, label }) => (
                                <Tooltip key={`${model.id}-${key}`}>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                                      <Icon className="size-3" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-[11px]">
                                    {label}
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="ml-auto flex items-center gap-1.5 self-start pl-2">
                        {/* Edit model */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="flex size-7 items-center justify-center rounded-full border border-transparent text-muted-foreground/40 transition-all hover:border-border hover:bg-background hover:text-foreground group-hover:opacity-100 sm:opacity-0"
                              onClick={() => { setEditingModel(model); setModelDialogOpen(true) }}
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[11px]">编辑模型</TooltipContent>
                        </Tooltip>
                        {/* Thinking config */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                'flex size-7 items-center justify-center rounded-full border border-transparent transition-all hover:border-border hover:bg-background group-hover:opacity-100 sm:opacity-0',
                                model.supportsThinking
                                  ? 'text-violet-500 hover:text-violet-500'
                                  : 'text-muted-foreground/40 hover:text-foreground'
                              )}
                              onClick={() => setEditingThinkingModel(model)}
                            >
                              <Brain className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[11px]">
                            {model.supportsThinking ? '编辑思考配置' : '配置思考模式'}
                          </TooltipContent>
                        </Tooltip>
                        {/* Delete model */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 rounded-full p-0 text-muted-foreground/40 transition-all hover:bg-background hover:text-destructive group-hover:opacity-100 sm:opacity-0"
                          onClick={() => { deleteModel(provider.id, model.id); toast.success('模型已删除') }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                        {/* Enable switch */}
                        <div className="rounded-full border bg-background px-1.5 py-1">
                          <Switch
                            checked={model.enabled}
                            onCheckedChange={(checked) => updateModel(provider.id, model.id, { enabled: checked })}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Dialogs */}
      <ModelFormDialog
        open={modelDialogOpen}
        onOpenChange={setModelDialogOpen}
        initial={editingModel ?? undefined}
        onSave={handleSaveModel}
      />
      {editingThinkingModel && (
        <ThinkingConfigDialog
          model={editingThinkingModel}
          open={!!editingThinkingModel}
          onOpenChange={(v) => { if (!v) setEditingThinkingModel(null) }}
          onSave={(supportsThinking, thinkingConfig) => {
            if (editingThinkingModel) {
              updateModel(provider.id, editingThinkingModel.id, {
                supportsThinking,
                thinkingConfig: supportsThinking ? thinkingConfig : undefined
              })
              toast.success('思考配置已保存')
            }
            setEditingThinkingModel(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Provider Panel (main) ───

export function ProviderPanel(): React.JSX.Element {
  const providers = useProviderStore((s) => s.providers)
  const deleteProvider = useProviderStore((s) => s.deleteProvider)

  const [selectedId, setSelectedId] = useState<string | null>(
    () => providers.find((p) => p.enabled)?.id ?? providers[0]?.id ?? null
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const resolvedSelectedId =
    selectedId && providers.some((p) => p.id === selectedId)
      ? selectedId
      : (providers.find((p) => p.enabled)?.id ?? providers[0]?.id ?? null)

  const selectedProvider = resolvedSelectedId
    ? (providers.find((p) => p.id === resolvedSelectedId) ?? null)
    : null

  const enabledProviders = useMemo(
    () =>
      providers.filter(
        (p) => p.enabled && (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [providers, searchQuery]
  )

  const disabledProviders = useMemo(
    () =>
      providers.filter(
        (p) => !p.enabled && (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [providers, searchQuery]
  )

  const renderProviderListItem = (provider: AIProvider, muted: boolean): React.JSX.Element => {
    const enabledModelCount = provider.models.filter((m) => m.enabled).length
    const authReady = provider.requiresApiKey === false || Boolean(provider.apiKey)

    return (
      <ContextMenu key={provider.id}>
        <ContextMenuTrigger asChild>
          <button
            type="button"
            onClick={() => setSelectedId(provider.id)}
            className={cn(
              'group/provider relative mt-1 flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
              resolvedSelectedId === provider.id
                ? 'bg-primary/10 text-foreground ring-1 ring-primary/15'
                : muted
                  ? 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  : 'text-foreground/85 hover:bg-muted/60'
            )}
          >
            <span
              className={cn(
                'absolute bottom-2 left-0 top-2 w-0.5 rounded-full',
                resolvedSelectedId === provider.id ? 'bg-primary' : 'bg-transparent'
              )}
            />
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background ring-1 ring-border/60">
              <Server className={cn('size-4 text-muted-foreground', muted && 'opacity-50')} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{provider.name}</span>
              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground/70">
                {enabledModelCount}/{provider.models.length} 模型
              </span>
            </span>
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                provider.enabled && authReady
                  ? 'bg-emerald-500'
                  : provider.enabled
                    ? 'bg-amber-500'
                    : 'bg-muted-foreground/30'
              )}
            />
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-44">
          <ContextMenuItem
            className="gap-2 text-xs text-destructive focus:text-destructive"
            disabled={Boolean(provider.builtinId)}
            onSelect={() => {
              deleteProvider(provider.id)
              if (selectedId === provider.id) setSelectedId(null)
              toast.success('服务商已删除')
            }}
          >
            <Trash2 className="size-3.5" />
            删除服务商
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Provider list */}
        <div className="flex w-60 shrink-0 flex-col border-r bg-muted/10">
          <div className="flex items-center gap-1.5 border-b p-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50" />
              <Input
                placeholder="搜索服务商"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 bg-background pl-7 text-xs shadow-none"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 shrink-0 rounded-lg p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setDialogOpen(true)}
              title="添加自定义服务商"
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            <div className="pb-20">
              {enabledProviders.length > 0 && (
                <div className="px-2 pb-1 pt-1">
                  <p className="px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/55">
                    已启用
                  </p>
                  {enabledProviders.map((p) => renderProviderListItem(p, false))}
                </div>
              )}
              {disabledProviders.length > 0 && (
                <div className="px-2 pb-1 pt-3">
                  <p className="px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/55">
                    已禁用
                  </p>
                  {disabledProviders.map((p) => renderProviderListItem(p, true))}
                </div>
              )}
              {enabledProviders.length === 0 && disabledProviders.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  暂无服务商
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Config panel */}
        <div className="flex-1 min-w-0">
          {selectedProvider ? (
            <ProviderConfigPanel provider={selectedProvider} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              选择左侧的服务商进行配置
            </div>
          )}
        </div>
      </div>

      <AddProviderDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
