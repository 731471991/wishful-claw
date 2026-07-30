import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Trash2 } from 'lucide-react'
import { ProviderIcon } from '@renderer/components/settings/provider-icons'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import { useProviderStore } from '@renderer/stores/provider-store'
import type { AIProvider } from '../../../../shared/types/provider'
import { cn } from '@renderer/lib/utils'
import { AddProviderDialog } from './provider/AddProviderDialog'
import { ProviderConfigPanel } from './provider/ProviderConfigPanel'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'

function ProviderPanel(): React.JSX.Element {
  const { t } = useTranslation(['settings', 'common'])
  const { t: tc } = useTranslation('common')
  const providers = useProviderStore((s) => s.providers)
  const deleteProvider = useProviderStore((s) => s.deleteProvider)

  const activeProviderId = useProviderStore((s) => s.activeProviderId)
  // userSelectedId tracks manual user clicks; default selection derives from store state
  const [userSelectedId, setUserSelectedId] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AIProvider | null>(null)

  const selectedId = userSelectedId ?? activeProviderId ?? providers.find((p: any) => p.enabled)?.id ?? providers[0]?.id ?? null
  const resolvedSelectedId =
    selectedId && providers.some((p: any) => p.id === selectedId)
      ? selectedId
      : (activeProviderId ?? providers.find((p: any) => p.enabled)?.id ?? providers[0]?.id ?? null)

  const selectedProvider = resolvedSelectedId
    ? (providers.find((p: any) => p.id === resolvedSelectedId) ?? null)
    : null

  const enabledProviders = useMemo(
    () =>
      providers.filter(
        (p: any) => p.enabled && (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    [providers, searchQuery]
  )

  const disabledProviders = useMemo(
    () =>
      providers.filter(
        (p: any) => !p.enabled && (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()))
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
            onClick={() => setUserSelectedId(provider.id)}
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
              <ProviderIcon builtinId={provider.builtinId} size={16} className={cn(muted && 'opacity-50')} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{provider.name}</span>
              <span className="mt-0.5 block truncate text-[10px] text-muted-foreground/70">
                {enabledModelCount}/{provider.models.length} {t('provider.list.models')}
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
              setDeleteTarget(provider)
            }}
          >
            <Trash2 className="size-3.5" />
            {t('provider.list.deleteProvider')}
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
                placeholder={t('provider.list.searchPlaceholder')}
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
              title={t('provider.list.addTooltip')}
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            <div className="pb-20">
              {enabledProviders.length > 0 && (
                <div className="px-2 pb-1 pt-1">
                  <p className="px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/55">
                    {t('provider.list.enabled')}
                  </p>
                  {enabledProviders.map((p: any) => renderProviderListItem(p, false))}
                </div>
              )}
              {disabledProviders.length > 0 && (
                <div className="px-2 pb-1 pt-3">
                  <p className="px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/55">
                    {t('provider.list.disabled')}
                  </p>
                  {disabledProviders.map((p: any) => renderProviderListItem(p, true))}
                </div>
              )}
              {enabledProviders.length === 0 && disabledProviders.length === 0 && (
                <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                  {t('provider.list.noProviders')}
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
              {t('provider.list.selectProvider')}
            </div>
          )}
        </div>
      </div>

      <AddProviderDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tc('confirmDelete.deleteProvider.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tc('confirmDelete.deleteProvider.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  deleteProvider(deleteTarget.id)
                  if (selectedId === deleteTarget.id) setUserSelectedId(null)
                  toast.success(t('provider.list.providerDeleted'))
                }
                setDeleteTarget(null)
              }}
            >
              {tc('confirmDelete.deleteProvider.action')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export { ProviderPanel }
