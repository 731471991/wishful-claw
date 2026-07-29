import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Download, Package, Globe, ExternalLink, KeyRound, Terminal } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Separator } from '@renderer/components/ui/separator'
import { toast } from 'sonner'
import {
  packageToServerConfig,
  getRequiredEnvVars
} from '@renderer/lib/mcp/mcp-registry'
import type { RegistryServer } from '@renderer/lib/mcp/mcp-registry'
import { useMcpStore } from '@renderer/stores/mcp-store'

export function McpServerDetail({
  server,
  onBack
}: {
  server: RegistryServer
  onBack: () => void
}): React.JSX.Element {
  const { t } = useTranslation('settings')
  const addServer = useMcpStore((s) => s.addServer)
  const [envValues, setEnvValues] = useState<Record<string, string>>({})
  const [installing, setInstalling] = useState(false)

  const title = server.title ?? server.name.split('/').pop() ?? server.name
  const pkg = server.packages?.[0]
  const remote = server.remotes?.[0]
  const requiredVars = getRequiredEnvVars(server)
  const allEnvVars = pkg?.environmentVariables ?? []

  const handleInstall = async (): Promise<void> => {
    setInstalling(true)
    try {
      // If there are required env vars, validate they're filled
      for (const v of requiredVars) {
        if (!envValues[v.name]?.trim()) {
          toast.error(t('mcp.detail.fillRequired', { defaultValue: 'Please fill required fields' }))
          setInstalling(false)
          return
        }
      }

      if (!pkg && remote) {
        // Remote-only
        await addServer({
          name: title,
          description: server.description,
          enabled: true,
          projectId: null,
          transport: remote.type as 'sse' | 'streamable-http',
          url: remote.url,
          headers: undefined
        })
      } else if (pkg) {
        const config = packageToServerConfig(server, pkg)
        if (!config) {
          toast.error(t('mcp.detail.cannotInstall', { defaultValue: 'Cannot install this server' }))
          setInstalling(false)
          return
        }

        // Merge user-provided env vars
        const env: Record<string, string> = {}
        for (const v of allEnvVars) {
          const userVal = envValues[v.name]
          if (userVal?.trim()) {
            env[v.name] = userVal.trim()
          } else if (v.default) {
            env[v.name] = v.default
          }
        }

        await addServer({
          name: config.name,
          description: config.description,
          enabled: true,
          projectId: null,
          transport: config.transport,
          command: config.command,
          args: config.args,
          env: Object.keys(env).length > 0 ? env : undefined,
          url: config.url,
          headers: config.headers
        })
      }

      toast.success(t('mcp.detail.installed', { name: title, defaultValue: `Installed "${title}"` }))
      onBack()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(t('mcp.detail.installFailed', { defaultValue: 'Install failed' }), { description: msg })
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
        <Button variant="ghost" size="icon-sm" className="size-7" onClick={onBack}>
          <ArrowLeft className="size-3.5" />
        </Button>
        <h3 className="text-sm font-semibold">{title}</h3>
        {server.version && (
          <span className="text-[10px] text-muted-foreground">v{server.version}</span>
        )}
      </div>

      <div className="flex-1 px-4 py-3 space-y-4">
        {/* Description */}
        {server.description && (
          <section>
            <p className="text-xs text-muted-foreground leading-relaxed">{server.description}</p>
          </section>
        )}

        {/* Links */}
        {(server.repository?.url || server.websiteUrl) && (
          <section className="flex items-center gap-3">
            {server.repository?.url && (
              <a
                href={server.repository.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="size-3" />
                {t('mcp.detail.repository', { defaultValue: 'Repository' })}
              </a>
            )}
            {server.websiteUrl && (
              <a
                href={server.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="size-3" />
                {t('mcp.detail.website', { defaultValue: 'Website' })}
              </a>
            )}
          </section>
        )}

        <Separator />

        {/* Package info */}
        {pkg && (
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Package className="size-3.5" />
              {t('mcp.detail.package', { defaultValue: 'Package' })}
            </div>
            <div className="rounded-md border px-3 py-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('mcp.detail.registry', { defaultValue: 'Registry' })}</span>
                <span className="font-mono">{pkg.registryType ?? 'npm'}</span>
              </div>
              {pkg.identifier && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('mcp.detail.identifier', { defaultValue: 'Identifier' })}</span>
                  <span className="font-mono">{pkg.identifier}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('mcp.detail.transport', { defaultValue: 'Transport' })}</span>
                <span className="font-mono">{pkg.transport?.type ?? 'stdio'}</span>
              </div>
              {pkg.runtimeHint && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('mcp.detail.runtime', { defaultValue: 'Runtime' })}</span>
                  <span className="font-mono">{pkg.runtimeHint}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Remote info */}
        {remote && !pkg && (
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Globe className="size-3.5" />
              {t('mcp.detail.remoteEndpoint', { defaultValue: 'Remote Endpoint' })}
            </div>
            <div className="rounded-md border px-3 py-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('mcp.detail.transport', { defaultValue: 'Transport' })}</span>
                <span className="font-mono">{remote.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">URL</span>
                <span className="font-mono truncate max-w-[200px]">{remote.url}</span>
              </div>
            </div>
          </section>
        )}

        {/* Environment variables */}
        {allEnvVars.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <KeyRound className="size-3.5" />
              {t('mcp.detail.environmentVariables', { defaultValue: 'Environment Variables' })}
            </div>
            <div className="space-y-2">
              {allEnvVars.map((v) => (
                <div key={v.name} className="space-y-1">
                  <label className="text-xs font-mono flex items-center gap-1">
                    {v.name}
                    {v.isRequired && !v.default && (
                      <span className="text-destructive">*</span>
                    )}
                    {v.isSecret && (
                      <span className="text-[10px] text-muted-foreground">(secret)</span>
                    )}
                  </label>
                  {v.description && (
                    <p className="text-[10px] text-muted-foreground">{v.description}</p>
                  )}
                  <Input
                    type={v.isSecret ? 'password' : 'text'}
                    value={envValues[v.name] ?? v.default ?? ''}
                    onChange={(e) =>
                      setEnvValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                    }
                    className="h-7 text-xs font-mono"
                    placeholder={v.default ?? `Enter ${v.name}...`}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Preview command */}
        {pkg && pkg.transport?.type === 'stdio' && (
          <section className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Terminal className="size-3.5" />
              {t('mcp.detail.previewCommand', { defaultValue: 'Preview Command' })}
            </div>
            <div className="rounded-md bg-muted px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">
              {pkg.runtimeHint ?? 'npx'} {(pkg.runtimeArguments ?? []).map((a) => a.value).join(' ')} {pkg.identifier ?? ''}
            </div>
          </section>
        )}
      </div>

      {/* Install button */}
      <div className="border-t px-4 py-3 shrink-0">
        <Button
          className="w-full h-8 text-xs"
          onClick={handleInstall}
          disabled={installing}
        >
          <Download className="size-3.5 mr-1" />
          {installing
            ? t('mcp.detail.installing', { defaultValue: 'Installing...' })
            : t('mcp.detail.install', { defaultValue: 'Install' })}
        </Button>
      </div>
    </div>
  )
}
