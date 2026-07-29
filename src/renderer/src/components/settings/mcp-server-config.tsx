import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { confirm } from '@renderer/components/ui/confirm-dialog'
import {
  Trash2,
  Play,
  Square,
  RefreshCw,
  Terminal,
  Globe,
  Wrench,
  FileText,
  MessageSquare
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import { Switch } from '@renderer/components/ui/switch'
import { Separator } from '@renderer/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useMcpStore } from '@renderer/stores/mcp-store'
import type { McpServerConfig, McpTransportType } from '@renderer/lib/mcp/types'

const TRANSPORT_LABELS: Record<McpTransportType, string> = {
  stdio: 'stdio',
  sse: 'SSE (Legacy)',
  'streamable-http': 'Streamable HTTP'
}

export function McpServerConfig({
  server,
  projectId
}: {
  server: McpServerConfig
  projectId?: string
}): React.JSX.Element {
  const { t } = useTranslation('settings')
  const updateServer = useMcpStore((s) => s.updateServer)
  const removeServer = useMcpStore((s) => s.removeServer)
  const connectServer = useMcpStore((s) => s.connectServer)
  const disconnectServer = useMcpStore((s) => s.disconnectServer)
  const refreshServerInfo = useMcpStore((s) => s.refreshServerInfo)
  const serverStatuses = useMcpStore((s) => s.serverStatuses)
  const serverTools = useMcpStore((s) => s.serverTools)
  const serverResources = useMcpStore((s) => s.serverResources)
  const serverPrompts = useMcpStore((s) => s.serverPrompts)
  const serverErrors = useMcpStore((s) => s.serverErrors)

  const status = serverStatuses[server.id] ?? 'disconnected'
  const tools = serverTools[server.id] ?? []
  const resources = serverResources[server.id] ?? []
  const prompts = serverPrompts[server.id] ?? []
  const error = serverErrors[server.id]

  const [localName, setLocalName] = useState(server.name)
  const [localDescription, setLocalDescription] = useState(server.description ?? '')
  const [localCommand, setLocalCommand] = useState(server.command ?? '')
  const [localArgs, setLocalArgs] = useState((server.args ?? []).join(' '))
  const [localCwd, setLocalCwd] = useState(server.cwd ?? '')
  const [localEnv, setLocalEnv] = useState(
    server.env ? Object.entries(server.env).map(([k, v]) => `${k}=${v}`).join('\n') : ''
  )
  const [localUrl, setLocalUrl] = useState(server.url ?? '')
  const [localHeaders, setLocalHeaders] = useState(
    server.headers ? Object.entries(server.headers).map(([k, v]) => `${k}: ${v}`).join('\n') : ''
  )
  const [capTab, setCapTab] = useState<'tools' | 'resources' | 'prompts'>('tools')
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    setLocalName(server.name)
    setLocalDescription(server.description ?? '')
    setLocalCommand(server.command ?? '')
    setLocalArgs((server.args ?? []).join(' '))
    setLocalCwd(server.cwd ?? '')
    setLocalEnv(
      server.env ? Object.entries(server.env).map(([k, v]) => `${k}=${v}`).join('\n') : ''
    )
    setLocalUrl(server.url ?? '')
    setLocalHeaders(
      server.headers ? Object.entries(server.headers).map(([k, v]) => `${k}: ${v}`).join('\n') : ''
    )
  }, [server.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refreshServerInfo(server.id)
  }, [server.id, refreshServerInfo])

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedSave = useCallback(
    (patch: Partial<McpServerConfig>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        updateServer(server.id, patch)
      }, 500)
    },
    [server.id, updateServer]
  )

  const handleNameChange = (value: string): void => {
    setLocalName(value)
    debouncedSave({ name: value })
  }

  const handleDescriptionChange = (value: string): void => {
    setLocalDescription(value)
    debouncedSave({ description: value })
  }

  const handleTransportChange = (value: McpTransportType): void => {
    updateServer(server.id, { transport: value })
  }

  const handleCommandChange = (value: string): void => {
    setLocalCommand(value)
    debouncedSave({ command: value })
  }

  const handleArgsChange = (value: string): void => {
    setLocalArgs(value)
    debouncedSave({ args: value.trim() ? value.trim().split(/\s+/) : [] })
  }

  const handleCwdChange = (value: string): void => {
    setLocalCwd(value)
    debouncedSave({ cwd: value || undefined })
  }

  const handleEnvChange = (value: string): void => {
    setLocalEnv(value)
    const env: Record<string, string> = {}
    for (const line of value.split('\n')) {
      const eqIdx = line.indexOf('=')
      if (eqIdx > 0) {
        env[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim()
      }
    }
    debouncedSave({ env: Object.keys(env).length > 0 ? env : undefined })
  }

  const handleUrlChange = (value: string): void => {
    setLocalUrl(value)
    debouncedSave({ url: value })
  }

  const handleHeadersChange = (value: string): void => {
    setLocalHeaders(value)
    const headers: Record<string, string> = {}
    for (const line of value.split('\n')) {
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        headers[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim()
      }
    }
    debouncedSave({ headers: Object.keys(headers).length > 0 ? headers : undefined })
  }

  const handleConnect = async (): Promise<void> => {
    setConnecting(true)
    try {
      const err = await connectServer(server.id)
      if (err) {
        toast.error(t('mcp.connectionFailed', { defaultValue: 'Connection failed' }), { description: err })
      } else {
        toast.success(t('mcp.connectedTo', { name: server.name, defaultValue: `Connected to ${server.name}` }))
      }
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async (): Promise<void> => {
    await disconnectServer(server.id)
    toast.success(t('mcp.disconnectedFrom', { name: server.name, defaultValue: `Disconnected from ${server.name}` }))
  }

  const handleToggleEnabled = async (): Promise<void> => {
    const enabled = !server.enabled
    await updateServer(server.id, {
      enabled,
      ...(enabled && projectId && server.projectId !== projectId ? { projectId } : {})
    })
    if (!enabled && status === 'connected') {
      await disconnectServer(server.id)
    }
  }

  const handleDelete = async (): Promise<void> => {
    const confirmed = await confirm({
      title: t('mcp.deleteConfirm', { name: server.name, defaultValue: `Delete "${server.name}"?` }),
      variant: 'destructive'
    })
    if (!confirmed) return
    await removeServer(server.id)
    toast.success(t('mcp.serverRemoved', { defaultValue: 'Server removed' }))
  }

  const handleRefresh = async (): Promise<void> => {
    await refreshServerInfo(server.id)
    toast.success(t('mcp.refreshed', { defaultValue: 'Refreshed' }))
  }

  const isHttp = server.transport === 'sse' || server.transport === 'streamable-http'

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden px-4 py-3">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{localName}</h3>
          <p className="text-xs text-muted-foreground">{TRANSPORT_LABELS[server.transport]}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
            title={t('mcp.deleteServer', { defaultValue: 'Delete' })}
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Switch checked={server.enabled} onCheckedChange={handleToggleEnabled} />
        </div>
      </div>

      <Separator className="mb-4" />

      {/* Name */}
      <section className="space-y-1.5 mb-4">
        <label className="text-xs font-medium">{t('mcp.name', { defaultValue: 'Name' })}</label>
        <Input
          value={localName}
          onChange={(e) => handleNameChange(e.target.value)}
          className="h-8 text-xs"
          placeholder={t('mcp.namePlaceholder', { defaultValue: 'My MCP Server' })}
        />
      </section>

      {/* Description */}
      <section className="space-y-1.5 mb-4">
        <label className="text-xs font-medium">{t('mcp.description', { defaultValue: 'Description' })}</label>
        <Input
          value={localDescription}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          className="h-8 text-xs"
          placeholder={t('mcp.descriptionPlaceholder', { defaultValue: 'Optional description' })}
        />
      </section>

      {/* Transport */}
      <section className="space-y-1.5 mb-4">
        <label className="text-xs font-medium">{t('mcp.transport', { defaultValue: 'Transport' })}</label>
        <Select value={server.transport} onValueChange={handleTransportChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stdio" className="text-xs">
              <span className="flex items-center gap-1.5">
                <Terminal className="size-3" /> stdio
              </span>
            </SelectItem>
            <SelectItem value="sse" className="text-xs">
              <span className="flex items-center gap-1.5">
                <Globe className="size-3" /> SSE (Legacy)
              </span>
            </SelectItem>
            <SelectItem value="streamable-http" className="text-xs">
              <span className="flex items-center gap-1.5">
                <Globe className="size-3" /> Streamable HTTP
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </section>

      <Separator className="mb-4" />

      {/* stdio config */}
      {server.transport === 'stdio' && (
        <>
          <section className="space-y-1.5 mb-3">
            <label className="text-xs font-medium">{t('mcp.command', { defaultValue: 'Command' })}</label>
            <Input
              value={localCommand}
              onChange={(e) => handleCommandChange(e.target.value)}
              className="h-8 text-xs font-mono"
              placeholder={t('mcp.commandPlaceholder', { defaultValue: 'npx' })}
            />
          </section>
          <section className="space-y-1.5 mb-3">
            <label className="text-xs font-medium">{t('mcp.arguments', { defaultValue: 'Arguments' })}</label>
            <Input
              value={localArgs}
              onChange={(e) => handleArgsChange(e.target.value)}
              className="h-8 text-xs font-mono"
              placeholder={t('mcp.argumentsPlaceholder', { defaultValue: '-y @modelcontextprotocol/server-filesystem' })}
            />
            <p className="text-[10px] text-muted-foreground">{t('mcp.argumentsHint', { defaultValue: 'Space-separated arguments' })}</p>
          </section>
          <section className="space-y-1.5 mb-3">
            <label className="text-xs font-medium">{t('mcp.workingDirectory', { defaultValue: 'Working Directory' })}</label>
            <Input
              value={localCwd}
              onChange={(e) => handleCwdChange(e.target.value)}
              className="h-8 text-xs font-mono"
              placeholder={t('mcp.workingDirectoryPlaceholder', { defaultValue: '/path/to/dir' })}
            />
          </section>
          <section className="space-y-1.5 mb-4">
            <label className="text-xs font-medium">{t('mcp.envVars', { defaultValue: 'Environment Variables' })}</label>
            <Textarea
              value={localEnv}
              onChange={(e) => handleEnvChange(e.target.value)}
              className="text-xs font-mono min-h-[60px]"
              placeholder={t('mcp.envVarsPlaceholder', { defaultValue: 'KEY=value' })}
              rows={3}
            />
            <p className="text-[10px] text-muted-foreground">{t('mcp.envVarsHint', { defaultValue: 'One per line: KEY=value' })}</p>
          </section>
        </>
      )}

      {/* HTTP config */}
      {isHttp && (
        <>
          <section className="space-y-1.5 mb-3">
            <label className="text-xs font-medium">{t('mcp.url', { defaultValue: 'URL' })}</label>
            <Input
              value={localUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              className="h-8 text-xs font-mono"
              placeholder={
                server.transport === 'sse'
                  ? t('mcp.urlPlaceholderSse', { defaultValue: 'https://example.com/sse' })
                  : t('mcp.urlPlaceholderHttp', { defaultValue: 'https://example.com/mcp' })
              }
            />
          </section>
          <section className="space-y-1.5 mb-3">
            <label className="text-xs font-medium">{t('mcp.headers', { defaultValue: 'Headers' })}</label>
            <Textarea
              value={localHeaders}
              onChange={(e) => handleHeadersChange(e.target.value)}
              className="text-xs font-mono min-h-[60px]"
              placeholder={t('mcp.headersPlaceholder', { defaultValue: 'Authorization: Bearer token' })}
              rows={3}
            />
            <p className="text-[10px] text-muted-foreground">{t('mcp.headersHint', { defaultValue: 'One per line: Key: Value' })}</p>
          </section>
          {server.transport === 'streamable-http' && (
            <section className="space-y-1.5 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-medium">{t('mcp.autoFallback', { defaultValue: 'Auto Fallback' })}</label>
                  <p className="text-[10px] text-muted-foreground">{t('mcp.autoFallbackDesc', { defaultValue: 'Fall back to SSE if HTTP fails' })}</p>
                </div>
                <Switch
                  checked={server.autoFallback !== false}
                  onCheckedChange={(checked) => updateServer(server.id, { autoFallback: checked })}
                />
              </div>
            </section>
          )}
        </>
      )}

      <Separator className="mb-4" />

      {/* Connection control */}
      <section className="flex items-center gap-2 mb-4">
        {status === 'connected' ? (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleDisconnect}>
            <Square className="size-3 mr-1" />
            {t('mcp.disconnect', { defaultValue: 'Disconnect' })}
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs"
            onClick={handleConnect}
            disabled={connecting || status === 'connecting'}
          >
            <Play className="size-3 mr-1" />
            {connecting || status === 'connecting' ? t('mcp.connecting', { defaultValue: 'Connecting...' }) : t('mcp.connect', { defaultValue: 'Connect' })}
          </Button>
        )}
        {status === 'connected' && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleRefresh}>
            <RefreshCw className="size-3 mr-1" />
            {t('mcp.refresh', { defaultValue: 'Refresh' })}
          </Button>
        )}
        <span
          className={`inline-flex items-center gap-1 text-[10px] ${
            status === 'connected'
              ? 'text-emerald-600 dark:text-emerald-400'
              : status === 'error'
                ? 'text-destructive'
                : status === 'connecting'
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-muted-foreground'
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              status === 'connected'
                ? 'bg-emerald-500'
                : status === 'error'
                  ? 'bg-destructive'
                  : status === 'connecting'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-muted-foreground/30'
            }`}
          />
          {status}
        </span>
      </section>

      {/* Error display */}
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 mb-4">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Capabilities tabs */}
      {status === 'connected' && (
        <>
          <Separator className="mb-3" />
          <div className="flex items-center gap-1 mb-3">
            {(['tools', 'resources', 'prompts'] as const).map((tab) => {
              const count =
                tab === 'tools' ? tools.length : tab === 'resources' ? resources.length : prompts.length
              const Icon = tab === 'tools' ? Wrench : tab === 'resources' ? FileText : MessageSquare
              return (
                <button
                  key={tab}
                  onClick={() => setCapTab(tab)}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors ${
                    capTab === tab
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  <Icon className="size-3" />
                  {tab} ({count})
                </button>
              )
            })}
          </div>

          {capTab === 'tools' && (
            <div className="space-y-1">
              {tools.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">{t('mcp.noTools', { defaultValue: 'No tools available' })}</p>
              ) : (
                tools.map((tool) => (
                  <div key={tool.name} className="rounded-md border px-2.5 py-2">
                    <p className="text-xs font-medium font-mono">{tool.name}</p>
                    {tool.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{tool.description}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {capTab === 'resources' && (
            <div className="space-y-1">
              {resources.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">{t('mcp.noResources', { defaultValue: 'No resources available' })}</p>
              ) : (
                resources.map((r) => (
                  <div key={r.uri} className="rounded-md border px-2.5 py-2">
                    <p className="text-xs font-medium">{r.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{r.uri}</p>
                    {r.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{r.description}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {capTab === 'prompts' && (
            <div className="space-y-1">
              {prompts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">{t('mcp.noPrompts', { defaultValue: 'No prompts available' })}</p>
              ) : (
                prompts.map((p) => (
                  <div key={p.name} className="rounded-md border px-2.5 py-2">
                    <p className="text-xs font-medium">{p.name}</p>
                    {p.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{p.description}</p>
                    )}
                    {p.arguments && p.arguments.length > 0 && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        Args: {p.arguments.map((a) => a.name).join(', ')}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      <div className="flex-1" />
    </div>
  )
}
