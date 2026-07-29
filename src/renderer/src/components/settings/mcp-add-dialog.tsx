import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Terminal, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { useMcpStore } from '@renderer/stores/mcp-store'
import type { McpServerConfig, McpTransportType } from '@renderer/lib/mcp/types'

type McpJsonImportEntry = {
  command?: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
  url?: string
  headers?: Record<string, string>
  transport?: McpTransportType
  autoFallback?: boolean
  description?: string
  enabled?: boolean
}

function normalizeImportedServer(
  name: string,
  entry: McpJsonImportEntry
): Omit<McpServerConfig, 'id' | 'createdAt'> {
  const transport =
    entry.transport ??
    (entry.url ? (entry.url.includes('/sse') ? 'sse' : 'streamable-http') : 'stdio')

  return {
    name,
    enabled: entry.enabled ?? true,
    transport,
    command: entry.command,
    args: Array.isArray(entry.args) ? entry.args : undefined,
    env: entry.env,
    cwd: entry.cwd,
    url: entry.url,
    headers: entry.headers,
    autoFallback: transport === 'streamable-http' ? (entry.autoFallback ?? true) : undefined,
    description: entry.description
  }
}

function parseImportedServers(jsonText: string): Array<Omit<McpServerConfig, 'id' | 'createdAt'>> {
  const parsed = JSON.parse(jsonText) as unknown
  const source =
    parsed && typeof parsed === 'object' && 'mcpServers' in parsed
      ? (parsed as { mcpServers: unknown }).mcpServers
      : parsed

  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('Invalid MCP JSON format')
  }

  return Object.entries(source).flatMap(([name, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return []
    }
    return [normalizeImportedServer(name, value as McpJsonImportEntry)]
  })
}

const TRANSPORT_LABELS: Record<McpTransportType, string> = {
  stdio: 'stdio',
  sse: 'SSE (Legacy)',
  'streamable-http': 'Streamable HTTP'
}

export function McpAddDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { t } = useTranslation('settings')
  const addServer = useMcpStore((s) => s.addServer)
  const setSelectedServer = useMcpStore((s) => s.setSelectedServer)

  const [mode, setMode] = useState<'manual' | 'json'>('manual')
  const [name, setName] = useState('')
  const [transport, setTransport] = useState<McpTransportType>('stdio')
  const [jsonText, setJsonText] = useState('')

  const resetForm = (): void => {
    setMode('manual')
    setName('')
    setTransport('stdio')
    setJsonText('')
  }

  const handleAdd = async (): Promise<void> => {
    const serverName = name.trim() || t('mcp.namePlaceholder', { defaultValue: 'MCP Server' })
    const id = await addServer({
      name: serverName,
      enabled: true,
      transport,
      autoFallback: true
    })
    setSelectedServer(id)
    onOpenChange(false)
    resetForm()
    toast.success(t('mcp.serverAdded', { name: serverName, defaultValue: `Server "${serverName}" added` }))
  }

  const handleJsonImport = async (): Promise<void> => {
    try {
      const servers = parseImportedServers(jsonText.trim())
      if (servers.length === 0) {
        toast.error(t('mcp.importJsonInvalid', { defaultValue: 'Invalid JSON format' }))
        return
      }

      let lastId: string | null = null
      for (const server of servers) {
        lastId = await addServer(server)
      }

      setSelectedServer(lastId)
      onOpenChange(false)
      resetForm()
      toast.success(t('mcp.importJsonSuccess', { count: servers.length, defaultValue: `Imported ${servers.length} servers` }))
    } catch (error) {
      toast.error(t('mcp.importJsonFailed', { defaultValue: 'Import failed' }), {
        description: error instanceof Error ? error.message : String(error)
      })
    }
  }

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{t('mcp.addServerTitle', { defaultValue: 'Add MCP Server' })}</DialogTitle>
          <DialogDescription>{t('mcp.addServerDesc', { defaultValue: 'Configure a new MCP server connection' })}</DialogDescription>
        </DialogHeader>
        <div className="mt-2 min-w-0 space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
            <button
              onClick={() => setMode('manual')}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                mode === 'manual' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {t('mcp.manualCreate', { defaultValue: 'Manual' })}
            </button>
            <button
              onClick={() => setMode('json')}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                mode === 'json' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {t('mcp.importJson', { defaultValue: 'Import JSON' })}
            </button>
          </div>

          {mode === 'manual' ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{t('mcp.name', { defaultValue: 'Name' })}</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('mcp.namePlaceholder', { defaultValue: 'My MCP Server' })}
                  className="h-8 text-xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAdd()
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{t('mcp.transport', { defaultValue: 'Transport' })}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['stdio', 'streamable-http', 'sse'] as const).map((tp) => (
                    <button
                      key={tp}
                      onClick={() => setTransport(tp)}
                      className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors ${
                        transport === tp ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                    >
                      {tp === 'stdio' ? (
                        <Terminal className="size-4" />
                      ) : (
                        <Globe className="size-4" />
                      )}
                      <span className="text-[10px] font-medium">{TRANSPORT_LABELS[tp]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={handleAdd} className="w-full h-8 text-xs">
                {t('mcp.addServer', { defaultValue: 'Add Server' })}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{t('mcp.importJson', { defaultValue: 'Import JSON' })}</label>
                <Textarea
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  className="min-h-[180px] max-w-full overflow-x-auto overflow-y-auto text-xs font-mono whitespace-pre [field-sizing:fixed]"
                  placeholder={t('mcp.importJsonPlaceholder', { defaultValue: '{\n  "mcpServers": {\n    "server-name": {\n      "command": "npx",\n      "args": ["-y", "some-package"]\n    }\n  }\n}' })}
                  wrap="off"
                />
                <p className="text-[10px] text-muted-foreground">{t('mcp.importJsonHint', { defaultValue: 'Paste Claude Code / .mcp.json format' })}</p>
              </div>
              <Button onClick={handleJsonImport} className="w-full h-8 text-xs">
                {t('mcp.importJsonAction', { defaultValue: 'Import' })}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
