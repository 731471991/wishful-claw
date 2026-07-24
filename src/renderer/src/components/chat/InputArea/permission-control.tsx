import {
  ShieldAlert, ShieldCheck, Check
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useSettingsStore } from '@renderer/stores/settings-store'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import { confirm } from '@renderer/components/ui/confirm-dialog'

type PermissionMode = 'default' | 'whitelist' | 'fullAccess'

interface PermissionControlProps {
  permissionMode: PermissionMode
  onSelectMode: (mode: PermissionMode) => Promise<void>
  onOpenSettings: (tab?: string) => void
}

export function PermissionControl({
  permissionMode,
  onSelectMode,
  onOpenSettings
}: PermissionControlProps) {
  const { t } = useTranslation()
  const composerIconControlClass = 'composer-control rounded-xl'

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                composerIconControlClass,
                'gap-1.5 px-2 text-xs font-medium',
                permissionMode === 'fullAccess' && 'text-amber-600 dark:text-amber-400',
                permissionMode === 'whitelist' && 'text-emerald-600 dark:text-emerald-400'
              )}
              aria-label={t('permission.label')}
            >
              {permissionMode === 'fullAccess' ? (
                <ShieldAlert className="size-3.5" />
              ) : (
                <ShieldCheck className="size-3.5" />
              )}
              <span className="max-w-24 truncate">
                {permissionMode === 'fullAccess'
                  ? t('permission.fullAccess')
                  : permissionMode === 'whitelist'
                    ? t('permission.whitelist')
                    : t('permission.default')}
              </span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{t('permission.tooltip')}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem
          className="flex-col items-start gap-0.5"
          onSelect={() => void onSelectMode('default')}
        >
          <div className="flex w-full items-center gap-2">
            <ShieldCheck className="size-3.5" />
            <span className="flex-1 font-medium">{t('permission.default')}</span>
            {permissionMode === 'default' && <Check className="size-3.5" />}
          </div>
          <span className="pl-[1.375rem] text-xs text-muted-foreground">
            {t('permission.defaultDesc')}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex-col items-start gap-0.5"
          onSelect={() => void onSelectMode('whitelist')}
        >
          <div className="flex w-full items-center gap-2">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="flex-1 font-medium">{t('permission.whitelist')}</span>
            {permissionMode === 'whitelist' && <Check className="size-3.5" />}
          </div>
          <span className="pl-[1.375rem] text-xs text-muted-foreground">
            {t('permission.whitelistDesc')}
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="flex-col items-start gap-0.5"
          onSelect={() => void onSelectMode('fullAccess')}
        >
          <div className="flex w-full items-center gap-2">
            <ShieldAlert className="size-3.5 text-amber-600 dark:text-amber-400" />
            <span className="flex-1 font-medium">{t('permission.fullAccess')}</span>
            {permissionMode === 'fullAccess' && <Check className="size-3.5" />}
          </div>
          <span className="pl-[1.375rem] text-xs text-muted-foreground">
            {t('permission.fullAccessDesc')}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onOpenSettings('permission')}>
          <span className="text-xs">{t('permission.manageWhitelist')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
