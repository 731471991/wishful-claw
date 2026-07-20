import { useState, useMemo, useEffect } from 'react'
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
  Code2,
  Image as ImageIcon,
  Mic,
  Video,
  Shapes,
  MonitorSmartphone
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
  ModelCategory,
  ThinkingConfig,
  ReasoningEffortLevel,
} from '../../../../shared/types/provider'
import { cn } from '@renderer/lib/utils'

// ─── Constants ───

const REASONING_EFFORT_OPTIONS: ReasoningEffortLevel[] = [
  'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'
]

const MODEL_ICON_OPTIONS = [
  'openai', 'claude', 'anthropic', 'gemini', 'deepseek', 'qwen',
  'chatglm', 'minimax', 'kimi', 'moonshot', 'grok', 'meta',
  'llama', 'mistral', 'baidu', 'hunyuan', 'nvidia', 'stepfun',
  'doubao', 'ollama', 'siliconcloud', 'mimo', 'bigmodel'
] as const

const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  'anthropic': 'Anthropic Messages',
  'openai-chat': 'OpenAI Chat (兼容)',
  'openai-responses': 'OpenAI Responses',
  'openai-images': 'OpenAI Images',
  'seedance-video': 'Seedance Video (Volcengine)',
  'xai-video': 'xAI Video',
  'gemini': 'Gemini',
  'vertex-ai': 'Vertex AI'
}

const MIN_COMPRESSION_THRESHOLD = 0.3
const MAX_COMPRESSION_THRESHOLD = 0.9
const DEFAULT_COMPRESSION_THRESHOLD = 0.8

function clampCompressionThreshold(value: number): number {
  return Math.min(MAX_COMPRESSION_THRESHOLD, Math.max(MIN_COMPRESSION_THRESHOLD, value))
}

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
    if (!name.trim()) return
    addCustomProvider(name.trim(), type, baseUrl.trim())
    toast.success(`已添加 ${name.trim()}`)
    setName('')
    setBaseUrl('')
    setType('openai-chat')
    onOpenChange(false)
  }

  const providerTypeOptions: ProviderType[] = [
    'openai-chat', 'openai-responses', 'anthropic', 'gemini',
    'openai-images', 'seedance-video', 'xai-video'
  ]

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
                {providerTypeOptions.map((t) => (
                  <SelectItem key={t} value={t}>{PROVIDER_TYPE_LABELS[t]}</SelectItem>
                ))}
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
            <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
            <Button disabled={!name.trim()} onClick={handleAdd}>添加</Button>
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
  providerType,
  initial,
  onSave
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  providerType?: ProviderType | null
  initial?: AIModelConfig
  onSave: (model: AIModelConfig) => void
}): React.JSX.Element {
  const isEdit = !!initial

  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [typeOverride, setTypeOverride] = useState<ProviderType | 'none'>('none')
  const [category, setCategory] = useState<ModelCategory>('chat')
  const [contextLength, setContextLength] = useState('')
  const [maxOutputTokens, setMaxOutputTokens] = useState('')
  const [contextCompressionThreshold, setContextCompressionThreshold] = useState(
    Math.round(DEFAULT_COMPRESSION_THRESHOLD * 100).toString()
  )
  const [inputPrice, setInputPrice] = useState('')
  const [outputPrice, setOutputPrice] = useState('')
  const [cacheCreationPrice, setCacheCreationPrice] = useState('')
  const [cacheHitPrice, setCacheHitPrice] = useState('')
  const [premiumRequestMultiplier, setPremiumRequestMultiplier] = useState('')
  const [availablePlans, setAvailablePlans] = useState('')
  const [supportsVision, setSupportsVision] = useState(false)
  const [supportsFunctionCall, setSupportsFunctionCall] = useState(true)
  const [supportsComputerUse, setSupportsComputerUse] = useState(false)
  const [enableComputerUse, setEnableComputerUse] = useState(false)
  const [supportsBuiltinSearch, setSupportsBuiltinSearch] = useState(false)
  const [enableBuiltinSearch, setEnableBuiltinSearch] = useState(true)
  const [supportsFastMode, setSupportsFastMode] = useState(false)
  const [supportsWebsocket, setSupportsWebsocket] = useState(false)
  const [supportsImageGeneration, setSupportsImageGeneration] = useState(false)
  const [icon, setIcon] = useState('')
  const [responseSummary, setResponseSummary] = useState<'auto' | 'concise' | 'detailed' | 'none'>('none')
  const [websocketMode, setWebsocketMode] = useState<'auto' | 'disabled'>('disabled')
  const [enableSystemPromptCache, setEnableSystemPromptCache] = useState(true)
  const [cacheTtl, setCacheTtl] = useState<'5m' | '1h'>('5m')

  // Reset form state whenever the dialog opens or the initial model changes
  useEffect(() => {
    if (!open) return
    setId(initial?.id ?? '')
    setName(initial?.name ?? '')
    setTypeOverride(initial?.type ?? 'none')
    setCategory(initial?.category ?? 'chat')
    setContextLength(initial?.contextLength?.toString() ?? '')
    setMaxOutputTokens(initial?.maxOutputTokens?.toString() ?? '')
    setContextCompressionThreshold(
      Math.round(
        clampCompressionThreshold(
          initial?.contextCompressionThreshold ?? DEFAULT_COMPRESSION_THRESHOLD
        ) * 100
      ).toString()
    )
    setInputPrice(initial?.inputPrice?.toString() ?? '')
    setOutputPrice(initial?.outputPrice?.toString() ?? '')
    setCacheCreationPrice(initial?.cacheCreationPrice?.toString() ?? '')
    setCacheHitPrice(initial?.cacheHitPrice?.toString() ?? '')
    setPremiumRequestMultiplier(initial?.premiumRequestMultiplier?.toString() ?? '')
    setAvailablePlans(initial?.availablePlans?.join(', ') ?? '')
    setSupportsVision(initial?.supportsVision ?? false)
    setSupportsFunctionCall(initial?.supportsFunctionCall ?? true)
    setSupportsComputerUse(initial?.supportsComputerUse ?? false)
    setEnableComputerUse(initial?.enableComputerUse ?? false)
    setSupportsBuiltinSearch(initial?.supportsBuiltinSearch ?? false)
    setEnableBuiltinSearch(initial?.enableBuiltinSearch ?? true)
    setSupportsFastMode(initial?.serviceTier === 'priority')
    setSupportsWebsocket(initial?.supportsWebsocket ?? false)
    setSupportsImageGeneration(initial?.supportsImageGeneration ?? false)
    setIcon(initial?.icon ?? '')
    setResponseSummary(initial?.responseSummary ?? 'none')
    setWebsocketMode(initial?.websocketMode ?? 'disabled')
    setEnableSystemPromptCache(initial?.enableSystemPromptCache ?? true)
    setCacheTtl(initial?.cacheTtl ?? '5m')
  }, [open, initial])

  const requestType = typeOverride === 'none' ? providerType : typeOverride
  const isResponsesModel = requestType === 'openai-responses'
  const isAnthropicModel = requestType === 'anthropic'
  const isOpenAiChatModel = requestType === 'openai-chat'

  const handleSave = (): void => {
    const modelId = id.trim()
    if (!modelId) return

    const model: AIModelConfig = {
      id: modelId,
      name: name.trim() || modelId,
      enabled: initial?.enabled ?? true,
      category
    }

    if (typeOverride && typeOverride !== 'none') model.type = typeOverride
    if (contextLength.trim()) {
      const v = parseInt(contextLength)
      if (!isNaN(v)) model.contextLength = v
    }
    if (maxOutputTokens.trim()) {
      const v = parseInt(maxOutputTokens)
      if (!isNaN(v)) model.maxOutputTokens = v
    }
    if (contextCompressionThreshold.trim()) {
      const v = parseFloat(contextCompressionThreshold)
      if (!isNaN(v)) model.contextCompressionThreshold = clampCompressionThreshold(v / 100)
    }
    if (inputPrice.trim()) {
      const v = parseFloat(inputPrice)
      if (!isNaN(v)) model.inputPrice = v
    }
    if (outputPrice.trim()) {
      const v = parseFloat(outputPrice)
      if (!isNaN(v)) model.outputPrice = v
    }
    if (cacheCreationPrice.trim()) {
      const v = parseFloat(cacheCreationPrice)
      if (!isNaN(v)) model.cacheCreationPrice = v
    }
    if (cacheHitPrice.trim()) {
      const v = parseFloat(cacheHitPrice)
      if (!isNaN(v)) model.cacheHitPrice = v
    }
    if (premiumRequestMultiplier.trim()) {
      const v = parseFloat(premiumRequestMultiplier)
      if (!isNaN(v)) model.premiumRequestMultiplier = v
    }
    const parsedPlans = availablePlans.split(',').map(s => s.trim()).filter(Boolean)
    if (parsedPlans.length > 0) model.availablePlans = parsedPlans

    model.supportsVision = supportsVision
    model.supportsFunctionCall = supportsFunctionCall
    model.supportsComputerUse = supportsComputerUse
    model.enableComputerUse = supportsComputerUse && enableComputerUse

    if (isAnthropicModel || isResponsesModel) {
      model.supportsBuiltinSearch = supportsBuiltinSearch
      model.enableBuiltinSearch = supportsBuiltinSearch && enableBuiltinSearch
    }
    if (isResponsesModel || isOpenAiChatModel) {
      if (supportsFastMode) model.serviceTier = 'priority'
    }
    if (icon.trim()) model.icon = icon.trim()
    if (responseSummary && responseSummary !== 'none') model.responseSummary = responseSummary
    model.enableSystemPromptCache = enableSystemPromptCache
    model.cacheTtl = cacheTtl

    if (isResponsesModel) {
      model.supportsWebsocket = supportsWebsocket
      model.websocketMode = supportsWebsocket ? websocketMode : 'disabled'
      model.supportsImageGeneration = supportsImageGeneration
    }

    // preserve thinking config if editing
    if (initial?.supportsThinking) model.supportsThinking = initial.supportsThinking
    if (initial?.thinkingConfig) model.thinkingConfig = initial.thinkingConfig

    onSave(model)
    onOpenChange(false)
  }

  const typeOverrideOptions: ProviderType[] = [
    'openai-chat', 'openai-responses', 'anthropic', 'gemini',
    'openai-images', 'seedance-video', 'xai-video'
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑模型' : '添加模型'}</DialogTitle>
          <DialogDescription>
            {isEdit ? `修改 ${initial?.name} 的配置` : '配置新模型的参数和能力'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* ID + Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">模型 ID *</label>
              <Input
                placeholder="gpt-4o-mini"
                value={id}
                onChange={(e) => setId(e.target.value)}
                disabled={isEdit}
                autoFocus={!isEdit}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">显示名称</label>
              <Input
                placeholder="GPT-4o Mini"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus={isEdit}
                className="text-xs"
              />
            </div>
          </div>

          {/* Protocol type override */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">协议覆盖</label>
            <p className="text-[11px] text-muted-foreground">
              {providerType
                ? `不选则跟随服务商协议 (${PROVIDER_TYPE_LABELS[providerType]})`
                : '不选则跟随服务商协议'}
            </p>
            <Select value={typeOverride} onValueChange={(v) => setTypeOverride(v as ProviderType | 'none')}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="跟随服务商协议" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-xs">跟随服务商协议</SelectItem>
                {typeOverrideOptions.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">{PROVIDER_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model category */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">模型分类</label>
            <p className="text-[11px] text-muted-foreground">该模型的使用方式</p>
            <Select value={category} onValueChange={(v) => setCategory(v as ModelCategory)}>
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chat" className="text-xs">对话</SelectItem>
                <SelectItem value="speech" className="text-xs">语音</SelectItem>
                <SelectItem value="embedding" className="text-xs">嵌入</SelectItem>
                <SelectItem value="image" className="text-xs">图像</SelectItem>
                <SelectItem value="video" className="text-xs">视频</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Context + Max output */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">上下文长度</label>
              <Input
                type="number"
                placeholder="128000"
                value={contextLength}
                onChange={(e) => setContextLength(e.target.value)}
                className="text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">最大输出 Token</label>
              <Input
                type="number"
                placeholder="4096"
                value={maxOutputTokens}
                onChange={(e) => setMaxOutputTokens(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Context compression threshold */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">上下文压缩触发比例</label>
            <p className="text-[11px] text-muted-foreground">
              当上下文使用量达到此比例时触发压缩（{Math.round(MIN_COMPRESSION_THRESHOLD * 100)}-{Math.round(MAX_COMPRESSION_THRESHOLD * 100)}%）
            </p>
            <Input
              type="number"
              min={Math.round(MIN_COMPRESSION_THRESHOLD * 100)}
              max={Math.round(MAX_COMPRESSION_THRESHOLD * 100)}
              placeholder="80"
              value={contextCompressionThreshold}
              onChange={(e) => setContextCompressionThreshold(e.target.value)}
              className="text-xs"
            />
          </div>

          {/* Pricing */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">
              定价 <span className="text-muted-foreground font-normal">(USD / 百万 Token)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">输入价格</p>
                <Input
                  type="number" step="0.01" placeholder="0.00"
                  value={inputPrice}
                  onChange={(e) => setInputPrice(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">输出价格</p>
                <Input
                  type="number" step="0.01" placeholder="0.00"
                  value={outputPrice}
                  onChange={(e) => setOutputPrice(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">缓存写入价格</p>
                <Input
                  type="number" step="0.01" placeholder="0.00"
                  value={cacheCreationPrice}
                  onChange={(e) => setCacheCreationPrice(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">缓存命中价格</p>
                <Input
                  type="number" step="0.01" placeholder="0.00"
                  value={cacheHitPrice}
                  onChange={(e) => setCacheHitPrice(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Premium 请求倍率</p>
                <Input
                  type="number" step="0.01" placeholder="1"
                  value={premiumRequestMultiplier}
                  onChange={(e) => setPremiumRequestMultiplier(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">可用计划</p>
                <Input
                  placeholder="pro, pro+, business"
                  value={availablePlans}
                  onChange={(e) => setAvailablePlans(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          </div>

          {/* Icon */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">模型图标</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setIcon('')}
                className={cn(
                  'flex size-7 items-center justify-center rounded border transition-colors',
                  icon === ''
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground/50 hover:bg-muted/40'
                )}
              >
                <span className="text-[10px] text-muted-foreground">auto</span>
              </button>
              {MODEL_ICON_OPTIONS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcon(key)}
                  className={cn(
                    'flex size-7 items-center justify-center rounded border transition-colors',
                    icon === key
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-muted-foreground/50 hover:bg-muted/40'
                  )}
                  title={key}
                >
                  <Server className="size-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>

          {/* Responses config */}
          <div className="space-y-2">
            <label className="text-xs font-medium">Responses 配置</label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">推理摘要</span>
                <Select
                  value={responseSummary}
                  onValueChange={(v) => setResponseSummary(v as 'auto' | 'concise' | 'detailed' | 'none')}
                >
                  <SelectTrigger className="h-7 w-36 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-[11px]">不设置</SelectItem>
                    <SelectItem value="auto" className="text-[11px]">自动</SelectItem>
                    <SelectItem value="concise" className="text-[11px]">简洁</SelectItem>
                    <SelectItem value="detailed" className="text-[11px]">详细</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isResponsesModel && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">WebSocket 传输</span>
                    <Switch
                      checked={supportsWebsocket && websocketMode === 'auto'}
                      disabled={!supportsWebsocket}
                      onCheckedChange={(v) => setWebsocketMode(v ? 'auto' : 'disabled')}
                    />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">支持 WebSocket</span>
                      <span className="text-[11px] text-muted-foreground/70">启用 Responses API 的 WebSocket 传输</span>
                    </div>
                    <Switch checked={supportsWebsocket} onCheckedChange={setSupportsWebsocket} />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">支持图像生成</span>
                      <span className="text-[11px] text-muted-foreground/70">注入 image_generation 服务端工具</span>
                    </div>
                    <Switch checked={supportsImageGeneration} onCheckedChange={setSupportsImageGeneration} />
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">系统提示词缓存</span>
                <Switch checked={enableSystemPromptCache} onCheckedChange={setEnableSystemPromptCache} />
              </div>
              {isAnthropicModel && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">缓存 TTL</span>
                  <Select value={cacheTtl} onValueChange={(v) => setCacheTtl(v as '5m' | '1h')}>
                    <SelectTrigger className="w-20 h-7 text-[11px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5m">5m</SelectItem>
                      <SelectItem value="1h">1h</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          {/* Capabilities */}
          <div className="space-y-2">
            <label className="text-xs font-medium">能力</label>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">支持视觉</span>
                <Switch checked={supportsVision} onCheckedChange={setSupportsVision} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">支持函数调用</span>
                <Switch checked={supportsFunctionCall} onCheckedChange={setSupportsFunctionCall} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">支持 Computer Use</span>
                <Switch checked={supportsComputerUse} onCheckedChange={setSupportsComputerUse} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">启用 Computer Use</span>
                <Switch
                  checked={supportsComputerUse && enableComputerUse}
                  disabled={!supportsComputerUse}
                  onCheckedChange={setEnableComputerUse}
                />
              </div>
              {(isResponsesModel || isOpenAiChatModel) && (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">支持快速模式</span>
                    <span className="text-[11px] text-muted-foreground/70">使用 priority service tier</span>
                  </div>
                  <Switch checked={supportsFastMode} onCheckedChange={setSupportsFastMode} />
                </div>
              )}
              {(isAnthropicModel || isResponsesModel) && (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">支持内置搜索</span>
                      <span className="text-[11px] text-muted-foreground/70">Anthropic web_search / OpenAI Responses web_search</span>
                    </div>
                    <Switch checked={supportsBuiltinSearch} onCheckedChange={setSupportsBuiltinSearch} />
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">启用内置搜索</span>
                      <span className="text-[11px] text-muted-foreground/70">默认注入搜索工具</span>
                    </div>
                    <Switch
                      checked={supportsBuiltinSearch && enableBuiltinSearch}
                      disabled={!supportsBuiltinSearch}
                      onCheckedChange={setEnableBuiltinSearch}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>取消</Button>
            <Button size="sm" disabled={!id.trim()} onClick={handleSave}>
              {isEdit ? '保存' : '添加'}
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
  const [testModelId, setTestModelId] = useState(
    provider.models.find((m) => m.enabled)?.id ?? provider.models[0]?.id ?? ''
  )

  const enabledModelCount = provider.models.filter((m) => m.enabled).length
  const hasEnabledModels = enabledModelCount > 0
  const hasDisabledModels = enabledModelCount < provider.models.length
  const authReady = provider.requiresApiKey === false || Boolean(provider.apiKey)

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
    if (model.category === 'image') {
      indicators.push({ key: 'category-image', icon: ImageIcon, label: '图像' })
    } else if (model.category === 'speech') {
      indicators.push({ key: 'category-speech', icon: Mic, label: '语音' })
    } else if (model.category === 'embedding') {
      indicators.push({ key: 'category-embedding', icon: Shapes, label: '嵌入' })
    } else if (model.category === 'video') {
      indicators.push({ key: 'category-video', icon: Video, label: '视频' })
    }
    if (model.supportsVision) {
      indicators.push({ key: 'vision', icon: Eye, label: '支持视觉' })
    }
    if (model.supportsFunctionCall !== false) {
      indicators.push({ key: 'function', icon: Code2, label: '支持函数调用' })
    }
    if (model.supportsComputerUse) {
      indicators.push({
        key: 'computer-use',
        icon: MonitorSmartphone,
        label: model.enableComputerUse ? 'Computer Use 已启用' : '支持 Computer Use'
      })
    }
    if (model.supportsThinking) {
      indicators.push({ key: 'thinking', icon: Sparkles, label: '支持思考' })
    }
    return indicators
  }

  const providerTypeOptions: ProviderType[] = [
    'openai-chat', 'openai-responses', 'anthropic', 'gemini',
    'openai-images', 'seedance-video', 'xai-video'
  ]

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
              {PROVIDER_TYPE_LABELS[provider.type] ?? provider.type}
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

        {/* Connection check */}
        <section className="mt-4 space-y-2">
          <label className="text-sm font-medium">连接测试</label>
          <div className="flex items-center gap-2">
            <Select value={testModelId} onValueChange={setTestModelId}>
              <SelectTrigger className="flex-1 text-xs">
                <SelectValue placeholder={provider.models[0]?.id || '无可用模型'} />
              </SelectTrigger>
              <SelectContent>
                {(provider.models.some((m) => m.enabled)
                  ? provider.models.filter((m) => m.enabled)
                  : provider.models
                ).map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 gap-1.5 text-xs"
              disabled={!authReady || testing}
              onClick={handleTest}
            >
              {testing ? <Loader2 className="size-3 animate-spin" /> : <Server className="size-3" />}
              {testing ? '测试中...' : '测试'}
            </Button>
          </div>
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

        {/* Protocol type (for custom providers) */}
        {!provider.builtinId && (
          <section className="mt-5 space-y-2">
            <label className="text-sm font-medium">协议类型</label>
            <Select
              value={provider.type}
              onValueChange={(v) => updateProvider(provider.id, { type: v as ProviderType })}
            >
              <SelectTrigger className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providerTypeOptions.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {PROVIDER_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>
        )}

        {/* Anthropic cache TTL (provider-level) */}
        {provider.type === 'anthropic' && (
          <section className="mt-5 space-y-2">
            <label className="text-sm font-medium">缓存 TTL</label>
            <Select
              value={provider.cacheTtl ?? '5m'}
              onValueChange={(v) => updateProvider(provider.id, { cacheTtl: v as '5m' | '1h' })}
            >
              <SelectTrigger className="w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5m">5m</SelectItem>
                <SelectItem value="1h">1h</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Anthropic 缓存生存时间，模型级配置可覆盖</p>
          </section>
        )}

        {/* Request parameter carrying (provider-level) */}
        <section className="mt-5 space-y-3">
          <label className="text-sm font-medium">请求参数</label>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs">发送 max_tokens</p>
              <p className="text-[11px] text-muted-foreground">是否在请求中包含最大输出 Token 参数</p>
            </div>
            <Switch
              checked={provider.sendMaxOutputTokens !== false}
              onCheckedChange={(checked) =>
                updateProvider(provider.id, { sendMaxOutputTokens: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs">发送 temperature</p>
              <p className="text-[11px] text-muted-foreground">是否在请求中包含 temperature 参数</p>
            </div>
            <Switch
              checked={provider.sendTemperature !== false}
              onCheckedChange={(checked) =>
                updateProvider(provider.id, { sendTemperature: checked })
              }
            />
          </div>
        </section>

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
                      variant="outline" size="sm"
                      className="h-8 rounded-full px-3 text-[11px]"
                      disabled={!hasDisabledModels}
                      onClick={() => handleSetAllModelsEnabled(true)}
                    >
                      全部启用
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      className="h-8 rounded-full px-3 text-[11px]"
                      disabled={!hasEnabledModels}
                      onClick={() => handleSetAllModelsEnabled(false)}
                    >
                      全部禁用
                    </Button>
                  </>
                )}
                <Button
                  variant="outline" size="sm"
                  className="h-8 gap-1 text-[11px]"
                  onClick={handleFetchModels}
                  disabled={fetchingModels}
                >
                  {fetchingModels ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
                  拉取模型
                </Button>
                <Button
                  variant="outline" size="sm"
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
                          {(model.cacheCreationPrice != null || model.cacheHitPrice != null) && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400">
                              {model.cacheCreationPrice != null && model.cacheHitPrice != null
                                ? `cache $${model.cacheCreationPrice}/${model.cacheHitPrice}`
                                : model.cacheCreationPrice != null
                                  ? `cache write $${model.cacheCreationPrice}`
                                  : `cache read $${model.cacheHitPrice}`}
                            </span>
                          )}
                          {(model.premiumRequestMultiplier != null || model.availablePlans?.length) && (
                            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-sky-600 dark:text-sky-400">
                              {model.premiumRequestMultiplier != null
                                ? `${model.premiumRequestMultiplier}x`
                                : 'plans'}
                              {model.availablePlans?.length
                                ? ` · ${model.availablePlans.join('/')}`
                                : ''}
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
        providerType={provider.type}
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
