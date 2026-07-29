import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Terminal, Globe } from 'lucide-react'
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
import type { McpServerConfig, McpTransportType } from '@renderer/lib/mcp/types'

export function McpServerForm({
  server,
  onUpdateServer
}: {
  server: McpServerConfig
  onUpdateServer: (patch: Partial<McpServerConfig>) => void
}): React.JSX.Element {
  const { t } = useTranslation('settings')

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

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedSave = useCallback(
    (patch: Partial<McpServerConfig>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        onUpdateServer(patch)
      }, 500)
    },
    [onUpdateServer]
  )

  const handleTransportChange = (value: McpTransportType): void => {
    onUpdateServer({ transport: value })
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

  const handleArgsChange = (value: string): void => {
    setLocalArgs(value)
    debouncedSave({ args: value.trim() ? value.trim().split(/\s+/) : [] })
  }

  const isHttp = server.transport === 'sse' || server.transport === 'streamable-http'

  return (
    <>
      {/* Name */}
      <section className="space-y-1.5 mb-4">
        <label className="text-xs font-medium">{t('mcp.name', { defaultValue: 'Name' })}</label>
        <Input
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value)
            debouncedSave({ name: e.target.value })
          }}
          className="h-8 text-xs"
          placeholder={t('mcp.namePlaceholder', { defaultValue: 'My MCP Server' })}
        />
      </section>

      {/* Description */}
      <section className="space-y-1.5 mb-4">
        <label className="text-xs font-medium">{t('mcp.description', { defaultValue: 'Description' })}</label>
        <Input
          value={localDescription}
          onChange={(e) => {
            setLocalDescription(e.target.value)
            debouncedSave({ description: e.target.value })
          }}
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
              onChange={(e) => {
                setLocalCommand(e.target.value)
                debouncedSave({ command: e.target.value })
              }}
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
              onChange={(e) => {
                setLocalCwd(e.target.value)
                debouncedSave({ cwd: e.target.value || undefined })
              }}
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
              onChange={(e) => {
                setLocalUrl(e.target.value)
                debouncedSave({ url: e.target.value })
              }}
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
                  onCheckedChange={(checked) => onUpdateServer({ autoFallback: checked })}
                />
              </div>
            </section>
          )}
        </>
      )}
    </>
  )
}
