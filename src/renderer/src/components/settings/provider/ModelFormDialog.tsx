import { useState, useEffect } from 'react'
import { Server } from 'lucide-react'
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
  ProviderType,
  ModelCategory
} from '../../../../../shared/types/provider'
import { cn } from '@renderer/lib/utils'
import {
  PROVIDER_TYPE_LABELS,
  PROVIDER_TYPE_OPTIONS,
  MODEL_ICON_OPTIONS,
  MIN_COMPRESSION_THRESHOLD,
  MAX_COMPRESSION_THRESHOLD,
  DEFAULT_COMPRESSION_THRESHOLD,
  clampCompressionThreshold
} from './constants'

export function ModelFormDialog({
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
                {PROVIDER_TYPE_OPTIONS.map((t) => (
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
