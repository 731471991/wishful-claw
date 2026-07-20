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
  Pencil
} from 'lucide-react'
import type { ProviderType } from '../../../../shared/types/provider'
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import { useProviderStore } from '@renderer/stores/provider-store'
import type { AIProvider, AIModelConfig } from '../../../../shared/types/provider'
import { cn } from '@renderer/lib/utils'

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

  const handleSave = (): void => {
    if (!id.trim()) return
    onSave({
      id: id.trim(),
      name: name.trim() || id.trim(),
      enabled: true,
      contextLength: Number(contextLength) || 128000,
      maxOutputTokens: Number(maxOutputTokens) || 16384,
      supportsVision: false,
      supportsFunctionCall: true
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

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-8 pb-16 pt-8">
        {/* Provider header */}
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-background ring-1 ring-border/60">
            <Server className="size-5 text-muted-foreground" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{provider.name}</h2>
            <p className="text-xs text-muted-foreground">{provider.baseUrl}</p>
          </div>
          <Switch
            checked={provider.enabled}
            onCheckedChange={(checked) => updateProvider(provider.id, { enabled: checked })}
          />
        </div>

        {/* Config section */}
        <div className="space-y-5">
          {/* API Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium">API Key</label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder={provider.requiresApiKey === false ? '不需要 API Key' : '输入 API Key'}
                value={provider.apiKey}
                onChange={(e) => updateProvider(provider.id, { apiKey: e.target.value })}
                disabled={provider.requiresApiKey === false}
                className="pr-10"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Base URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Base URL</label>
            <Input
              placeholder="https://api.openai.com/v1"
              value={provider.baseUrl}
              onChange={(e) => updateProvider(provider.id, { baseUrl: e.target.value })}
            />
          </div>

          {/* Test & Fetch buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Server className="size-3.5" />
              )}
              测试连接
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFetchModels}
              disabled={fetchingModels}
            >
              {fetchingModels ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              拉取模型列表
            </Button>
            {!provider.builtinId && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  deleteProvider(provider.id)
                  toast.success('服务商已删除')
                }}
              >
                <Trash2 className="size-3.5" />
                删除
              </Button>
            )}
          </div>

          {/* Test result */}
          {testResult && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-lg border p-3 text-sm',
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

          <Separator />

          {/* Models section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">模型列表</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingModel(null)
                  setModelDialogOpen(true)
                }}
              >
                <Plus className="size-3.5" />
                添加模型
              </Button>
            </div>

            {provider.models.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                暂无模型，点击「拉取模型列表」或手动添加
              </p>
            ) : (
              <div className="space-y-1.5">
                {provider.models.map((model) => (
                  <div
                    key={model.id}
                    className="group flex items-center gap-3 rounded-lg border p-2.5"
                  >
                    <Switch
                      checked={model.enabled}
                      onCheckedChange={(checked) =>
                        updateModel(provider.id, model.id, { enabled: checked })
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{model.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {model.id} · {model.contextLength?.toLocaleString() ?? '?'} ctx
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingModel(model)
                        setModelDialogOpen(true)
                      }}
                      className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        deleteModel(provider.id, model.id)
                        toast.success('模型已删除')
                      }}
                      className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ModelFormDialog
        open={modelDialogOpen}
        onOpenChange={setModelDialogOpen}
        initial={editingModel ?? undefined}
        onSave={handleSaveModel}
      />
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
        (p) =>
          p.enabled &&
          (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [providers, searchQuery]
  )

  const disabledProviders = useMemo(
    () =>
      providers.filter(
        (p) =>
          !p.enabled &&
          (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
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
          {/* Search + Add */}
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
              title="添加服务商"
            >
              <Plus className="size-4" />
            </Button>
          </div>

          {/* List */}
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
                  暂无服务商，点击 + 添加
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
